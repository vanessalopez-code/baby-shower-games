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

// Serve built frontend in production
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

let gameSettings = {
  timerMode: 'auto',  // 'auto' | 'manual'
  globalTimer: 60,    // seconds (used when timerMode === 'auto')
};

let gameState = {
  phase: 'lobby',
  participants: {},
  currentItem: null,
  items: [],
  currentItemIndex: -1,
  itemResults: [],
};

let adminItems = [];

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function publicState() {
  const { participants, phase, currentItem, currentItemIndex, items, itemResults } = gameState;
  return {
    type: 'STATE',
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

function calculateScores(itemId) {
  const item = adminItems.find(i => i.id === itemId);
  if (!item) return;

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
    p.totalScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
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

function syncItems() {
  gameState.items = adminItems.map(({ id, name, imageUrl }) => ({ id, name, imageUrl }));
}

// --- Admin REST endpoints ---

app.get('/admin/settings', (req, res) => {
  res.json(gameSettings);
});

app.post('/admin/settings', (req, res) => {
  const { timerMode, globalTimer } = req.body;
  if (timerMode) gameSettings.timerMode = timerMode;
  if (globalTimer !== undefined) gameSettings.globalTimer = Number(globalTimer);
  broadcast(publicState());
  res.json({ ok: true, gameSettings });
});

app.post('/admin/items', (req, res) => {
  const { name, imageUrl, price } = req.body;
  const item = { id: Date.now().toString(), name, imageUrl, price };
  adminItems.push(item);
  syncItems();
  res.json({ ok: true, item });
});

app.delete('/admin/items/:id', (req, res) => {
  adminItems = adminItems.filter(i => i.id !== req.params.id);
  syncItems();
  res.json({ ok: true });
});

app.get('/admin/items', (req, res) => {
  res.json(adminItems);
});

app.post('/admin/reorder-items', (req, res) => {
  const { ids } = req.body; // ordered array of item ids
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const map = Object.fromEntries(adminItems.map(i => [i.id, i]));
  adminItems = ids.map(id => map[id]).filter(Boolean);
  syncItems();
  res.json({ ok: true });
});

app.post('/admin/start-round', (req, res) => {
  const nextIndex = gameState.currentItemIndex + 1;
  if (nextIndex >= adminItems.length) {
    return res.status(400).json({ error: 'No more items' });
  }
  const item = adminItems[nextIndex];
  const isAuto = gameSettings.timerMode === 'auto';
  const timer = isAuto ? gameSettings.globalTimer : null;
  const endTime = isAuto ? Date.now() + timer * 1000 : null;

  gameState.currentItemIndex = nextIndex;
  gameState.currentItem = { ...item, timer, endTime };
  gameState.phase = 'active';
  broadcast(publicState());

  if (isAuto && timer) {
    setTimeout(() => {
      if (gameState.currentItem?.id === item.id && gameState.phase === 'active') {
        endRound(item.id);
      }
    }, timer * 1000 + 500);
  }

  res.json({ ok: true });
});

function endRound(itemId) {
  const result = calculateScores(itemId);
  gameState.phase = 'results';
  broadcast({ ...publicState(), type: 'STATE', roundResult: result });
}

app.post('/admin/end-round', (req, res) => {
  if (!gameState.currentItem) return res.status(400).json({ error: 'No active round' });
  endRound(gameState.currentItem.id);
  res.json({ ok: true });
});

app.post('/admin/show-leaderboard', (req, res) => {
  gameState.phase = 'leaderboard';
  broadcast(publicState());
  res.json({ ok: true });
});

app.post('/admin/reset', (req, res) => {
  adminItems = [];
  gameState = {
    phase: 'lobby',
    participants: {},
    currentItem: null,
    items: [],
    currentItemIndex: -1,
    itemResults: [],
  };
  broadcast(publicState());
  res.json({ ok: true });
});

// --- WebSocket ---

wss.on('connection', ws => {
  ws.send(JSON.stringify(publicState()));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'JOIN') {
      const { name } = msg;
      if (!gameState.participants[name]) {
        gameState.participants[name] = { name, totalScore: 0, guesses: {}, itemScores: {} };
      }
      broadcast(publicState());
    }

    if (msg.type === 'GUESS') {
      const { name, guess } = msg;
      if (!gameState.currentItem || gameState.phase !== 'active') return;
      if (!gameState.participants[name]) return;
      const itemId = gameState.currentItem.id;
      gameState.participants[name].guesses[itemId] = guess;
      broadcast(publicState());
    }
  });
});

// SPA fallback — must be after all API routes
if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Baby Shower Games server running on port ${PORT}`);
});
