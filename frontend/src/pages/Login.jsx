import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { login, register, googleLogin as googleLoginApi, forgotPassword, resetPassword } from '../api';

const GOOGLE_CLIENT_ID = '10012394157-7dbqola147563ak63qcogb92i59d0kh0.apps.googleusercontent.com';

function GoogleButton({ onSuccess, onError }) {
  const signIn = useGoogleLogin({ onSuccess, onError, scope: 'email profile' });
  return (
    <button type="button" onClick={() => signIn()}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 0', background: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#1f1f1f' }}>
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </button>
  );
}

function LoginInner({ onAuth }) {
  const urlToken     = new URLSearchParams(window.location.search).get('token');
  const isResetRoute = window.location.pathname === '/reset-password' && urlToken;

  const [mode, setMode]       = useState(isResetRoute ? 'reset' : 'login');
  const [form, setForm]       = useState({ username: '', store_name: '', email: '', whatsapp: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');

  const f  = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const go = (m)    => { setMode(m); setError(''); setSuccess(''); };

  const handleGoogleSuccess = async (tokenResponse) => {
    setError(''); setLoading(true);
    try {
      const res = await googleLoginApi({ access_token: tokenResponse.access_token });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onAuth(res.data.user);
    } catch (e) { setError(e.response?.data?.detail || 'Google sign-in failed'); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        const res = await login({ username: form.username, password: form.password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onAuth(res.data.user);
      } else {
        const res = await register({ username: form.username, store_name: form.store_name, email: form.email, whatsapp: form.whatsapp, password: form.password });
        if (res.data.pending) { setSuccess(res.data.message); setMode('pending'); }
      }
    } catch (e) {
      setError(!e.response ? 'Cannot reach server' : e.response.data?.detail || `Error ${e.response.status}`);
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    setError(''); setLoading(true);
    try { const res = await forgotPassword({ email: forgotEmail }); setSuccess(res.data.message); }
    catch (e) { setError(e.response?.data?.detail || 'Something went wrong'); }
    setLoading(false);
  };

  const handleReset = async () => {
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      const res = await resetPassword({ token: urlToken, new_password: newPw });
      setSuccess(res.data.message);
      setTimeout(() => { window.history.replaceState({}, '', '/'); go('login'); }, 2000);
    } catch (e) { setError(e.response?.data?.detail || 'Invalid or expired link'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c14' }}>
      <div style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: '#7c6ef5' }}>STOCKY</div>
          <div style={{ color: '#8892b0', fontSize: 13, marginTop: 6 }}>Inventory Management</div>
        </div>

        <div className="card">
          {/* Tabs */}
          {(mode === 'login' || mode === 'register') && (
            <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #2d3248' }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => go(m)}
                  style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', color: mode === m ? '#7c6ef5' : '#8892b0', borderBottom: mode === m ? '2px solid #7c6ef5' : '2px solid transparent', cursor: 'pointer', fontWeight: mode === m ? 600 : 400, fontSize: 14 }}>
                  {m === 'login' ? 'Sign In' : 'Create Store'}
                </button>
              ))}
            </div>
          )}

          {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

          {/* ── Sign In ── */}
          {mode === 'login' && <>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" placeholder="your_username" value={form.username} autoFocus
                onChange={e => f('username', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" style={{ paddingRight: 40 }}
                  value={form.password} onChange={e => f('password', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', fontSize: 16 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
              <button onClick={() => go('forgot')} style={{ background: 'none', border: 'none', color: '#7c6ef5', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                Forgot password?
              </button>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px 0', fontSize: 15 }} onClick={handleSubmit} disabled={loading}>
              {loading ? '...' : 'Sign In'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: '#2d3248' }} />
              <span style={{ color: '#8892b0', fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#2d3248' }} />
            </div>
            <GoogleButton onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} />
          </>}

          {/* ── Create Store ── */}
          {mode === 'register' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="form-label">Username</label>
                <input className="form-input" placeholder="your_username" value={form.username} onChange={e => f('username', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Store Name</label>
                <input className="form-input" placeholder="My Store" value={form.store_name} onChange={e => f('store_name', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => f('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <input className="form-input" placeholder="+212600000000" value={form.whatsapp} onChange={e => f('whatsapp', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" style={{ paddingRight: 40 }}
                  value={form.password} onChange={e => f('password', e.target.value)} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8892b0', fontSize: 16 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px 0', fontSize: 15 }} onClick={handleSubmit} disabled={loading}>
              {loading ? '...' : 'Create Store'}
            </button>
          </>}

          {/* ── Pending Approval ── */}
          {mode === 'pending' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Account pending approval</div>
              <div style={{ fontSize: 13, color: '#8892b0', lineHeight: 1.7 }}>
                We'll review your request and contact you via email or WhatsApp shortly.
              </div>
              <button onClick={() => go('login')} style={{ marginTop: 20, background: 'none', border: 'none', color: '#7c6ef5', fontSize: 13, cursor: 'pointer' }}>
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && <>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Reset your password</div>
            <div style={{ fontSize: 13, color: '#8892b0', marginBottom: 20 }}>
              Enter the email linked to your account and we'll send you a reset link.
            </div>
            {!success && <>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={forgotEmail} autoFocus
                  onChange={e => setForgotEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgot()} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px 0' }} onClick={handleForgot} disabled={loading}>
                {loading ? '...' : 'Send Reset Link'}
              </button>
            </>}
            <button onClick={() => go('login')} style={{ marginTop: 16, background: 'none', border: 'none', color: '#7c6ef5', fontSize: 12, cursor: 'pointer', display: 'block' }}>
              Back to Sign In
            </button>
          </>}

          {/* ── Reset Password ── */}
          {mode === 'reset' && <>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Set a new password</div>
            {!success && <>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={newPw} autoFocus onChange={e => setNewPw(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px 0' }} onClick={handleReset} disabled={loading}>
                {loading ? '...' : 'Reset Password'}
              </button>
            </>}
          </>}

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
