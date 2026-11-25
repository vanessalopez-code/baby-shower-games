const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ participants, playerName }) {
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="bg-white rounded-2xl shadow p-5 border border-sage-light/30">
      <div className="text-center mb-5">
        <div className="text-4xl mb-1">🏆</div>
        <h2 className="text-xl font-semibold text-wood">Leaderboard</h2>
      </div>
      {sorted.length === 0 ? (
        <p className="text-center text-sage-mid">No scores yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((p, i) => (
            <div
              key={p.name}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                p.name === playerName
                  ? 'bg-skyblue-pale border border-skyblue-light'
                  : i === 0
                  ? 'bg-wood-pale border border-wood-light/40'
                  : 'bg-canvas border border-sage-light/20'
              }`}
            >
              <span className="text-xl w-8 text-center">{MEDALS[i] || `${i + 1}`}</span>
              <span className="flex-1 font-semibold text-wood">
                {p.name}{' '}
                {p.name === playerName && <span className="text-xs text-skyblue font-normal">(you)</span>}
              </span>
              <div className="text-right">
                <span className={`text-lg font-bold ${i === 0 ? 'text-wood-mid' : p.name === playerName ? 'text-skyblue' : 'text-sage'}`}>
                  {p.totalScore}
                </span>
                <span className="text-xs text-sage-mid ml-1">pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
