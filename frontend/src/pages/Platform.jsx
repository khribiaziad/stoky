import { useState, useEffect, useRef } from 'react';
import {
  Store, Users, CheckCircle, XCircle, Clock, AlertTriangle,
  Edit2, X, ChevronDown, Search, Plus, LogOut, Trash2, RefreshCw, Save,
} from 'lucide-react';
import {
  getPlatformStats, getPlatformGrowth, getPlatformStores, createPlatformStore,
  updateStoreStatus, updateStoreSubscription, updateStoreNotes, resetStorePassword,
  getStorePayments, addStorePayment, deletePayment, deleteStore, importStoreExcel,
  getPlatformSettings, savePlatformSetting,
} from '../api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PLAN_STYLE = {
  free:    { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  monthly: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  annual:  { bg: 'rgba(0,212,143,0.15)',   color: '#00d48f' },
};
const STATUS_STYLE = {
  active:   { bg: 'rgba(0,212,143,0.12)',  color: '#00d48f' },
  inactive: { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8' },
  expired:  { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
};

function Badge({ label, style }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
      letterSpacing: '0.03em', textTransform: 'capitalize', background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Growth Chart (inline SVG bars) ────────────────────────────────────────────

function GrowthChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ flex: 1 }}>
        <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>New Stores / Month</div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>
      </div>
    );
  }

  // Show last 6 months
  const last6 = data.slice(-6);
  const maxVal = Math.max(...last6.map(d => d.count), 1);
  const barW = 28, gap = 12, padX = 16, padY = 12, chartH = 100;
  const totalW = last6.length * (barW + gap) - gap + padX * 2;

  return (
    <div className="card" style={{ flex: 1, maxWidth: 400 }}>
      <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>New Stores / Month</div>
      <div style={{ padding: '16px 20px' }}>
        <svg width="100%" height={120} viewBox={`0 0 ${totalW} ${chartH + padY * 2 + 20}`} style={{ overflow: 'visible' }}>
          {last6.map((d, i) => {
            const barH = Math.max((d.count / maxVal) * chartH, 4);
            const x = padX + i * (barW + gap);
            const y = padY + chartH - barH;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH} rx={5}
                  fill="var(--accent)" opacity={0.85} />
                {d.count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                    fill="var(--text-muted)" fontSize={10}>{d.count}</text>
                )}
                <text x={x + barW / 2} y={padY + chartH + 16} textAnchor="middle"
                  fill="var(--text-muted)" fontSize={10}>{MONTHS[d.month - 1]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Top Stores ────────────────────────────────────────────────────────────────

function TopStores({ stores, onSelect }) {
  const top = [...stores].sort((a, b) => b.order_count - a.order_count).slice(0, 5);
  const maxOrders = Math.max(...top.map(s => s.order_count), 1);

  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>Top Stores by Orders</div>
      <div style={{ padding: '8px 0' }}>
        {top.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No stores yet</div>
        ) : top.map((store, i) => (
          <div key={store.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card-2)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
            onClick={() => onSelect(store)}
          >
            <div style={{ width: 22, fontSize: 13, fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)', textAlign: 'center' }}>
              {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.store_name}</div>
              <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${(store.order_count / maxOrders) * 100}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{store.order_count} orders</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create Store Modal ────────────────────────────────────────────────────────

function CreateStoreModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', store_name: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await createPlatformStore(form);
      onCreated(res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create store');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create Store</div>
          <button className="btn-icon" onClick={onClose}><X size={16} strokeWidth={1.75} /></button>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Store Name</label>
            <input className="form-input" value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} placeholder="My Store" />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={saving || !form.username || !form.store_name || !form.password}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Store Drawer ──────────────────────────────────────────────────────────────

function StoreDrawer({ store, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('overview');
  const [sub, setSub] = useState(store.subscription);
  const [notes, setNotes] = useState(store.subscription.notes || '');
  const [needsRenewal, setNeedsRenewal] = useState(store.subscription.needs_renewal || false);
  const [payments, setPayments] = useState([]);
  const [loadingPay, setLoadingPay] = useState(false);
  const [newPay, setNewPay] = useState({ amount: '', plan: sub.plan, note: '', date: new Date().toISOString().slice(0, 10) });
  const [settings, setSettings] = useState({ price_monthly: '', price_annual: '' });
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [storeApproved, setStoreApproved] = useState(store.is_approved);
  const [savingSub, setSavingSub] = useState(false);
  const notesTimer = useRef(null);

  const days = daysUntil(sub.end_date);

  useEffect(() => {
    if (tab === 'payments' && payments.length === 0) {
      setLoadingPay(true);
      getStorePayments(store.id).then(r => setPayments(r.data)).finally(() => setLoadingPay(false));
    }
    if (tab === 'settings') {
      getPlatformSettings().then(r => setSettings({ price_monthly: r.data.price_monthly || '', price_annual: r.data.price_annual || '' }));
    }
  }, [tab]);

  const handleSubSave = async () => {
    setSavingSub(true);
    try {
      await updateStoreSubscription(store.id, {
        plan: sub.plan, status: sub.status,
        start_date: sub.start_date ? new Date(sub.start_date).toISOString() : null,
        end_date: sub.end_date ? new Date(sub.end_date).toISOString() : null,
      });
      onUpdate(store.id, { subscription: sub });
    } finally { setSavingSub(false); }
  };

  const handleNotesBlur = () => {
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      updateStoreNotes(store.id, { notes, needs_renewal: needsRenewal });
      onUpdate(store.id, { subscription: { ...sub, notes, needs_renewal: needsRenewal } });
    }, 300);
  };

  const handleToggle = async () => {
    setTogglingStatus(true);
    try {
      await updateStoreStatus(store.id, !storeApproved);
      setStoreApproved(v => !v);
      onUpdate(store.id, { is_approved: !storeApproved });
    } finally { setTogglingStatus(false); }
  };

  const handleResetPassword = async () => {
    if (!newPwd || newPwd.length < 6) return;
    setResetting(true);
    try {
      await resetStorePassword(store.id, newPwd);
      setNewPwd('');
      alert('Password reset successfully');
    } finally { setResetting(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${store.store_name}" and ALL its data? This cannot be undone.`)) return;
    await deleteStore(store.id);
    onDelete(store.id);
  };

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importStoreExcel(store.id, file);
      setImportResult(res.data);
    } catch (err) {
      setImportResult({ error: err.response?.data?.detail || 'Import failed' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleAddPayment = async () => {
    if (!newPay.amount) return;
    const res = await addStorePayment(store.id, { ...newPay, amount: parseFloat(newPay.amount), date: new Date(newPay.date).toISOString() });
    setPayments(p => [res.data, ...p]);
    setNewPay({ amount: '', plan: sub.plan, note: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handleDeletePayment = async (id) => {
    await deletePayment(id);
    setPayments(p => p.filter(x => x.id !== id));
  };

  const handleSaveSettings = async () => {
    await Promise.all([
      savePlatformSetting('price_monthly', settings.price_monthly),
      savePlatformSetting('price_annual', settings.price_annual),
    ]);
    alert('Pricing saved');
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)', zIndex: 201,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{store.store_name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{store.username} · joined {fmt(store.created_at)}</div>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={16} strokeWidth={1.75} /></button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {['overview', 'payments', 'settings'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                textTransform: 'capitalize',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <>
              {/* Expiry warning */}
              {days !== null && days <= 30 && (
                <div style={{ background: days <= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${days <= 7 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={16} style={{ color: days <= 7 ? '#f87171' : '#f59e0b', flexShrink: 0 }} strokeWidth={1.75} />
                  <span style={{ fontSize: 13, color: days <= 7 ? '#f87171' : '#f59e0b' }}>
                    {days <= 0 ? 'Subscription expired' : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}

              {/* Subscription */}
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Subscription</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Plan</label>
                    <div style={{ position: 'relative' }}>
                      <select className="form-input" value={sub.plan} onChange={e => setSub(s => ({ ...s, plan: e.target.value }))}>
                        <option value="free">Free</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                      <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Status</label>
                    <div style={{ position: 'relative' }}>
                      <select className="form-input" value={sub.status} onChange={e => setSub(s => ({ ...s, status: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="expired">Expired</option>
                      </select>
                      <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start Date</label>
                    <input className="form-input" type="date" value={sub.start_date ? sub.start_date.slice(0,10) : ''} onChange={e => setSub(s => ({ ...s, start_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">End Date</label>
                    <input className="form-input" type="date" value={sub.end_date ? sub.end_date.slice(0,10) : ''} onChange={e => setSub(s => ({ ...s, end_date: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={handleSubSave} disabled={savingSub}>
                  {savingSub ? 'Saving…' : 'Save Subscription'}
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{store.order_count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total Orders</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{store.last_order_at ? fmt(store.last_order_at) : '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last Order</div>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Internal Notes</label>
                <textarea className="form-input" rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="VIP client, special pricing, etc."
                  style={{ resize: 'vertical' }} />
              </div>

              {/* Needs renewal toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Needs Renewal</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Flag this store for follow-up</div>
                </div>
                <button onClick={() => { setNeedsRenewal(v => !v); setTimeout(handleNotesBlur, 10); }}
                  style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: needsRenewal ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s', position: 'relative' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: needsRenewal ? 21 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className={`btn btn-sm ${storeApproved ? 'btn-danger' : 'btn-primary'}`}
                  style={{ width: '100%' }}
                  onClick={handleToggle}
                  disabled={togglingStatus}
                >
                  {togglingStatus ? '…' : storeApproved ? 'Suspend Store' : 'Activate Store'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" type="password" value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="New password (min 6 chars)" style={{ flex: 1 }} />
                  <button className="btn btn-secondary btn-sm" onClick={handleResetPassword}
                    disabled={resetting || newPwd.length < 6} style={{ whiteSpace: 'nowrap' }}>
                    <RefreshCw size={13} strokeWidth={1.75} />
                    {resetting ? '…' : 'Reset'}
                  </button>
                </div>
                <button className="btn btn-danger btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={handleDelete}>
                  <Trash2 size={13} strokeWidth={1.75} /> Delete Store & All Data
                </button>

                {/* Excel import */}
                <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImportExcel} />
                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}
                  onClick={() => importRef.current.click()} disabled={importing}>
                  {importing ? '⏳ Importing…' : '📥 Import Excel (Orders)'}
                </button>
                {importResult && (
                  <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--card-2)', border: `1px solid ${importResult.error ? '#f87171' : '#4ade8044'}` }}>
                    {importResult.error ? (
                      <span style={{ color: '#f87171' }}>{importResult.error}</span>
                    ) : (
                      <>
                        <div style={{ color: '#4ade80' }}>✓ {importResult.created_orders} orders imported</div>
                        <div style={{ color: 'var(--t2)' }}>{importResult.skipped_orders} skipped (already exist)</div>
                        <div style={{ color: 'var(--t2)' }}>{importResult.products_created} products created</div>
                        {importResult.unmatched_product_names > 0 && (
                          <div style={{ color: '#fbbf24' }}>⚠ {importResult.unmatched_product_names} unrecognized product names</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── PAYMENTS TAB ── */}
          {tab === 'payments' && (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Log Payment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Amount (MAD)</label>
                    <input className="form-input" type="number" value={newPay.amount} onChange={e => setNewPay(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Plan</label>
                    <div style={{ position: 'relative' }}>
                      <select className="form-input" value={newPay.plan} onChange={e => setNewPay(p => ({ ...p, plan: e.target.value }))}>
                        <option value="free">Free</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                      <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={newPay.date} onChange={e => setNewPay(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Note (optional)</label>
                  <input className="form-input" value={newPay.note} onChange={e => setNewPay(p => ({ ...p, note: e.target.value }))} placeholder="e.g. Bank transfer" />
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddPayment} disabled={!newPay.amount}>
                  <Plus size={13} strokeWidth={1.75} /> Add Payment
                </button>
              </div>

              {loadingPay ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>Loading…</div>
              ) : payments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>No payments yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {payments.map(p => (
                    <div key={p.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{p.amount} MAD</span>
                          {p.plan && <Badge label={p.plan} style={PLAN_STYLE[p.plan] || PLAN_STYLE.free} />}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {fmt(p.date)}{p.note ? ` · ${p.note}` : ''}
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => handleDeletePayment(p.id)} style={{ color: '#f87171' }}>
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === 'settings' && (
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Global Pricing</div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Monthly Plan Price (MAD)</label>
                <input className="form-input" type="number" value={settings.price_monthly}
                  onChange={e => setSettings(s => ({ ...s, price_monthly: e.target.value }))} placeholder="e.g. 99" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Annual Plan Price (MAD)</label>
                <input className="form-input" type="number" value={settings.price_annual}
                  onChange={e => setSettings(s => ({ ...s, price_annual: e.target.value }))} placeholder="e.g. 999" />
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleSaveSettings} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={13} strokeWidth={1.75} /> Save Pricing
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── Main Platform Page ────────────────────────────────────────────────────────

export default function Platform({ onLogout }) {
  const [stats, setStats] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedStore, setSelectedStore] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, gRes, stRes] = await Promise.all([getPlatformStats(), getPlatformGrowth(), getPlatformStores()]);
      setStats(sRes.data);
      setGrowth(gRes.data);
      setStores(stRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStoreUpdate = (storeId, changes) => {
    setStores(prev => prev.map(s => s.id === storeId ? { ...s, ...changes, subscription: { ...s.subscription, ...(changes.subscription || {}) } } : s));
    if (selectedStore?.id === storeId) {
      setSelectedStore(prev => ({ ...prev, ...changes, subscription: { ...prev.subscription, ...(changes.subscription || {}) } }));
    }
    // Refresh stats
    getPlatformStats().then(r => setStats(r.data));
  };

  const handleStoreCreated = () => { load(); };

  const handleStoreDelete = (storeId) => {
    setStores(prev => prev.filter(s => s.id !== storeId));
    setSelectedStore(null);
    getPlatformStats().then(r => setStats(r.data));
  };

  const now = new Date();
  const filtered = stores.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.store_name.toLowerCase().includes(q) && !s.username.toLowerCase().includes(q)) return false;
    if (filter === 'active')   return s.is_approved && s.subscription.status === 'active';
    if (filter === 'suspended') return !s.is_approved;
    if (filter === 'expired')  return s.subscription.status === 'expired';
    if (filter === 'expiring') {
      if (!s.subscription.end_date) return false;
      const d = Math.ceil((new Date(s.subscription.end_date) - now) / 86400000);
      return d >= 0 && d <= 30;
    }
    if (filter === 'renewal')  return s.subscription.needs_renewal;
    return true;
  });

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Platform</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Manage all stores and subscriptions</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCreate(true)}>
            <Plus size={14} strokeWidth={1.75} /> New Store
          </button>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={onLogout}>
            <LogOut size={14} strokeWidth={1.75} /> Sign Out
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon={Store}         label="Total Stores"   value={stats.total}     color="#60a5fa" />
          <StatCard icon={CheckCircle}   label="Active"          value={stats.active}    color="#00d48f" />
          <StatCard icon={XCircle}       label="Suspended"       value={stats.suspended} color="#f87171" />
          <StatCard icon={AlertTriangle} label="Expiring Soon"   value={stats.expiring}  color="#f59e0b" />
          <StatCard icon={Clock}         label="Expired"         value={stats.expired}   color="#94a3b8" />
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <GrowthChart data={growth} />
        <TopStores stores={stores} onSelect={setSelectedStore} />
      </div>

      {/* Stores table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: '0 0 auto' }}>Stores</div>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} strokeWidth={1.75} />
            <input className="form-input" style={{ paddingLeft: 32, height: 34, fontSize: 13 }}
              placeholder="Search stores…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <select className="form-input" style={{ height: 34, fontSize: 13, paddingRight: 28 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="renewal">Needs Renewal</option>
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No stores found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Store', 'Username', 'Plan', 'Sub Status', 'End Date', 'Orders', 'Store Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(store => {
                  const d = daysUntil(store.subscription.end_date);
                  const expiring = d !== null && d <= 30 && d >= 0;
                  return (
                    <tr key={store.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                        background: store.subscription.needs_renewal ? 'rgba(245,158,11,0.04)' : '' }}
                      onClick={() => setSelectedStore(store)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = store.subscription.needs_renewal ? 'rgba(245,158,11,0.04)' : ''}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{store.store_name}</div>
                        {store.subscription.needs_renewal && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚑ Needs renewal</div>}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>@{store.username}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge label={store.subscription.plan} style={PLAN_STYLE[store.subscription.plan] || PLAN_STYLE.free} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge label={store.subscription.status} style={STATUS_STYLE[store.subscription.status] || STATUS_STYLE.inactive} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: expiring ? '#f59e0b' : 'var(--text-muted)' }}>
                        {fmt(store.subscription.end_date)}
                        {expiring && <span style={{ fontSize: 11, marginLeft: 6 }}>({d}d)</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{store.order_count}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge label={store.is_approved ? 'Active' : 'Suspended'} style={store.is_approved ? STATUS_STYLE.active : STATUS_STYLE.expired} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedStore && (
        <StoreDrawer
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onUpdate={handleStoreUpdate}
          onDelete={handleStoreDelete}
        />
      )}

      {/* Create store modal */}
      {showCreate && (
        <CreateStoreModal
          onClose={() => setShowCreate(false)}
          onCreated={handleStoreCreated}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
