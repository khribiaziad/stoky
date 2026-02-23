import { useState } from 'react';
import { login, register } from '../api';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', store_name: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await login({ username: form.username, password: form.password })
        : await register({ username: form.username, store_name: form.store_name, password: form.password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onAuth(res.data.user);
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0c14',
    }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: '#7c6ef5' }}>STOCKY</div>
          <div style={{ color: '#8892b0', fontSize: 13, marginTop: 6 }}>Inventory Management</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #2d3248' }}>
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '10px 0', background: 'none', border: 'none',
                  color: mode === m ? '#7c6ef5' : '#8892b0',
                  borderBottom: mode === m ? '2px solid #7c6ef5' : '2px solid transparent',
                  cursor: 'pointer', fontWeight: mode === m ? 600 : 400, fontSize: 14,
                  textTransform: 'capitalize',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Store'}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              placeholder="your_username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input
                className="form-input"
                placeholder="e.g. Headz Store"
                value={form.store_name}
                onChange={e => setForm({ ...form, store_name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                style={{ paddingRight: 40 }}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', fontSize: 16,
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '12px 0', fontSize: 15, textAlign: 'center' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Store'}
          </button>
        </div>
      </div>
    </div>
  );
}
