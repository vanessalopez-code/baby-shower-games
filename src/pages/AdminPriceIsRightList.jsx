import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function AdminPriceIsRightList() {
  const { api, adminGet } = useGame();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  if (sessionStorage.getItem('adminAuthed') !== 'yes') {
    return <Navigate to="/admin" replace />;
  }

  const fetchGames = useCallback(async () => {
    try {
      const data = await adminGet('/admin/games');
      setGames(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [adminGet]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const handleCreate = async e => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await api('/admin/games', { name: newName.trim() });
    setCreating(false);
    if (res.ok) {
      setNewName('');
      setShowCreate(false);
      navigate(`/admin/price-is-right/${res.game.id}`);
    }
  };

  const handleArchive = async (gameId) => {
    if (!confirm('Archive this game? Players won\'t be able to join it.')) return;
    await api(`/admin/games/${gameId}/archive`, {});
    fetchGames();
  };

  const handleUnarchive = async (gameId) => {
    await api(`/admin/games/${gameId}/unarchive`, {});
    fetchGames();
  };

  const logout = () => {
    sessionStorage.removeItem('adminAuthed');
    navigate('/');
  };

  const activeGames = games.filter(g => g.status === 'active');
  const archivedGames = games.filter(g => g.status === 'archived');

  const phaseLabel = phase => {
    if (phase === 'lobby') return { label: 'Lobby', cls: 'bg-wood-pale text-wood-mid border-wood-light/40' };
    if (phase === 'active') return { label: '🟢 Live', cls: 'bg-sage-pale text-sage border-sage-light' };
    if (phase === 'leaderboard') return { label: 'Leaderboard', cls: 'bg-skyblue-pale text-skyblue border-skyblue-light' };
    return { label: phase, cls: 'bg-canvas text-sage-mid border-sage-light/30' };
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* Top bar */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-sage-light/30">
        <div>
          <div className="font-semibold text-wood text-base">Price Is Right</div>
          <div className="text-xs text-sage-mid">Admin — Games</div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => navigate('/')} className="text-sm text-wood-light hover:text-wood-mid transition">Home</button>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-500 transition">Logout</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* Create game */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-sage hover:bg-sage-mid text-white font-semibold py-4 rounded-2xl text-base transition flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span> Create New Game
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
            <div className="bg-sage px-5 py-3">
              <h2 className="text-white font-semibold text-base">New Game</h2>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-wood-mid uppercase tracking-wide mb-2">Game Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Baby Shower 2026"
                  autoFocus
                  className="w-full bg-sage-pale border border-sage-light rounded-xl px-4 py-3 text-wood placeholder-sage-mid focus:outline-none focus:ring-2 focus:ring-sage-light"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="flex-1 bg-sage hover:bg-sage-mid disabled:opacity-40 text-white font-semibold py-3 rounded-full transition"
                >
                  {creating ? 'Creating…' : 'Create & Set Up'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); }}
                  className="px-5 py-3 rounded-full border border-sage-light text-sage-mid hover:bg-canvas transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active games */}
        <div>
          <h2 className="text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Active Games</h2>
          {loading ? (
            <div className="text-center py-10 text-sage-mid text-sm">Loading…</div>
          ) : activeGames.length === 0 ? (
            <div className="bg-white rounded-2xl shadow border border-sage-light/30 p-8 text-center">
              <div className="text-3xl mb-2">🎮</div>
              <p className="text-wood font-semibold mb-1">No active games</p>
              <p className="text-sage-mid text-sm">Create one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGames.map(g => {
                const { label, cls } = phaseLabel(g.phase);
                return (
                  <div key={g.id} className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-wood text-base truncate">{g.name}</div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cls}`}>{label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full border border-sage-light/30 text-sage-mid">
                            {g.itemCount} item{g.itemCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full border border-sage-light/30 text-sage-mid">
                            {g.participantCount} player{g.participantCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-sage-light/20">
                      <button
                        onClick={() => navigate(`/admin/price-is-right/${g.id}`)}
                        className="flex-1 py-2.5 text-sm font-semibold text-sage hover:bg-sage-pale transition text-center"
                      >
                        Manage →
                      </button>
                      <button
                        onClick={() => handleArchive(g.id)}
                        className="px-4 py-2.5 text-sm text-wood-light hover:text-red-400 hover:bg-red-50 border-l border-sage-light/20 transition"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Archived games */}
        {archivedGames.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Archived</h2>
            <div className="space-y-2">
              {archivedGames.map(g => (
                <div key={g.id} className="bg-white rounded-2xl border border-sage-light/20 p-4 flex items-center gap-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-wood text-sm truncate">{g.name}</div>
                    <div className="text-xs text-sage-mid">{g.itemCount} items · {g.participantCount} players</div>
                  </div>
                  <button
                    onClick={() => handleUnarchive(g.id)}
                    className="text-xs text-sage border border-sage-light px-3 py-1.5 rounded-full hover:bg-sage-pale transition shrink-0"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
