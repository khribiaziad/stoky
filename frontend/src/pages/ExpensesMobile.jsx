import { useState, useEffect } from 'react';
import { Receipt, ArrowDownCircle, Trash2, Edit2, Power, Megaphone, Users, LayoutGrid } from 'lucide-react';
import {
  getFixedExpenses, createFixedExpense, updateFixedExpense,
  toggleFixedExpense, deleteFixedExpense,
  getWithdrawals, createWithdrawal, deleteWithdrawal,
  getAdPlatforms, getSetting, getTeam,
} from '../api';

// ── Catalogues ───────────────────────────────────────────────
const CATEGORIES = [
  { key: 'operations',  label: 'Operations',      color: '#60a5fa', hint: 'Rent, electricity, internet, phone' },
  { key: 'packaging',   label: 'Packaging',        color: '#34d399', hint: 'Boxes, bags, bubble wrap, tape, labels' },
  { key: 'platform',    label: 'Platform Fees',    color: '#a78bfa', hint: 'Caleo, Shopify, marketplace commissions' },
  { key: 'software',    label: 'Software & Tools', color: '#fbbf24', hint: 'Design tools, accounting software' },
  { key: 'equipment',   label: 'Equipment',        color: '#f87171', hint: 'Laptops, printers, label machines' },
  { key: 'legal',       label: 'Legal & Admin',    color: '#fb923c', hint: 'Registration, licenses, accounting fees' },
  { key: 'marketing',   label: 'Marketing',        color: '#e879f9', hint: 'Other marketing not tracked in Ads' },
  { key: 'other',       label: 'Other',            color: '#8892b0', hint: 'Anything else' },
];

const TYPES = [
  { key: 'monthly',   label: 'Monthly',   badge: 'badge-blue',   hint: 'Repeats every month' },
  { key: 'annual',    label: 'Annual',    badge: 'badge-purple', hint: 'Repeats every year' },
  { key: 'per_order', label: 'Per Order', badge: 'badge-green',  hint: 'Cost per delivered order' },
  { key: 'one_time',  label: 'One-time',  badge: 'badge-yellow', hint: 'Purchased once' },
];

const CAT  = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
const TYPE = Object.fromEntries(TYPES.map(t => [t.key, t]));

// ── Helpers ──────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = n => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const monthEnd   = new Date();

const overlapDays = (start, end, from, to) => {
  const s = new Date(Math.max(new Date(start), from));
  const e = new Date(Math.min(end ? new Date(end) : new Date(), to));
  if (e <= s) return 0;
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
};

const platformSpend = (platform, usdRate, from, to) =>
  platform.campaigns.reduce((sum, c) => {
    const days = overlapDays(c.start_date, c.end_date, from, to);
    return sum + days * c.daily_rate_usd * usdRate;
  }, 0);

const platformAllTime = (platform, usdRate) =>
  platform.campaigns.reduce((sum, c) => {
    const days = overlapDays(c.start_date, c.end_date, new Date('2000-01-01'), new Date());
    return sum + days * c.daily_rate_usd * usdRate;
  }, 0);

const emptyExpense = () => ({
  name: '', type: 'monthly', category: 'operations',
  amount: '', description: '', start_date: todayStr(),
});

// ── Component ─────────────────────────────────────────────────
export default function ExpensesMobile() {
  const [tab, setTab] = useState('overview');

  // Data
  const [expenses,    setExpenses]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [platforms,   setPlatforms]   = useState([]);
  const [team,        setTeam]        = useState([]);
  const [usdRate,     setUsdRate]     = useState(10);

  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Fixed expense filters
  const [filterType,   setFilterType]   = useState('all');
  const [filterCat,    setFilterCat]    = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [search,       setSearch]       = useState('');

  // Accordion state for Fixed tab
  const [expandedExpense, setExpandedExpense] = useState(null);

  // Modals
  const [showExpenseModal,   setShowExpenseModal]   = useState(false);
  const [editingExpense,     setEditingExpense]     = useState(null);
  const [expenseForm,        setExpenseForm]        = useState(emptyExpense());
  const [showAddWithdrawal,  setShowAddWithdrawal]  = useState(false);
  const [withdrawalForm,     setWithdrawalForm]     = useState({ amount: '', description: '', date: todayStr() });

  const load = () => {
    getFixedExpenses().then(r => setExpenses(r.data));
    getWithdrawals().then(r => setWithdrawals(r.data));
    getAdPlatforms().then(r => setPlatforms(r.data));
    getTeam().then(r => setTeam(r.data));
    getSetting('usd_rate').catch(() => ({ data: { value: '10' } }))
      .then(r => setUsdRate(parseFloat(r.data?.value || '10') || 10));
  };

  useEffect(() => { load(); }, []);

  // ── Expense CRUD ──────────────────────────────────────────
  const openNew  = () => { setEditingExpense(null); setExpenseForm(emptyExpense()); setError(''); setShowExpenseModal(true); };
  const openEdit = (e) => {
    setEditingExpense(e);
    setExpenseForm({ name: e.name, type: e.type, category: e.category || 'other', amount: String(e.amount), description: e.description || '', start_date: e.start_date ? e.start_date.slice(0,10) : todayStr() });
    setError('');
    setShowExpenseModal(true);
  };

  const saveExpense = async () => {
    setError('');
    if (!expenseForm.name.trim()) { setError('Name is required'); return; }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { setError('Enter a valid amount'); return; }
    const payload = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
    try {
      editingExpense ? await updateFixedExpense(editingExpense.id, payload) : await createFixedExpense(payload);
      setSuccess(editingExpense ? 'Expense updated' : 'Expense added');
      setShowExpenseModal(false);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error saving expense'); }
  };

  const handleToggle        = async (id) => { try { await toggleFixedExpense(id); load(); } catch (e) { setError('Error'); } };
  const handleDeleteExpense = async (id) => { if (!confirm('Delete this expense?')) return; try { await deleteFixedExpense(id); load(); } catch (e) { setError('Error'); } };

  // ── Withdrawal CRUD ───────────────────────────────────────
  const handleAddWithdrawal = async () => {
    setError('');
    if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) <= 0) { setError('Enter a valid amount'); return; }
    try {
      await createWithdrawal({ ...withdrawalForm, amount: parseFloat(withdrawalForm.amount) });
      setSuccess('Withdrawal recorded');
      setShowAddWithdrawal(false);
      setWithdrawalForm({ amount: '', description: '', date: todayStr() });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const handleDeleteWithdrawal = async (id) => { if (!confirm('Delete?')) return; try { await deleteWithdrawal(id); load(); } catch (e) { setError('Error'); } };

  const exportExpensesCSV = () => {
    const rows = [
      ['Name', 'Category', 'Type', 'Amount (MAD)', 'Status', 'Start Date', 'Description'],
      ...filtered.map(e => [
        e.name,
        (CAT[e.category] || CAT.other).label,
        (TYPE[e.type] || TYPE.monthly).label,
        e.amount,
        e.is_active ? 'Active' : 'Paused',
        e.start_date ? new Date(e.start_date).toLocaleDateString() : '',
        e.description || '',
      ]),
    ];
    downloadCSV(rows, `expenses_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Calculations ──────────────────────────────────────────
  const active = expenses.filter(e => e.is_active);

  const fixedMonthly  = active.filter(e => e.type === 'monthly').reduce((s,e) => s + e.amount, 0);
  const fixedAnnual   = active.filter(e => e.type === 'annual').reduce((s,e) => s + e.amount / 12, 0);
  const fixedPerOrder = active.filter(e => e.type === 'per_order').reduce((s,e) => s + e.amount, 0);
  const fixedOneTime  = expenses.filter(e => e.type === 'one_time').reduce((s,e) => s + e.amount, 0);

  const teamMonthly  = team.filter(m => m.payment_type === 'monthly' || m.payment_type === 'both').reduce((s,m) => s + (m.fixed_monthly || 0), 0);
  const teamPerOrder = team.filter(m => m.payment_type === 'per_order' || m.payment_type === 'both').reduce((s,m) => s + (m.per_order_rate || 0), 0);

  const adsThisMonth = platforms.reduce((s,p) => s + platformSpend(p, usdRate, monthStart, monthEnd), 0);
  const adsAllTime   = platforms.reduce((s,p) => s + platformAllTime(p, usdRate), 0);

  const totalMonthlyBurn = fixedMonthly + fixedAnnual + teamMonthly + adsThisMonth;
  const totalPerOrder    = fixedPerOrder + teamPerOrder;

  const withdrawalTotal = withdrawals.reduce((s,w) => s + w.amount, 0);
  const manualTotal     = withdrawals.filter(w => w.type === 'manual').reduce((s,w) => s + w.amount, 0);
  const stockTotal      = withdrawals.filter(w => w.type === 'stock_purchase').reduce((s,w) => s + w.amount, 0);

  // Filtered expenses for Fixed tab
  const filtered = expenses.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterCat  !== 'all' && e.category !== filterCat) return false;
    if (filterStatus === 'active' && !e.is_active) return false;
    if (filterStatus === 'inactive' && e.is_active) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Shared mobile styles ──────────────────────────────────
  const S = {
    card: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
    },
    pill: (color) => ({
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 20,
      background: color + '22',
      color: color,
      border: `1px solid ${color}44`,
      display: 'inline-flex',
      alignItems: 'center',
    }),
    statCard: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      flex: '1 1 calc(50% - 5px)',
      minWidth: 0,
    },
    statLabel: {
      fontSize: 11,
      color: '#8892b0',
      marginBottom: 3,
      fontWeight: 500,
    },
    statValue: {
      fontSize: 17,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    statSub: {
      fontSize: 10,
      color: '#8892b0',
      marginTop: 3,
    },
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'fixed'       && <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={openNew}>+ Add</button>}
          {tab === 'withdrawals' && <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => { setShowAddWithdrawal(true); setError(''); }}>+ Add</button>}
        </div>
      </div>

      {/* ── Alerts ── */}
      {error   && (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          {error}
          <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 10 }}>
          {success}
          <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* ── Summary stats 2×2 grid ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={S.statCard}>
          <div style={S.statLabel}>Monthly Burn Rate</div>
          <div style={S.statValue}>{fmt(totalMonthlyBurn)} <span style={{ fontSize: 12, color: '#8892b0', fontWeight: 400 }}>MAD</span></div>
          <div style={S.statSub}>fixed + ads + team</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Per Order Cost</div>
          <div style={S.statValue}>{fmt(totalPerOrder)} <span style={{ fontSize: 12, color: '#8892b0', fontWeight: 400 }}>MAD</span></div>
          <div style={S.statSub}>expenses + commissions</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Ad Spend (This Month)</div>
          <div style={{ ...S.statValue, color: '#a78bfa' }}>{fmt(adsThisMonth)} <span style={{ fontSize: 12, color: '#8892b0', fontWeight: 400 }}>MAD</span></div>
          <div style={S.statSub}>{platforms.length} platform{platforms.length !== 1 ? 's' : ''} · {fmt(adsAllTime)} all time</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Total Withdrawals</div>
          <div style={{ ...S.statValue, color: '#f87171' }}>{fmt(withdrawalTotal)} <span style={{ fontSize: 12, color: '#8892b0', fontWeight: 400 }}>MAD</span></div>
          <div style={S.statSub}>{fmt(manualTotal)} manual · {fmt(stockTotal)} stock</div>
        </div>
      </div>

      {/* ── Tabs — horizontal scrollable ── */}
      <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'overview',     label: 'Overview',     count: null },
          { key: 'fixed',        label: 'Fixed',        count: expenses.length },
          { key: 'ads',          label: 'Ad Spend',     count: platforms.length },
          { key: 'team',         label: 'Team',         count: team.length },
          { key: 'withdrawals',  label: 'Withdrawals',  count: withdrawals.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '10px 14px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? 'var(--accent)' : '#8892b0',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.count !== null && (
              <span style={{ fontSize: 10, background: '#2d3248', borderRadius: 10, padding: '1px 6px', color: '#8892b0' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          OVERVIEW TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Monthly cost breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Monthly Cost Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {active.filter(e => e.type === 'monthly' || e.type === 'annual').map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                  <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>{(CAT[e.category] || CAT.other).label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                    {fmt(e.type === 'annual' ? e.amount / 12 : e.amount)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD/mo</span>
                  </span>
                </div>
              ))}

              {team.filter(m => m.payment_type === 'monthly' || m.payment_type === 'both').map(m => (
                <div key={`team-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>Team</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{fmt(m.fixed_monthly)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD/mo</span></span>
                </div>
              ))}

              {platforms.map(p => {
                const spend = platformSpend(p, usdRate, monthStart, monthEnd);
                if (spend === 0) return null;
                return (
                  <div key={`ad-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>Ads</span>
                    <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{fmt(spend)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD</span></span>
                  </div>
                );
              })}

              <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(totalMonthlyBurn)} MAD / month</span>
              </div>
            </div>
          </div>

          {/* Per-order cost breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Per Order Cost Breakdown</div>
            {active.filter(e => e.type === 'per_order').length === 0 && team.filter(m => m.payment_type === 'per_order' || m.payment_type === 'both').length === 0 ? (
              <div style={{ color: '#8892b0', fontSize: 13 }}>No per-order costs configured yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {active.filter(e => e.type === 'per_order').map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>{(CAT[e.category] || CAT.other).label}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{fmt(e.amount)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD/order</span></span>
                  </div>
                ))}
                {team.filter(m => m.payment_type === 'per_order' || m.payment_type === 'both').map(m => (
                  <div key={`team-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>Team</span>
                    <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{fmt(m.per_order_rate)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD/order</span></span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(totalPerOrder)} MAD / order</span>
                </div>
              </div>
            )}
          </div>

          {/* One-time investments */}
          {expenses.filter(e => e.type === 'one_time').length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>One-time Investments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expenses.filter(e => e.type === 'one_time').map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>{e.start_date ? new Date(e.start_date).toLocaleDateString() : ''}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{fmt(e.amount)} <span style={{ fontSize: 10, color: '#8892b0' }}>MAD</span></span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(fixedOneTime)} MAD total</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FIXED EXPENSES TAB — accordion cards
         ══════════════════════════════════════════════════════ */}
      {tab === 'fixed' && (
        <>
          {/* Filters — stacked vertically, full width */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              placeholder="Search expenses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
            <select className="form-input" style={{ width: '100%' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Paused only</option>
            </select>
            <select className="form-input" style={{ width: '100%' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select className="form-input" style={{ width: '100%' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }} onClick={exportExpensesCSV}>
              ⬇ Export CSV
            </button>
          </div>

          {/* Accordion cards */}
          {filtered.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Receipt size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>{expenses.length === 0 ? 'No expenses yet' : 'No results'}</h3>
                <p>{expenses.length === 0 ? 'Track every recurring and one-time cost' : 'Try adjusting the filters'}</p>
              </div>
            </div>
          ) : (
            filtered.map(e => {
              const cat  = CAT[e.category]  || CAT.other;
              const type = TYPE[e.type] || TYPE.monthly;
              const isOpen = expandedExpense === e.id;
              const amountSuffix = e.type === 'monthly' ? '/mo' : e.type === 'annual' ? '/yr' : e.type === 'per_order' ? '/order' : '';

              return (
                <div key={e.id} style={{ ...S.card, opacity: e.is_active ? 1 : 0.6 }}>
                  {/* Collapsed header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedExpense(isOpen ? null : e.id)}
                  >
                    {/* Category color dot */}
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />

                    {/* Name */}
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}
                    </span>

                    {/* Amount badge */}
                    <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0, color: cat.color }}>
                      {fmt(e.amount)} MAD{amountSuffix}
                    </span>

                    {/* Status */}
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                      background: e.is_active ? '#0d2a1e' : '#2d3248',
                      color: e.is_active ? '#00d48f' : '#8892b0',
                    }}>
                      {e.is_active ? 'Active' : 'Paused'}
                    </span>

                    {/* Chevron */}
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }} onClick={e2 => e2.stopPropagation()}>
                      {/* Details row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <span className={`badge ${type.badge}`}>{type.label}</span>
                        <span style={S.pill(cat.color)}>{cat.label}</span>
                        {e.start_date && (
                          <span style={{ fontSize: 12, color: '#8892b0', alignSelf: 'center' }}>
                            Since {new Date(e.start_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {e.description && (
                        <div style={{ fontSize: 13, color: '#8892b0', marginBottom: 12 }}>{e.description}</div>
                      )}

                      {/* Action buttons row */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleToggle(e.id)}
                          style={{
                            flex: 1, minHeight: 38, fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: `1px solid ${e.is_active ? '#00d48f55' : '#2d3248'}`,
                            background: e.is_active ? '#0d2a1e' : '#2d3248',
                            color: e.is_active ? '#00d48f' : '#8892b0',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}
                        >
                          <Power size={12} /> {e.is_active ? 'Active' : 'Paused'}
                        </button>
                        <button
                          onClick={() => openEdit(e)}
                          style={{
                            flex: 1, minHeight: 38, fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--text)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          style={{
                            flex: 1, minHeight: 38, fontSize: 12, fontWeight: 600, borderRadius: 8,
                            border: '1px solid #f8717144', background: 'transparent',
                            color: '#f87171', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          AD SPEND TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {platforms.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Megaphone size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>No platforms added</h3>
                <p>Go to the Ads page to add your ad platforms</p>
              </div>
            </div>
          ) : platforms.map(p => {
            const thisMonth = platformSpend(p, usdRate, monthStart, monthEnd);
            const allTime   = platformAllTime(p, usdRate);
            const running   = p.campaigns.find(c => !c.end_date);
            return (
              <div key={p.id} style={{ ...S.card, borderTop: `3px solid ${p.color}` }}>
                {/* Platform header */}
                <div style={{ padding: '14px 14px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{p.label}</span>
                  </div>
                  {running ? (
                    <div style={{ fontSize: 12, color: '#00d48f', marginBottom: 8 }}>
                      Running · ${running.daily_rate_usd}/day ({fmt(running.daily_rate_usd * usdRate)} MAD)
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 8 }}>No active campaign</div>
                  )}

                  {/* Spend summary */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>This month</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: p.color }}>{fmt(thisMonth)} MAD</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>All time</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(allTime)} MAD</div>
                    </div>
                  </div>
                </div>

                {/* Campaign cards */}
                {p.campaigns.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, color: '#8892b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Campaigns</div>
                    {p.campaigns.map(c => {
                      const days = overlapDays(c.start_date, c.end_date, new Date('2000-01-01'), new Date());
                      const isRunning = !c.end_date;
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 8, padding: '9px 11px', border: '1px solid var(--border)' }}>
                          {/* Status badge */}
                          {isRunning
                            ? <span className="badge badge-green" style={{ flexShrink: 0, fontSize: 10 }}>Running</span>
                            : <span className="badge badge-gray" style={{ flexShrink: 0, fontSize: 10 }}>Ended</span>
                          }
                          {/* Dates */}
                          <span style={{ fontSize: 12, color: '#8892b0', flexShrink: 0 }}>
                            {c.start_date.slice(0, 10)} → {c.end_date ? c.end_date.slice(0, 10) : <span style={{ color: '#00d48f' }}>Today</span>}
                          </span>
                          {/* Rate */}
                          <span style={{ fontSize: 12, color: '#60a5fa', flexShrink: 0 }}>${c.daily_rate_usd}/day</span>
                          {/* Total */}
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b', marginLeft: 'auto', flexShrink: 0 }}>
                            {fmt(days * c.daily_rate_usd * usdRate)} MAD
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TEAM COSTS TAB — simple cards per member
         ══════════════════════════════════════════════════════ */}
      {tab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {team.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Users size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>No team members</h3>
                <p>Add team members on the Team page to track labor costs</p>
              </div>
            </div>
          ) : (
            <>
              {team.map(m => (
                <div key={m.id} style={S.card}>
                  <div style={{ padding: '13px 14px' }}>
                    {/* Name + status row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                      {m.is_active
                        ? <span className="badge badge-green" style={{ fontSize: 10 }}>Active</span>
                        : <span className="badge badge-gray" style={{ fontSize: 10 }}>Inactive</span>
                      }
                    </div>

                    {/* Role + payment type */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      {m.role && <span style={{ fontSize: 12, color: '#8892b0' }}>{m.role}</span>}
                      <span className="badge badge-purple" style={{ fontSize: 10 }}>{m.payment_type}</span>
                    </div>

                    {/* Amounts */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {m.fixed_monthly ? (
                        <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>Monthly salary</div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(m.fixed_monthly)} <span style={{ fontSize: 10, color: '#8892b0', fontWeight: 400 }}>MAD/mo</span></div>
                        </div>
                      ) : null}
                      {m.per_order_rate ? (
                        <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>Per order</div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(m.per_order_rate)} <span style={{ fontSize: 10, color: '#8892b0', fontWeight: 400 }}>MAD/order</span></div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals card */}
              <div style={{ ...S.card, background: 'var(--bg)' }}>
                <div style={{ padding: '12px 14px', display: 'flex', gap: 10 }}>
                  {teamMonthly > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 2 }}>Total monthly</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(teamMonthly)} <span style={{ fontSize: 11, color: '#8892b0', fontWeight: 400 }}>MAD/mo</span></div>
                    </div>
                  )}
                  {teamPerOrder > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 2 }}>Total per order</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(teamPerOrder)} <span style={{ fontSize: 11, color: '#8892b0', fontWeight: 400 }}>MAD/order</span></div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          WITHDRAWALS TAB — simple cards per withdrawal
         ══════════════════════════════════════════════════════ */}
      {tab === 'withdrawals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {withdrawals.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <ArrowDownCircle size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>No withdrawals yet</h3>
                <p>Manual cash withdrawals and auto-logged stock purchases appear here</p>
              </div>
            </div>
          ) : (
            withdrawals.map(w => (
              <div key={w.id} style={S.card}>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 4 }}>
                      {w.date ? new Date(w.date).toLocaleDateString() : '—'}
                    </div>
                    {w.description && (
                      <div style={{ fontSize: 13, color: '#ccd6f6', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.description}
                      </div>
                    )}
                    <span className={`badge ${w.type === 'stock_purchase' ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: 10 }}>
                      {w.type === 'stock_purchase' ? 'Stock Purchase' : 'Manual'}
                    </span>
                  </div>

                  {/* Amount */}
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#f87171', flexShrink: 0 }}>
                    {fmt(w.amount)} MAD
                  </span>

                  {/* Delete button (manual only) */}
                  {w.type === 'manual' ? (
                    <button
                      onClick={() => handleDeleteWithdrawal(w.id)}
                      style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                        border: '1px solid #f8717144', background: 'transparent',
                        color: '#f87171', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: '#8892b0', flexShrink: 0 }}>auto</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Add / Edit Expense Modal ── */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>{editingExpense ? 'Edit Expense' : '+ Add Expense'}</h2>
              <button className="btn-icon" onClick={() => { setShowExpenseModal(false); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" placeholder="e.g. Office Rent, Caleo Subscription..." value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setExpenseForm({ ...expenseForm, category: c.key })}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${expenseForm.category === c.key ? c.color : '#2d3248'}`, background: expenseForm.category === c.key ? `${c.color}18` : '#1d1d27', color: expenseForm.category === c.key ? c.color : '#8892b0', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{c.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TYPES.map(t => (
                    <button key={t.key} onClick={() => setExpenseForm({ ...expenseForm, type: t.key })}
                      style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${expenseForm.type === t.key ? '#00d48f' : '#2d3248'}`, background: expenseForm.type === t.key ? '#00d48f18' : '#1d1d27', color: expenseForm.type === t.key ? '#00d48f' : '#8892b0', cursor: 'pointer', fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{t.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{t.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">
                    Amount (MAD)
                    {expenseForm.type === 'annual' && expenseForm.amount && (
                      <span style={{ color: '#8892b0', fontWeight: 400, marginLeft: 8 }}>= {fmt(parseFloat(expenseForm.amount) / 12)} MAD/month</span>
                    )}
                  </label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={expenseForm.start_date} onChange={e => setExpenseForm({ ...expenseForm, start_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description <span style={{ color: '#8892b0', fontWeight: 400 }}>(optional)</span></label>
                <input className="form-input" placeholder="Notes, supplier, contract details..." value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowExpenseModal(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveExpense}>{editingExpense ? 'Save Changes' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Withdrawal Modal ── */}
      {showAddWithdrawal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add Withdrawal</h2>
              <button className="btn-icon" onClick={() => { setShowAddWithdrawal(false); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Amount (MAD) *</label>
                <input className="form-input" type="number" min="0" placeholder="0.00" value={withdrawalForm.amount} onChange={e => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description <span style={{ color: '#8892b0', fontWeight: 400 }}>(optional)</span></label>
                <input className="form-input" placeholder="e.g. Owner withdrawal, cash taken..." value={withdrawalForm.description} onChange={e => setWithdrawalForm({ ...withdrawalForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={withdrawalForm.date} onChange={e => setWithdrawalForm({ ...withdrawalForm, date: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowAddWithdrawal(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddWithdrawal}>Add Withdrawal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
