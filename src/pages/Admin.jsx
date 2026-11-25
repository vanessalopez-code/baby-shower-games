import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

const ADMIN_PASSWORD = 'Bob';

export default function Admin() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('adminAuthed') === 'yes');
  const navigate = useNavigate();

  if (authed) {
    return <Navigate to="/admin/price-is-right" replace />;
  }

  const handleLogin = e => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuthed', 'yes');
      setAuthed(true);
    } else {
      setError('Incorrect password.');
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm border border-sage-light/30">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-sage-pale flex items-center justify-center text-2xl mx-auto mb-3">⚙️</div>
          <h1 className="text-xl font-semibold text-wood">Admin Login</h1>
        </div>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Password"
            className="w-full bg-sage-pale border border-sage-light rounded-xl px-4 py-3 text-lg text-wood placeholder-sage-mid focus:outline-none focus:ring-2 focus:ring-sage-light mb-3"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full bg-sage hover:bg-sage-mid text-white font-semibold py-3 rounded-full text-base transition"
          >
            Enter
          </button>
        </form>
        <button onClick={() => navigate('/')} className="mt-4 w-full text-sm text-wood-light hover:text-wood-mid transition">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
