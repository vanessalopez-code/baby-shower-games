import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function GameSelectPriceIsRight() {
  const { availableGames, playerName } = useGame();
  const navigate = useNavigate();

  if (!playerName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <p className="text-wood mb-4">Enter your name on the home screen first.</p>
          <button onClick={() => navigate('/')} className="bg-sage text-white px-6 py-2 rounded-full font-semibold">Go Home</button>
        </div>
      </div>
    );
  }

  const phaseLabel = phase => {
    if (phase === 'active') return { label: '🟢 Live now', cls: 'bg-sage-pale text-sage border-sage-light' };
    if (phase === 'leaderboard') return { label: 'Leaderboard', cls: 'bg-skyblue-pale text-skyblue border-skyblue-light' };
    return { label: 'Waiting to start', cls: 'bg-wood-pale text-wood-mid border-wood-light/40' };
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Header */}
      <div className="bg-sage px-4 py-6 text-center">
        <div className="text-3xl mb-1">💰</div>
        <h1 className="text-xl font-semibold text-white">Price Is Right</h1>
        <p className="text-sage-light text-sm mt-1">Choose a game to join</p>
      </div>

      <div className="flex flex-col items-center px-4 py-6">
        <div className="w-full max-w-md">

          {/* Player name bar */}
          <div className="bg-white rounded-2xl shadow px-4 py-3 mb-5 border border-sage-light/30 flex items-center justify-between">
            <span className="text-wood text-sm">Playing as <span className="font-semibold text-sage">{playerName}</span></span>
            <button onClick={() => navigate('/')} className="text-xs text-wood-light underline">change</button>
          </div>

          {availableGames.length === 0 ? (
            <div className="bg-white rounded-2xl shadow border border-sage-light/30 p-10 text-center">
              <div className="text-4xl mb-3">⏳</div>
              <p className="font-semibold text-wood mb-1">No games available yet</p>
              <p className="text-sage-mid text-sm">The host will create a game soon!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableGames.map(g => {
                const { label, cls } = phaseLabel(g.phase);
                return (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/game/price-is-right/${g.id}`)}
                    className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 text-left hover:shadow-md hover:border-sage-mid border border-sage-light/30 transition cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-sage-pale flex items-center justify-center text-2xl flex-shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-wood text-base truncate">{g.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cls}`}>{label}</span>
                        <span className="text-xs text-sage-mid">{g.participantCount} player{g.participantCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="text-sage-mid text-sm flex-shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={() => navigate('/')} className="mt-6 w-full text-sm text-wood-light hover:text-wood-mid transition text-center">
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
