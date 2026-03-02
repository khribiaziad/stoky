import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { login, register, googleLogin as googleLoginApi } from '../api';

const GOOGLE_CLIENT_ID = '10012394157-7dbqola147563ak63qcogb92i59d0kh0.apps.googleusercontent.com';

function GoogleButton({ onSuccess, onError }) {
  const signIn = useGoogleLogin({
    onSuccess,
    onError,
    scope: 'email profile',
  });

  return (
    <button
      type="button"
      onClick={() => signIn()}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '11px 0', background: '#fff', border: 'none',
        borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#1f1f1f',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      Continue with Google
    </button>
  );
}

function LoginInner({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', store_name: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await googleLoginApi({ access_token: tokenResponse.access_token });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onAuth(res.data.user);
    } catch (e) {
      setError(e.response?.data?.detail || 'Google sign-in failed');
    }
    setLoading(false);
  };

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
      if (!e.response) {
        setError('Cannot reach server — make sure the backend is running on port 8000');
      } else {
        setError(e.response.data?.detail || `Error ${e.response.status}: ${e.response.statusText}`);
      }
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

          {mode === 'login' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: '#2d3248' }} />
                <span style={{ color: '#8892b0', fontSize: 12 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#2d3248' }} />
              </div>
              <GoogleButton
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login({ onAuth }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LoginInner onAuth={onAuth} />
    </GoogleOAuthProvider>
  );
}
