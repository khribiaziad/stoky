import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { getPlatformSettings, savePlatformSetting, changePassword } from '../../api';

export default function PlatformSettings() {
  const [pricing, setPricing] = useState({ price_monthly: '', price_annual: '' });
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMsg, setPricingMsg] = useState('');

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg]       = useState('');
  const [pwdErr, setPwdErr]       = useState('');

  useEffect(() => {
    getPlatformSettings().then(r => {
      setPricing({
        price_monthly: r.data.price_monthly || '',
        price_annual:  r.data.price_annual  || '',
      });
    });
  }, []);

  const handleSavePricing = async () => {
    setSavingPricing(true);
    setPricingMsg('');
    try {
      await Promise.all([
        savePlatformSetting('price_monthly', pricing.price_monthly),
        savePlatformSetting('price_annual',  pricing.price_annual),
      ]);
      setPricingMsg('Saved!');
      setTimeout(() => setPricingMsg(''), 2000);
    } finally { setSavingPricing(false); }
  };

  const handleSavePwd = async () => {
    setPwdErr(''); setPwdMsg('');
    if (!pwd.current || !pwd.next) { setPwdErr('All fields required'); return; }
    if (pwd.next !== pwd.confirm)  { setPwdErr('Passwords do not match'); return; }
    if (pwd.next.length < 6)       { setPwdErr('Password must be at least 6 characters'); return; }
    setSavingPwd(true);
    try {
      await changePassword({ current_password: pwd.current, new_password: pwd.next });
      setPwdMsg('Password updated!');
      setPwd({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwdMsg(''), 2000);
    } catch (e) {
      setPwdErr(e.response?.data?.detail || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Settings</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Platform-wide configuration</div>
      </div>

      {/* Pricing */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Subscription Pricing</div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Monthly Plan Price (MAD)</label>
            <input className="form-input" type="number" value={pricing.price_monthly}
              onChange={e => setPricing(p => ({ ...p, price_monthly: e.target.value }))} placeholder="e.g. 99" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Annual Plan Price (MAD)</label>
            <input className="form-input" type="number" value={pricing.price_annual}
              onChange={e => setPricing(p => ({ ...p, price_annual: e.target.value }))} placeholder="e.g. 999" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSavePricing} disabled={savingPricing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={13} strokeWidth={1.75} />
              {savingPricing ? 'Saving…' : 'Save Pricing'}
            </button>
            {pricingMsg && <span style={{ fontSize: 13, color: 'var(--accent)' }}>{pricingMsg}</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Change Password</div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pwdErr && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              {pwdErr}
            </div>
          )}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" value={pwd.current}
              onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} placeholder="Current password" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" value={pwd.next}
              onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} placeholder="Min 6 characters" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSavePwd} disabled={savingPwd}>
              {savingPwd ? 'Saving…' : 'Update Password'}
            </button>
            {pwdMsg && <span style={{ fontSize: 13, color: 'var(--accent)' }}>{pwdMsg}</span>}
          </div>
        </div>
      </div>

    </div>
  );
}
