import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const FUTURE_GAMES = [
  { name: 'Baby Name Scramble', emoji: '🔤', coming: true },
  { name: 'Nursery Rhyme Quiz', emoji: '📖', coming: true },
  { name: 'Diaper Derby', emoji: '🍼', coming: true },
];

export default function Home() {
  const { playerName, joinGame, availableGames } = useGame();
  const [nameInput, setNameInput] = useState(playerName || '');
  const [joined, setJoined] = useState(!!playerName);
  const navigate = useNavigate();

  const handleJoin = e => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    joinGame(nameInput.trim());
    setJoined(true);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full bg-sage px-4 py-6 text-center -mx-4 -mt-10 mb-8 shadow-sm"
           style={{ marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem', width: 'calc(100% + 2rem)' }}>
        <div className="text-4xl mb-2">👶</div>
        <h1 className="text-2xl font-semibold text-white">Baby Shower Games</h1>
        <p className="text-sage-light text-sm mt-1">Welcome to the party!</p>
      </div>

      {!joined ? (
        <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow p-6 w-full max-w-sm mb-8 border border-sage-light/30">
          <label className="block text-xs font-semibold text-wood-mid uppercase tracking-wide mb-2">What's your name?</label>
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-sage-pale border border-sage-light rounded-xl px-4 py-3 text-lg text-wood focus:outline-none focus:ring-2 focus:ring-sage-light mb-4 placeholder-sage-mid"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-sage hover:bg-sage-mid text-white font-semibold py-3 rounded-full text-base transition"
          >
            Join the Party
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-2xl shadow px-6 py-3 mb-8 border border-sage-light/30">
          <span className="text-wood font-semibold">Playing as </span>
          <span className="text-sage font-bold">{playerName}</span>
          &nbsp;
          <button onClick={() => setJoined(false)} className="text-xs text-wood-light underline ml-1">change</button>
        </div>
      )}

      <div className="w-full max-w-md space-y-3">
        <h2 className="text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Choose a Game</h2>

        {/* Price Is Right */}
        <button
          onClick={() => joined && navigate('/game/price-is-right')}
          className={`w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 text-left transition border border-sage-light/30 ${!joined ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:border-sage-mid cursor-pointer'}`}
        >
          <div className="w-12 h-12 rounded-xl bg-sage-pale flex items-center justify-center text-2xl flex-shrink-0">💰</div>
          <div>
            <div className="font-semibold text-wood text-base">Price Is Right</div>
            <div className="text-sm text-sage-mid">Guess the price of baby items!</div>
            {availableGames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {availableGames.some(g => g.phase === 'active') && (
                  <span className="inline-block bg-sage-pale text-sage text-xs font-semibold px-2 py-0.5 rounded-full border border-sage-light">🟢 Live now</span>
                )}
                <span className="inline-block bg-wood-pale text-wood-mid text-xs font-semibold px-2 py-0.5 rounded-full border border-wood-light/40">
                  {availableGames.length} game{availableGames.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Future games */}
        {FUTURE_GAMES.map(g => (
          <div key={g.name} className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 opacity-50 cursor-not-allowed border border-sage-light/20">
            <div className="w-12 h-12 rounded-xl bg-wood-pale flex items-center justify-center text-2xl flex-shrink-0">{g.emoji}</div>
            <div>
              <div className="font-semibold text-wood text-base">{g.name}</div>
              <span className="inline-block bg-wood-pale text-wood-mid text-xs font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/admin')}
        className="mt-12 text-xs text-wood-light hover:text-wood-mid transition"
      >
        Admin ⚙️
      </button>
    </div>
  );
}
