import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'changeme-set-env-var';

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use('/admin', requireAdmin);

// Serve built frontend in production
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

// --- Multi-game state ---

const games = new Map(); // gameId -> gameData

function createGame(name) {
  const id = Date.now().toString();
  const game = {
    id,
    name,
    status: 'active',
    createdAt: Date.now(),
    adminItems: [],
    gameSettings: { timerMode: 'auto', globalTimer: 60, maxPrice: 500 },
    gameState: {
      phase: 'lobby',
      participants: {},
      currentItem: null,
      items: [],
      currentItemIndex: -1,
      itemResults: [],
    },
  };
  games.set(id, game);
  return game;
}

function syncItems(game) {
  game.gameState.items = game.adminItems.map(({ id, name, imageUrl }) => ({ id, name, imageUrl }));
}

function publicState(game) {
  const { gameState, gameSettings } = game;
  const { participants, phase, currentItem, currentItemIndex, items, itemResults } = gameState;
  return {
    type: 'STATE',
    gameId: game.id,
    gameName: game.name,
    phase,
    participants: Object.values(participants).map(p => ({
      name: p.name,
      totalScore: p.totalScore,
      hasGuessed: currentItem ? p.guesses[currentItem.id] !== undefined : false,
    })),
    currentItem: currentItem ? {
      id: currentItem.id,
      name: currentItem.name,
      imageUrl: currentItem.imageUrl,
      timer: currentItem.timer,
      endTime: currentItem.endTime,
    } : null,
    currentItemIndex,
    totalItems: items.length,
    itemResults,
    gameSettings,
  };
}

function publicGamesList() {
  return {
    type: 'GAMES',
    games: [...games.values()]
      .filter(g => g.status === 'active')
      .map(g => ({
        id: g.id,
        name: g.name,
        phase: g.gameState.phase,
        participantCount: Object.keys(g.gameState.participants).length,
      })),
  };
}

function broadcastToGame(gameId, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.gameId === gameId) client.send(msg);
  });
}

function broadcastAll(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function calculateScores(game, itemId) {
  const item = game.adminItems.find(i => i.id === itemId);
  if (!item) return;

  const { gameState } = game;
  const guesses = [];
  Object.values(gameState.participants).forEach(p => {
    const guess = p.guesses[itemId];
    if (guess !== undefined) {
      guesses.push({ name: p.name, guess, diff: Math.abs(guess - item.price) });
    }
  });

  if (guesses.length === 0) return;

  const minDiff = Math.min(...guesses.map(g => g.diff));
  const maxDiff = Math.max(...guesses.map(g => g.diff));
  const range = maxDiff - minDiff;

  guesses.forEach(g => {
    const score = range === 0 ? 100 : Math.round(100 * (1 - (g.diff - minDiff) / range));
    g.score = score;
    if (gameState.participants[g.name]) {
      gameState.participants[g.name].itemScores = gameState.participants[g.name].itemScores || {};
      gameState.participants[g.name].itemScores[itemId] = score;
    }
  });

  Object.values(gameState.participants).forEach(p => {
    const scores = Object.values(p.itemScores || {});
    p.totalScore = scores.reduce((a, b) => a + b, 0);
  });

  const result = {
    itemId,
    itemName: item.name,
    price: item.price,
    imageUrl: item.imageUrl,
    guesses: guesses.sort((a, b) => b.score - a.score),
  };
  gameState.itemResults.push(result);
  return result;
}

function endRound(game, itemId) {
  const result = calculateScores(game, itemId);
  game.gameState.phase = 'leaderboard';
  broadcastToGame(game.id, { ...publicState(game), type: 'STATE', roundResult: result });
}

function getGame(req, res) {
  const game = games.get(req.params.gameId);
  if (!game) { res.status(404).json({ error: 'Game not found' }); return null; }
  return game;
}

// --- Public REST ---

app.get('/games', (req, res) => {
  res.json([...games.values()]
    .filter(g => g.status === 'active')
    .map(g => ({
      id: g.id,
      name: g.name,
      phase: g.gameState.phase,
      participantCount: Object.keys(g.gameState.participants).length,
    }))
  );
});

// --- Admin REST ---

app.get('/admin/games', (req, res) => {
  res.json([...games.values()].map(g => ({
    id: g.id,
    name: g.name,
    status: g.status,
    createdAt: g.createdAt,
    phase: g.gameState.phase,
    participantCount: Object.keys(g.gameState.participants).length,
    itemCount: g.adminItems.length,
  })));
});

app.post('/admin/games', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const game = createGame(name.trim());
  broadcastAll(publicGamesList());
  res.json({ ok: true, game: { id: game.id, name: game.name } });
});

app.post('/admin/games/:gameId/archive', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  game.status = 'archived';
  broadcastToGame(game.id, { type: 'ARCHIVED' });
  broadcastAll(publicGamesList());
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/unarchive', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  game.status = 'active';
  broadcastAll(publicGamesList());
  res.json({ ok: true });
});

app.get('/admin/games/:gameId/settings', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  res.json(game.gameSettings);
});

app.post('/admin/games/:gameId/settings', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  const { timerMode, globalTimer, maxPrice } = req.body;
  if (timerMode) game.gameSettings.timerMode = timerMode;
  if (globalTimer !== undefined) game.gameSettings.globalTimer = Number(globalTimer);
  if (maxPrice !== undefined) game.gameSettings.maxPrice = Number(maxPrice);
  broadcastToGame(game.id, publicState(game));
  res.json({ ok: true, gameSettings: game.gameSettings });
});

app.get('/admin/games/:gameId/items', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  res.json(game.adminItems);
});

app.post('/admin/games/:gameId/items', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  const { name, imageUrl, price } = req.body;
  const item = { id: Date.now().toString(), name, imageUrl, price };
  game.adminItems.push(item);
  syncItems(game);
  res.json({ ok: true, item });
});

app.delete('/admin/games/:gameId/items/:itemId', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  game.adminItems = game.adminItems.filter(i => i.id !== req.params.itemId);
  syncItems(game);
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/reorder-items', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const map = Object.fromEntries(game.adminItems.map(i => [i.id, i]));
  game.adminItems = ids.map(id => map[id]).filter(Boolean);
  syncItems(game);
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/start-round', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  const { gameState, adminItems, gameSettings } = game;
  const nextIndex = gameState.currentItemIndex + 1;
  if (nextIndex >= adminItems.length) return res.status(400).json({ error: 'No more items' });

  const item = adminItems[nextIndex];
  const isAuto = gameSettings.timerMode === 'auto';
  const timer = isAuto ? gameSettings.globalTimer : null;
  const endTime = isAuto ? Date.now() + timer * 1000 : null;

  gameState.currentItemIndex = nextIndex;
  gameState.currentItem = { ...item, timer, endTime };
  gameState.phase = 'active';
  broadcastToGame(game.id, publicState(game));

  if (isAuto && timer) {
    setTimeout(() => {
      if (gameState.currentItem?.id === item.id && gameState.phase === 'active') {
        endRound(game, item.id);
      }
    }, timer * 1000 + 500);
  }
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/end-round', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  if (!game.gameState.currentItem) return res.status(400).json({ error: 'No active round' });
  endRound(game, game.gameState.currentItem.id);
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/show-leaderboard', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  game.gameState.phase = 'leaderboard';
  broadcastToGame(game.id, publicState(game));
  res.json({ ok: true });
});

app.post('/admin/games/:gameId/reset', (req, res) => {
  const game = getGame(req, res); if (!game) return;
  game.adminItems = [];
  game.gameState = {
    phase: 'lobby',
    participants: {},
    currentItem: null,
    items: [],
    currentItemIndex: -1,
    itemResults: [],
  };
  broadcastToGame(game.id, publicState(game));
  broadcastAll(publicGamesList());
  res.json({ ok: true });
});

// --- WebSocket ---

wss.on('connection', ws => {
  ws.gameId = null;
  ws.send(JSON.stringify(publicGamesList()));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'JOIN') {
      const { name, gameId } = msg;
      const game = games.get(gameId);
      if (!game || game.status !== 'active') return;
      ws.gameId = gameId;
      if (!game.gameState.participants[name]) {
        game.gameState.participants[name] = { name, totalScore: 0, guesses: {}, itemScores: {} };
      }
      broadcastToGame(gameId, publicState(game));
    }

    if (msg.type === 'GUESS') {
      const { name, guess } = msg;
      const game = ws.gameId ? games.get(ws.gameId) : null;
      if (!game || !game.gameState.currentItem || game.gameState.phase !== 'active') return;
      if (!game.gameState.participants[name]) return;
      const itemId = game.gameState.currentItem.id;
      game.gameState.participants[name].guesses[itemId] = guess;
      broadcastToGame(ws.gameId, publicState(game));
    }
  });
});

// SPA fallback — must be after all API routes
if (existsSync(distPath)) {
  app.use((req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Baby Shower Games server running on port ${PORT}`);
});
