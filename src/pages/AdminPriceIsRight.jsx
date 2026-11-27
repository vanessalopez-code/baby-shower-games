import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function AdminPriceIsRight() {
  const { gameId } = useParams();
  const { api, adminGet, API_URL, state } = useGame();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [gameInfo, setGameInfo] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', imageUrl: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [timerMode, setTimerMode] = useState('auto');
  const [globalSeconds, setGlobalSeconds] = useState(60);
  const [maxPrice, setMaxPrice] = useState(500);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [library, setLibrary] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedLibIds, setSelectedLibIds] = useState(new Set());
  const [libMsg, setLibMsg] = useState('');

  if (sessionStorage.getItem('adminAuthed') !== 'yes') {
    return <Navigate to="/admin" replace />;
  }

  const fetchItems = useCallback(async () => {
    const data = await adminGet(`/admin/games/${gameId}/items`);
    setItems(Array.isArray(data) ? data : []);
  }, [adminGet, gameId]);

  const fetchSettings = useCallback(async () => {
    const data = await adminGet(`/admin/games/${gameId}/settings`);
    if (!data?.timerMode) return;
    setTimerMode(data.timerMode || 'auto');
    if (data.globalTimer) setGlobalSeconds(data.globalTimer);
    if (data.maxPrice) setMaxPrice(data.maxPrice);
  }, [adminGet, gameId]);

  const fetchGameInfo = useCallback(async () => {
    const data = await adminGet('/admin/games');
    const game = Array.isArray(data) ? data.find(g => g.id === gameId) : null;
    setGameInfo(game);
  }, [adminGet, gameId]);

  const fetchLibrary = useCallback(async () => {
    const data = await adminGet('/admin/library');
    setLibrary(Array.isArray(data) ? data : []);
  }, [adminGet]);

  useEffect(() => {
    fetchItems();
    fetchSettings();
    fetchGameInfo();
    fetchLibrary();
  }, [fetchItems, fetchSettings, fetchGameInfo, fetchLibrary]);

  // Use WebSocket state if it's for this game, else poll
  const gameState = state?.gameId === gameId ? state : null;
  const phase = gameState?.phase ?? gameInfo?.phase ?? 'lobby';
  const currentItemIndex = gameState?.currentItemIndex ?? -1;
  const participants = gameState?.participants ?? [];
  const gameActive = phase && phase !== 'lobby';

  const saveSettings = async () => {
    await api(`/admin/games/${gameId}/settings`, {
      timerMode,
      globalTimer: timerMode === 'auto' ? globalSeconds : null,
      maxPrice,
    });
  };

  const handleImageFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      setImagePreview(ev.target.result);
      setForm(f => ({ ...f, imageUrl: ev.target.result }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = async e => {
    e.preventDefault();
    if (!form.name || !form.price) { setMsg('Please fill in item name and price.'); return; }
    await api(`/admin/games/${gameId}/items`, {
      name: form.name,
      price: parseFloat(form.price),
      imageUrl: form.imageUrl || null,
    });
    setForm({ name: '', price: '', imageUrl: '' });
    setImagePreview('');
    setMsg('Item added!');
    fetchItems();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async id => {
    const secret = sessionStorage.getItem('adminSecret') || '';
    await fetch(`${API_URL}/admin/games/${gameId}/items/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret },
    });
    fetchItems();
  };

  const handleStartGame = async () => {
    await saveSettings();
    const res = await api(`/admin/games/${gameId}/start-round`, {});
    if (res.error) setMsg(res.error);
  };

  const handleNextRound = async () => {
    const res = await api(`/admin/games/${gameId}/start-round`, {});
    if (res.error) setMsg(res.error);
  };

  const handleCloseGuessing = async () => {
    await api(`/admin/games/${gameId}/end-round`, {});
  };

  const handleReset = async () => {
    if (!confirm('Reset this game? This clears all items and scores.')) return;
    await api(`/admin/games/${gameId}/reset`, {});
    fetchItems();
  };

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setItems(reordered);
    setDragIndex(null); setDragOverIndex(null);
    const secret = sessionStorage.getItem('adminSecret') || '';
    await fetch(`${API_URL}/admin/games/${gameId}/reorder-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ ids: reordered.map(i => i.id) }),
    });
  };

  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const handleSaveToLibrary = async (item) => {
    const res = await api('/admin/library', { name: item.name, price: item.price, imageUrl: item.imageUrl });
    if (res.ok) {
      fetchLibrary();
      setLibMsg(`"${item.name}" saved to library!`);
    } else {
      setLibMsg(res.error || 'Already in library');
    }
    setTimeout(() => setLibMsg(''), 2500);
  };

  const handleDeleteFromLibrary = async (id) => {
    await fetch(`${API_URL}/admin/library/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': sessionStorage.getItem('adminSecret') || '' },
    });
    fetchLibrary();
    setSelectedLibIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleAddFromLibrary = async () => {
    if (selectedLibIds.size === 0) return;
    const res = await api(`/admin/games/${gameId}/items/from-library`, { libraryItemIds: [...selectedLibIds] });
    if (res.ok) {
      setSelectedLibIds(new Set());
      fetchItems();
      setShowLibrary(false);
      setLibMsg(`${res.added.length} item${res.added.length !== 1 ? 's' : ''} added to game!`);
      setTimeout(() => setLibMsg(''), 2500);
    }
  };

  const toggleLibSelect = (id) => {
    setSelectedLibIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filteredLibrary = library.filter(i =>
    !librarySearch || i.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const logout = () => { sessionStorage.removeItem('adminAuthed'); navigate('/'); };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* Top bar */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-sage-light/30">
        <div>
          <div className="font-semibold text-wood text-base">
            {gameInfo?.name || 'Price Is Right'}
          </div>
          <div className="text-xs text-sage-mid">Admin · Price Is Right</div>
        </div>
        <div className="flex gap-3 items-center">
          {participants.length > 0 && (
            <span className="text-xs text-sage-mid">{participants.length} joined</span>
          )}
          <button onClick={() => navigate('/admin/price-is-right')} className="text-sm text-wood-light hover:text-wood-mid transition">← Games</button>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-500 transition">Logout</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* ── GAME SETTINGS ── */}
        <div className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
          <div className="bg-sage px-5 py-3">
            <h2 className="text-white font-semibold text-base">Game Settings</h2>
          </div>
          <div className="p-5 space-y-5">

            {/* Timer toggle */}
            <div>
              <label className="block text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Timer</label>
              <div className="flex rounded-xl overflow-hidden border border-sage-light">
                <button
                  onClick={() => setTimerMode('auto')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition ${timerMode === 'auto' ? 'bg-sage text-white' : 'bg-canvas text-sage-mid hover:bg-sage-pale'}`}
                >Auto</button>
                <button
                  onClick={() => setTimerMode('manual')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition border-l border-sage-light ${timerMode === 'manual' ? 'bg-sage text-white' : 'bg-canvas text-sage-mid hover:bg-sage-pale'}`}
                >Manual</button>
              </div>
              {timerMode === 'auto' ? (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-wood whitespace-nowrap">Seconds per item:</label>
                  <input
                    type="number" min="5" max="600"
                    value={globalSeconds}
                    onChange={e => setGlobalSeconds(Math.max(5, Number(e.target.value)))}
                    className="w-20 bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood text-center font-semibold focus:outline-none focus:ring-2 focus:ring-sage-light"
                  />
                  <span className="text-xs text-sage-mid">closes automatically</span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-sage-mid">You'll click <strong className="text-wood">Close Guessing</strong> manually.</p>
              )}
            </div>

            {/* Max price */}
            <div>
              <label className="block text-xs font-semibold text-wood-mid uppercase tracking-wide mb-3">Max Guess Price</label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-wood font-semibold">$</span>
                <input
                  type="number" min="1"
                  value={maxPrice}
                  onChange={e => setMaxPrice(Math.max(1, Number(e.target.value)))}
                  className="w-28 bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood text-center font-semibold focus:outline-none focus:ring-2 focus:ring-sage-light"
                />
                <span className="text-xs text-sage-mid">Players can guess $0 – ${maxPrice}</span>
              </div>
            </div>

            {/* Round controls */}
            {gameActive && (
              <div className="border-t border-sage-light/30 pt-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    phase === 'active'      ? 'bg-sage-pale text-sage border-sage-light' :
                    phase === 'results'     ? 'bg-wood-pale text-wood-mid border-wood-light/40' :
                    'bg-skyblue-pale text-skyblue border-skyblue-light'
                  }`}>{phase}</span>
                  <span className="px-3 py-1 bg-skyblue-pale text-skyblue border border-skyblue-light rounded-full text-xs font-semibold">
                    Item {currentItemIndex + 1} of {items.length}
                  </span>
                  <span className="px-3 py-1 bg-wood-pale text-wood-mid border border-wood-light/40 rounded-full text-xs font-semibold">
                    {participants.filter(p => p.hasGuessed).length}/{participants.length} guessed
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {phase === 'active' && timerMode === 'manual' && (
                    <button onClick={handleCloseGuessing} className="bg-wood-pale hover:bg-wood-light/30 text-wood-mid border border-wood-light/40 px-4 py-2 rounded-xl font-semibold text-sm transition">
                      ⏹ Close Guessing
                    </button>
                  )}
                  {(phase === 'results' || phase === 'leaderboard') && currentItemIndex + 1 < items.length && (
                    <button onClick={handleNextRound} className="bg-sage-pale hover:bg-sage-light text-sage border border-sage-light px-4 py-2 rounded-xl font-semibold text-sm transition">
                      ▶ Next Item
                    </button>
                  )}
                  <button onClick={handleReset} className="bg-red-50 hover:bg-red-100 text-red-400 border border-red-200 px-4 py-2 rounded-xl font-semibold text-sm transition">
                    🗑 Reset All
                  </button>
                </div>
              </div>
            )}

            {/* Save settings */}
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  try { await saveSettings(); } catch {}
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 2000);
                }}
                className="flex-1 bg-skyblue-pale hover:bg-skyblue-light/40 text-skyblue border border-skyblue-light font-semibold py-2.5 rounded-full text-sm transition"
              >Save Settings</button>
              {settingsSaved && <span className="text-sm text-sage font-medium">✓ Saved</span>}
            </div>

            {/* Start button */}
            {!gameActive && (
              <button
                onClick={handleStartGame}
                disabled={items.length === 0}
                className="w-full bg-sage hover:bg-sage-mid disabled:opacity-40 text-white font-semibold py-3.5 rounded-full text-base transition"
              >
                {items.length === 0 ? 'Add items below to start' : '▶  Start Game'}
              </button>
            )}
            {msg && <p className="text-sm text-red-400">{msg}</p>}
          </div>
        </div>

        {/* ── LIBRARY STATUS MSG ── */}
        {libMsg && (
          <div className="bg-sage-pale border border-sage-light text-sage text-sm font-medium px-4 py-2.5 rounded-xl text-center">{libMsg}</div>
        )}

        {/* ── BROWSE LIBRARY ── */}
        <div className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
          <button
            onClick={() => { setShowLibrary(v => !v); setLibrarySearch(''); setSelectedLibIds(new Set()); }}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-sage-pale transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📚</span>
              <div className="text-left">
                <div className="font-semibold text-wood text-sm">Browse Item Library</div>
                <div className="text-xs text-sage-mid">{library.length} saved item{library.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <span className="text-sage-mid text-sm">{showLibrary ? '▲' : '▼'}</span>
          </button>

          {showLibrary && (
            <div className="border-t border-sage-light/20 p-4 space-y-3">
              {library.length === 0 ? (
                <div className="text-center py-6 text-sage-mid text-sm">
                  <div className="text-3xl mb-2">📭</div>
                  No items saved yet. Use the <strong className="text-wood">💾</strong> button on any game item below to save it.
                </div>
              ) : (
                <>
                  <input
                    value={librarySearch}
                    onChange={e => setLibrarySearch(e.target.value)}
                    placeholder="Search library…"
                    className="w-full bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood placeholder-sage-mid focus:outline-none focus:ring-2 focus:ring-sage-light text-sm"
                  />

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredLibrary.map(item => {
                      const sel = selectedLibIds.has(item.id);
                      const alreadyInGame = items.some(i => i.name.toLowerCase() === item.name.toLowerCase());
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                            alreadyInGame ? 'opacity-40 cursor-not-allowed border-sage-light/20' :
                            sel ? 'bg-sage-pale border-sage-light' : 'border-sage-light/20 hover:bg-canvas'
                          }`}
                          onClick={() => !alreadyInGame && toggleLibSelect(item.id)}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                            alreadyInGame ? 'border-sage-light/30' :
                            sel ? 'bg-sage border-sage' : 'border-sage-light'
                          }`}>
                            {sel && !alreadyInGame && <span className="text-white text-xs font-bold">✓</span>}
                            {alreadyInGame && <span className="text-sage-mid text-xs">✓</span>}
                          </div>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-skyblue-pale flex items-center justify-center text-xl flex-shrink-0">🛒</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-wood text-sm truncate">{item.name}</div>
                            <div className="text-xs text-sage-mid">${parseFloat(item.price).toFixed(2)}</div>
                          </div>
                          {alreadyInGame && <span className="text-xs text-sage-mid shrink-0">In game</span>}
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteFromLibrary(item.id); }}
                            className="text-red-200 hover:text-red-400 text-sm transition flex-shrink-0 ml-1"
                            title="Remove from library"
                          >✕</button>
                        </div>
                      );
                    })}
                    {filteredLibrary.length === 0 && (
                      <p className="text-center text-sage-mid text-sm py-4">No matches</p>
                    )}
                  </div>

                  {selectedLibIds.size > 0 && (
                    <button
                      onClick={handleAddFromLibrary}
                      className="w-full bg-sage hover:bg-sage-mid text-white font-semibold py-3 rounded-full text-sm transition"
                    >
                      + Add {selectedLibIds.size} item{selectedLibIds.size !== 1 ? 's' : ''} to Game
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── ADD BABY ITEMS ── */}
        <div className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
          <div className="bg-sage px-5 py-3">
            <h2 className="text-white font-semibold text-base">Add Baby Items</h2>
          </div>
          <div className="p-5">
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="block text-xs text-sage-mid mb-1">Item Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Baby Monitor"
                  className="w-full bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood placeholder-sage-mid focus:outline-none focus:ring-2 focus:ring-sage-light text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-sage-mid mb-1">Price ($)</label>
                <input
                  type="number" min="0" max="9999" step="0.01"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood placeholder-sage-mid focus:outline-none focus:ring-2 focus:ring-sage-light text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-sage-mid mb-1">Item Image <span className="text-wood-light">(optional)</span></label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-sage-light rounded-xl cursor-pointer hover:bg-sage-pale transition overflow-hidden bg-canvas">
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <div className="text-2xl mb-1">📷</div>
                      <div className="text-xs text-sage-mid">Tap to upload from device</div>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                </label>
              </div>
              {msg && <p className={`text-sm ${msg === 'Item added!' ? 'text-sage' : 'text-red-400'}`}>{msg}</p>}
              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-sage hover:bg-sage-mid disabled:opacity-50 text-white font-semibold py-3 rounded-full text-sm transition"
              >
                + Add Item
              </button>
            </form>
          </div>
        </div>

        {/* ── ITEMS LIST ── */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl shadow border border-sage-light/30 overflow-hidden">
            <div className="px-5 py-3 border-b border-sage-light/20 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-wood-mid uppercase tracking-wide">Item Order ({items.length})</h2>
              <span className="text-xs text-sage-mid">Drag to reorder</span>
            </div>
            <div className="divide-y divide-sage-light/20">
              {items.map((item, i) => {
                const isDone = i < currentItemIndex;
                const isCurrent = i === currentItemIndex;
                const draggable = !isDone && !isCurrent;
                return (
                  <div
                    key={item.id}
                    draggable={draggable}
                    onDragStart={draggable ? e => handleDragStart(e, i) : undefined}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={e => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-4 py-3 transition ${
                      isCurrent ? 'bg-sage-pale' :
                      dragOverIndex === i && dragIndex !== i ? 'bg-skyblue-pale' :
                      dragIndex === i ? 'opacity-40' : ''
                    }`}
                  >
                    <div className={`text-lg select-none leading-none ${draggable ? 'cursor-grab active:cursor-grabbing text-sage-light' : 'text-canvas'}`}>⠿</div>
                    <span className="text-sage-mid font-mono text-xs w-4 flex-shrink-0">{i + 1}</span>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-skyblue-pale flex items-center justify-center text-xl flex-shrink-0">🛒</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-wood text-sm truncate">{item.name}</div>
                      <div className="text-xs text-sage-mid">${parseFloat(item.price).toFixed(2)}</div>
                    </div>
                    {isCurrent && <span className="text-xs bg-sage-pale text-sage border border-sage-light px-2 py-0.5 rounded-full flex-shrink-0">Current</span>}
                    {isDone && <span className="text-xs text-sage-mid border border-sage-light/30 px-2 py-0.5 rounded-full flex-shrink-0">Done</span>}
                    {/* Save to Library */}
                    {library.some(l => l.name.toLowerCase() === item.name.toLowerCase()) ? (
                      <span className="text-xs text-sage-mid flex-shrink-0" title="Already in library">📚</span>
                    ) : (
                      <button
                        onClick={() => handleSaveToLibrary(item)}
                        className="text-sage-mid hover:text-sage text-sm transition flex-shrink-0"
                        title="Save to Library"
                      >💾</button>
                    )}
                    {draggable && (
                      <button onClick={() => handleDelete(item.id)} className="text-red-300 hover:text-red-500 text-sm transition flex-shrink-0">✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
