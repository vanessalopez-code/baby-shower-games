import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const GameContext = createContext(null);

const WS_URL = `ws://${window.location.hostname}:3001`;
const API_URL = `http://${window.location.hostname}:3001`;

export function GameProvider({ children }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('babyShower_name') || '');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (playerName) {
        ws.send(JSON.stringify({ type: 'JOIN', name: playerName }));
      }
    };
    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      setState(data);
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
    wsRef.current?.send(JSON.stringify({ type: 'JOIN', name }));
  }, []);

  const submitGuess = useCallback((guess) => {
    wsRef.current?.send(JSON.stringify({ type: 'GUESS', name: playerName, guess }));
  }, [playerName]);

  const api = useCallback(async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    try { return await res.json(); } catch { return { ok: res.ok, status: res.status }; }
  }, []);

  return (
    <GameContext.Provider value={{ state, connected, playerName, joinGame, submitGuess, api, API_URL }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
