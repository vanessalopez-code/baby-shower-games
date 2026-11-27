import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import Leaderboard from '../components/Leaderboard';

export default function GamePriceIsRight() {
  const { state, playerName, submitGuess } = useGame();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  const itemId = state?.currentItem?.id;

  // Restore guess + submitted from sessionStorage so navigation doesn't reset them
  const storageKey = itemId ? `bs_guess_${itemId}` : null;
  const stored = storageKey ? (() => { try { return JSON.parse(sessionStorage.getItem(storageKey)); } catch { return null; } })() : null;

  const [guess, setGuess] = useState(stored?.guess ?? 250);
  const [submitted, setSubmitted] = useState(stored?.submitted ?? false);

  // When a new item appears, clear stale storage and reset
  const prevItemId = useRef(itemId);
  useEffect(() => {
    if (itemId && itemId !== prevItemId.current) {
      prevItemId.current = itemId;
      setSubmitted(false);
      setGuess(250);
    }
  }, [itemId]);

  useEffect(() => {
    if (state?.phase !== 'active' || !state?.currentItem?.endTime) {
      setTimeLeft(null);
      clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((state.currentItem.endTime - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => clearInterval(timerRef.current);
  }, [state?.phase, state?.currentItem?.endTime]);

  const handleSubmit = () => {
    if (submitted) return;
    submitGuess(guess);
    setSubmitted(true);
    try { sessionStorage.setItem(storageKey, JSON.stringify({ guess, submitted: true })); } catch {}
  };

  const HomeBar = () => (
    <div className="bg-white border-b border-sage-light/30 px-4 py-2 flex items-center justify-between">
      <button onClick={() => navigate('/')} className="text-sm text-wood-light hover:text-wood-mid transition flex items-center gap-1">
        ← Home
      </button>
      {playerName && <span className="text-xs text-sage-mid">Playing as <span className="font-semibold text-wood">{playerName}</span></span>}
    </div>
  );

  if (!playerName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <p className="text-wood mb-4">You need to enter your name first.</p>
          <button onClick={() => navigate('/')} className="bg-sage text-white px-6 py-2 rounded-full font-semibold">Go to Home</button>
        </div>
      </div>
    );
  }

  const phase = state?.phase;

  // Lobby / waiting
  if (!phase || phase === 'lobby') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <HomeBar />
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-semibold text-wood mb-2">Waiting for the game to start…</h1>
          <p className="text-sage-mid text-sm">The host will start the first round soon!</p>
        </div>
      </div>
    );
  }

  // Active round
  if (phase === 'active' && state.currentItem) {
    const item = state.currentItem;
    const maxPrice = state.gameSettings?.maxPrice || 500;
    const timerPct = timeLeft !== null ? (timeLeft / item.timer) * 100 : 100;
    const urgent = timeLeft !== null && timeLeft <= 10;

    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <HomeBar />
        {/* Sage header with timer */}
        <div className="bg-sage px-4 pt-4 pb-6">
          <div className="flex justify-between text-xs text-white/80 font-medium mb-2">
            <span>Item {state.currentItemIndex + 1} of {state.totalItems}</span>
            <span className={urgent ? 'text-yellow-200 font-bold' : ''}>{timeLeft !== null ? `${timeLeft}s` : ''}</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${urgent ? 'bg-yellow-200' : 'bg-white'}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center px-4 pb-8 -mt-3">
          <div className="w-full max-w-md">
            {/* Item card */}
            <div className="bg-white rounded-2xl shadow overflow-hidden mb-4 border border-sage-light/30">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full object-contain max-h-56 bg-skyblue-pale" />
              ) : (
                <div className="w-full h-32 bg-skyblue-pale flex items-center justify-center text-5xl">🛒</div>
              )}
              <div className="px-4 py-3 border-t border-sage-light/20">
                <h2 className="font-semibold text-wood text-lg">{item.name}</h2>
                <p className="text-sm text-sage-mid">How much does this cost?</p>
              </div>
            </div>

            {!submitted ? (
              <div className="bg-white rounded-2xl shadow p-5 border border-sage-light/30">
                <div className="text-center mb-4">
                  <span className="text-4xl font-semibold text-wood">${guess}</span>
                </div>
                <input
                  type="range" min="0" max={maxPrice} step="1"
                  value={guess}
                  onChange={e => setGuess(Number(e.target.value))}
                  className="w-full mb-1 h-2 cursor-pointer accent-sage"
                />
                <div className="flex justify-between text-xs text-sage-mid mb-4">
                  <span>$0</span><span>${Math.round(maxPrice / 2)}</span><span>${maxPrice}</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-sm text-sage-mid whitespace-nowrap">Or type:</label>
                  <input
                    type="number" min="0" max={maxPrice}
                    value={guess}
                    onChange={e => setGuess(Math.min(maxPrice, Math.max(0, Number(e.target.value))))}
                    className="bg-sage-pale border border-sage-light rounded-xl px-3 py-2 w-28 text-center text-lg font-semibold text-wood focus:outline-none focus:ring-2 focus:ring-sage-light"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  className="w-full bg-sage hover:bg-sage-mid text-white font-semibold py-4 rounded-full text-base transition"
                >
                  Lock In My Guess 🔒
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow p-6 text-center border border-sage-light/30">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-base font-semibold text-wood">Guess locked in!</p>
                <p className="text-3xl font-semibold text-sage mt-1">${guess}</p>
                <p className="text-sm text-sage-mid mt-3">Waiting for the round to end…</p>
                {state.participants.length > 0 && (
                  <div className="mt-4 text-left">
                    <p className="text-xs text-sage-mid font-semibold mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {state.participants.map(p => (
                        <span key={p.name} className={`text-xs px-2 py-1 rounded-full font-medium border ${
                          p.hasGuessed
                            ? 'bg-sage-pale text-sage border-sage-light'
                            : 'bg-canvas text-sage-mid border-sage-light/30'
                        }`}>
                          {p.name} {p.hasGuessed ? '✓' : '…'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results
  if (phase === 'results') {
    const lastResult = state.itemResults?.[state.itemResults.length - 1];
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <HomeBar />
        <div className="bg-sage px-4 py-6 text-center">
          <h1 className="text-xl font-semibold text-white">Round Results</h1>
          {lastResult && <p className="text-sage-light text-sm mt-1">{lastResult.itemName} · Item {state.currentItemIndex + 1} of {state.totalItems}</p>}
        </div>
        <div className="flex flex-col items-center px-4 pb-8 -mt-3">
          <div className="w-full max-w-md">
            {lastResult && (
              <div className="bg-white rounded-2xl shadow overflow-hidden mb-4 border border-sage-light/30">
                {lastResult.imageUrl ? (
                <img src={lastResult.imageUrl} alt={lastResult.itemName} className="w-full object-contain max-h-40 bg-skyblue-pale" />
              ) : (
                <div className="w-full h-24 bg-skyblue-pale flex items-center justify-center text-4xl">🛒</div>
              )}
                <div className="px-4 py-3 flex items-center justify-between border-t border-sage-light/20">
                  <div>
                    <div className="font-semibold text-wood text-sm">{lastResult.itemName}</div>
                    <div className="text-xs text-sage-mid">Actual price</div>
                  </div>
                  <div className="text-2xl font-bold text-sage">${lastResult.price.toFixed(2)}</div>
                </div>
              </div>
            )}

            {lastResult?.guesses && (() => {
              // Sort participants by total score to assign trophies
              const sortedByTotal = [...state.participants].sort((a, b) => b.totalScore - a.totalScore);
              const totalRank = {};
              sortedByTotal.forEach((p, i) => { totalRank[p.name] = i; });
              const trophies = ['🥇', '🥈', '🥉'];
              const totalScoreMap = Object.fromEntries(state.participants.map(p => [p.name, p.totalScore]));

              return (
                <div className="bg-white rounded-2xl shadow p-5 mb-4 border border-sage-light/30">
                  <h3 className="text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Round Scores</h3>
                  <div className="space-y-2">
                    {lastResult.guesses.map((g, i) => {
                      const trophy = trophies[totalRank[g.name]];
                      const totalPts = totalScoreMap[g.name] ?? 0;
                      return (
                        <div key={g.name} className={`flex items-center gap-2 p-2 rounded-xl ${g.name === playerName ? 'bg-skyblue-pale' : ''}`}>
                          <span className="text-sage-mid text-xs w-4 shrink-0">{i + 1}</span>
                          <span className="text-base w-5 shrink-0">{trophy || ''}</span>
                          <span className="flex-1 font-semibold text-wood text-sm min-w-0 truncate">
                            {g.name}{g.name === playerName ? ' (you)' : ''}
                          </span>
                          <span className="text-xs text-sage-mid shrink-0">${g.guess}</span>
                          <div className="text-right shrink-0">
                            <div className={`font-bold text-sm ${g.score === 100 ? 'text-sage' : g.score >= 60 ? 'text-wood-mid' : 'text-red-400'}`}>
                              +{g.score} pts
                            </div>
                            <div className="text-xs text-sage-mid">{totalPts} total</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <p className="text-center text-sm text-sage-mid">Waiting for host to continue…</p>
          </div>
        </div>
      </div>
    );
  }

  // Leaderboard (auto-shown after each round)
  if (phase === 'leaderboard') {
    const lastResult = state.itemResults?.[state.itemResults.length - 1];
    const sortedByTotal = [...state.participants].sort((a, b) => b.totalScore - a.totalScore);
    const totalRank = Object.fromEntries(sortedByTotal.map((p, i) => [p.name, i]));
    const trophies = ['🥇', '🥈', '🥉'];
    const totalScoreMap = Object.fromEntries(state.participants.map(p => [p.name, p.totalScore]));

    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <HomeBar />
        <div className="bg-sage px-4 py-6 text-center">
          <h1 className="text-xl font-semibold text-white">Leaderboard</h1>
          <p className="text-sage-light text-sm mt-1">After item {state.currentItemIndex + 1} of {state.totalItems}</p>
        </div>
        <div className="flex flex-col items-center px-4 py-6 -mt-3">
          <div className="w-full max-w-md space-y-4">

            {/* Last item round scores */}
            {lastResult?.guesses && (
              <div className="bg-white rounded-2xl shadow p-5 border border-sage-light/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-wood-mid uppercase tracking-wide">Last Item — {lastResult.itemName}</h3>
                  <span className="text-sm font-bold text-sage">${lastResult.price.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  {lastResult.guesses.map((g, i) => {
                    const trophy = trophies[totalRank[g.name]];
                    const totalPts = totalScoreMap[g.name] ?? 0;
                    return (
                      <div key={g.name} className={`flex items-center gap-2 p-2 rounded-xl ${g.name === playerName ? 'bg-skyblue-pale' : ''}`}>
                        <span className="text-sage-mid text-xs w-4 shrink-0">{i + 1}</span>
                        <span className="text-base w-5 shrink-0">{trophy || ''}</span>
                        <span className="flex-1 font-semibold text-wood text-sm min-w-0 truncate">
                          {g.name}{g.name === playerName ? ' (you)' : ''}
                        </span>
                        <span className="text-xs text-sage-mid shrink-0">${g.guess}</span>
                        <div className="text-right shrink-0">
                          <div className={`font-bold text-sm ${g.score === 100 ? 'text-sage' : g.score >= 60 ? 'text-wood-mid' : 'text-red-400'}`}>
                            +{g.score} pts
                          </div>
                          <div className="text-xs text-sage-mid">{totalPts} total</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Overall standings */}
            <Leaderboard participants={state.participants} playerName={playerName} />
            <p className="text-center text-sm text-sage-mid">Waiting for the next round…</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
