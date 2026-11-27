import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const GameContext = createContext(null);

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^192\.168\./.test(window.location.hostname);
const WS_URL = isLocal ? `ws://${window.location.hostname}:3001` : `wss://${window.location.host}`;
const API_URL = isLocal ? `http://${window.location.hostname}:3001` : '';

export function GameProvider({ children }) {
  const [state, setState] = useState(null);           // current joined game state
  const [availableGames, setAvailableGames] = useState([]); // list of active games
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('babyShower_name') || '');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const currentGameIdRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Re-join game if we had one
      if (currentGameIdRef.current && playerName) {
        ws.send(JSON.stringify({ type: 'JOIN', name: playerName, gameId: currentGameIdRef.current }));
      }
    };
    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      if (data.type === 'GAMES') {
        setAvailableGames(data.games);
      } else if (data.type === 'STATE') {
        setState(data);
      } else if (data.type === 'ARCHIVED') {
        setState(null);
        currentGameIdRef.current = null;
      }
    };
    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  }, [playerName]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const joinGame = useCallback((name) => {
    localStorage.setItem('babyShower_name', name);
    setPlayerName(name);
  }, []);

  const joinGameRoom = useCallback((gameId, name) => {
    const resolvedName = name || playerName;
    currentGameIdRef.current = gameId;
    wsRef.current?.send(JSON.stringify({ type: 'JOIN', name: resolvedName, gameId }));
  }, [playerName]);

  const submitGuess = useCallback((guess) => {
    wsRef.current?.send(JSON.stringify({ type: 'GUESS', name: playerName, guess }));
  }, [playerName]);

  const api = useCallback(async (path, body, method = 'POST') => {
    const secret = sessionStorage.getItem('adminSecret') || '';
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    try { return await res.json(); } catch { return { ok: res.ok, status: res.status }; }
  }, []);

  const adminGet = useCallback(async (path) => {
    const secret = sessionStorage.getItem('adminSecret') || '';
    const res = await fetch(`${API_URL}${path}`, { headers: { 'x-admin-secret': secret } });
    return res.json();
  }, []);

  return (
    <GameContext.Provider value={{ state, availableGames, connected, playerName, joinGame, joinGameRoom, submitGuess, api, adminGet, API_URL }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
