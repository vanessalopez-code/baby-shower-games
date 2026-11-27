import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function AdminPriceIsRight() {
  const { api, API_URL, state } = useGame();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', imageUrl: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [timerMode, setTimerMode] = useState(() => localStorage.getItem('bs_timerMode') || 'auto');
  const [globalMinutes, setGlobalMinutes] = useState(() => Number(localStorage.getItem('bs_globalMinutes')) || 1);
  const [maxPrice, setMaxPrice] = useState(() => Number(localStorage.getItem('bs_maxPrice')) || 500);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const fetchItems = useCallback(async () => {
    const secret = sessionStorage.getItem('adminSecret') || '';
    const res = await fetch(`${API_URL}/admin/items`, { headers: { 'x-admin-secret': secret } });
    const data = await res.json();
    setItems(data);
  }, [API_URL]);

  const fetchSettings = useCallback(async () => {
    const secret = sessionStorage.getItem('adminSecret') || '';
    const res = await fetch(`${API_URL}/admin/settings`, { headers: { 'x-admin-secret': secret } });
    if (!res.ok) return;
    const data = await res.json();
    setTimerMode(data.timerMode || 'auto');
    setGlobalMinutes(data.globalTimer ? Math.max(1, Math.round(data.globalTimer / 60)) : 1);
    if (data.maxPrice) setMaxPrice(data.maxPrice);
  }, [API_URL]);

  useEffect(() => {
    fetchItems();
    fetchSettings();
  }, [fetchItems, fetchSettings]);

  // Auth guard — must come after all hooks
  if (sessionStorage.getItem('adminAuthed') !== 'yes') {
    return <Navigate to="/admin" replace />;
  }

  const saveSettings = async () => {
    localStorage.setItem('bs_timerMode', timerMode);
    localStorage.setItem('bs_globalMinutes', String(globalMinutes));
    localStorage.setItem('bs_maxPrice', String(maxPrice));
    try {
      await api('/admin/settings', {
        timerMode,
        globalTimer: timerMode === 'auto' ? globalMinutes * 60 : null,
        maxPrice,
      });
    } catch {}
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
    if (!form.name || !form.price) {
      setMsg('Please fill in item name and price.');
      return;
    }
    await api('/admin/items', {
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
    await fetch(`${API_URL}/admin/items/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const handleStartGame = async () => {
    await saveSettings();
    const res = await api('/admin/start-round', {});
    if (res.error) setMsg(res.error);
  };

  const handleNextRound = async () => {
    const res = await api('/admin/start-round', {});
    if (res.error) setMsg(res.error);
  };

  const handleCloseGuessing = async () => {
    await api('/admin/end-round', {});
  };

  const handleShowLeaderboard = async () => {
    await api('/admin/show-leaderboard', {});
  };

  const handleReset = async () => {
    if (!confirm('Reset everything? This clears all items and scores.')) return;
    await api('/admin/reset', {});
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
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setItems(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
    await fetch(`${API_URL}/admin/reorder-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(i => i.id) }),
    });
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const phase = state?.phase;
  const currentItemIndex = state?.currentItemIndex ?? -1;
  const participants = state?.participants ?? [];
  const gameActive = phase && phase !== 'lobby';

  const logout = () => {
    sessionStorage.removeItem('adminAuthed');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      {/* Top bar */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-sage-light/30">
        <div>
          <div className="font-semibold text-wood text-base">Price Is Right</div>
          <div className="text-xs text-sage-mid">Admin</div>
        </div>
        <div className="flex gap-3 items-center">
          {participants.length > 0 && (
            <span className="text-xs text-sage-mid">{participants.length} joined</span>
          )}
          <button onClick={() => navigate('/')} className="text-sm text-wood-light hover:text-wood-mid transition">Home</button>
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
                >
                  Auto
                </button>
                <button
                  onClick={() => setTimerMode('manual')}
                  className={`flex-1 py-2.5 text-sm font-semibold transition border-l border-sage-light ${timerMode === 'manual' ? 'bg-sage text-white' : 'bg-canvas text-sage-mid hover:bg-sage-pale'}`}
                >
                  Manual
                </button>
              </div>
              {timerMode === 'auto' ? (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-wood whitespace-nowrap">Minutes per item:</label>
                  <input
                    type="number" min="1" max="10"
                    value={globalMinutes}
                    onChange={e => setGlobalMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-sage-pale border border-sage-light rounded-xl px-3 py-2 text-wood text-center font-semibold focus:outline-none focus:ring-2 focus:ring-sage-light"
                  />
                  <span className="text-xs text-sage-mid">({globalMinutes * 60}s — closes automatically)</span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-sage-mid">You'll click <strong className="text-wood">Close Guessing</strong> manually for each item.</p>
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

            {/* Round controls (shown while game is running) */}
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
                  {phase === 'results' && currentItemIndex + 1 < items.length && (
                    <button onClick={handleNextRound} className="bg-sage-pale hover:bg-sage-light text-sage border border-sage-light px-4 py-2 rounded-xl font-semibold text-sm transition">
                      ▶ Next Item
                    </button>
                  )}
                  {phase === 'results' && (
                    <button onClick={handleShowLeaderboard} className="bg-skyblue-pale hover:bg-skyblue-light/40 text-skyblue border border-skyblue-light px-4 py-2 rounded-xl font-semibold text-sm transition">
                      🏆 Show Leaderboard
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
              >
                Save Settings
              </button>
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
          </div>
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

        {/* ── ITEMS LIST with drag + drop ── */}
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
