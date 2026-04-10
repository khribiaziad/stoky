import { useState, useEffect } from 'react';
import { Receipt, ArrowDownCircle, Trash2, Edit2, Power, Megaphone, Users, LayoutGrid, Link2, TrendingUp } from 'lucide-react';
import ExpensesMobile from './ExpensesMobile';
import { useT } from '../i18n';
import CampaignConnectSidebar from './CampaignConnectSidebar';
import {
  getFixedExpenses, createFixedExpense, updateFixedExpense,
  toggleFixedExpense, deleteFixedExpense,
  getWithdrawals, createWithdrawal, deleteWithdrawal,
  getAdPlatforms, getSetting, getTeam,
  getProducts, getPacks, getOffers,
  getCampaignConnections, saveCampaignConnection, deleteCampaignConnection,
  getCampaignBulkStats, getAdsSpendSummary,
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
export default function Expenses({ readOnly = false, lang = 'en' }) {
  const t = useT(lang);
  if (window.innerWidth < 768) return <ExpensesMobile lang={lang} />;
  const [tab, setTab] = useState('overview');

  // Data
  const [expenses,    setExpenses]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [platforms,   setPlatforms]   = useState([]);
  const [team,        setTeam]        = useState([]);
  const [usdRate,     setUsdRate]     = useState(10);

  // Real API ad spend summary
  const [adsSummary, setAdsSummary] = useState(null);

  // Campaign connections
  const [connections,  setConnections]  = useState([]);
  const [connStats,    setConnStats]    = useState({});
  // Catalog for sidebar
  const [products,     setProducts]     = useState([]);
  const [packs,        setPacks]        = useState([]);
  const [offers,       setOffers]       = useState([]);
  // Ads date range
  const [adsPreset, setAdsPreset] = useState('month');
  const [adsFrom, setAdsFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [adsTo,   setAdsTo]   = useState(monthEnd.toISOString().slice(0, 10));
  // Sidebar
  const [connectSidebar, setConnectSidebar] = useState(null); // { campaign, platformLabel, existingConn }

  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Fixed expense filters
  const [filterType,   setFilterType]   = useState('all');
  const [filterCat,    setFilterCat]    = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [search,       setSearch]       = useState('');

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
    getCampaignConnections().then(r => setConnections(r.data)).catch(() => {});
    getProducts().then(r => setProducts(r.data)).catch(() => {});
    getPacks().then(r => setPacks(r.data)).catch(() => {});
    getOffers().then(r => setOffers(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Re-fetch real ad spend whenever date range changes
  useEffect(() => {
    getAdsSpendSummary(adsFrom, adsTo).then(r => setAdsSummary(r.data)).catch(() => {});
  }, [adsFrom, adsTo]);

  // Reload bulk stats whenever connections or date range changes
  useEffect(() => {
    if (connections.length === 0) { setConnStats({}); return; }
    getCampaignBulkStats(adsFrom, adsTo).then(r => setConnStats(r.data)).catch(() => {});
  }, [connections.length, adsFrom, adsTo]);

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

  const adsThisMonth = adsSummary?.total_mad ?? platforms.reduce((s,p) => s + platformSpend(p, usdRate, monthStart, monthEnd), 0);
  const adsAllTime   = platforms.reduce((s,p) => s + platformAllTime(p, usdRate), 0);
  const connectedPlatformCount = adsSummary?.platforms.filter(p => p.connected).length ?? platforms.length;

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

  const inactiveCount = expenses.filter(e => !e.is_active).length;

  // ── Connection helpers ─────────────────────────────────────
  const openConnectSidebar = (campaign, platform, existingConn) =>
    setConnectSidebar({ campaign, platformLabel: platform.label, existingConn: existingConn || null });

  const handleSaveConnection = async (data) => {
    const r = await saveCampaignConnection(data);
    setConnections(prev => {
      const without = prev.filter(c => c.campaign_id !== data.campaign_id);
      return [...without, r.data];
    });
  };

  const handleDeleteConnection = async (connId, campaignId) => {
    if (!confirm('Remove this connection?')) return;
    await deleteCampaignConnection(connId);
    setConnections(prev => prev.filter(c => c.id !== connId));
  };

  // Helper: item prices for profitability dashboard
  const getItemPrices = (itemType, itemId) => {
    if (itemType === 'product') {
      const p = products.find(x => x.id === itemId);
      const v = p?.variants?.[0];
      return { selling_price: v?.selling_price || 0, buy_price: v?.buying_price || 0, packaging_cost: 0 };
    }
    if (itemType === 'pack') {
      const pk = packs.find(x => x.id === itemId);
      if (!pk) return null;
      const presetBuy = pk.presets?.[0]?.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0);
      let buy_price = presetBuy || 0;
      if (!buy_price && pk.product_id) {
        const prod = products.find(x => x.id === pk.product_id);
        buy_price = (prod?.variants?.[0]?.buying_price || 0) * (pk.item_count || 1);
      }
      return { selling_price: pk.selling_price, buy_price, packaging_cost: pk.packaging_cost || 0 };
    }
    if (itemType === 'offer') {
      const of = offers.find(x => x.id === itemId);
      if (!of) return null;
      return { selling_price: of.selling_price, buy_price: of.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0) || 0, packaging_cost: of.packaging_cost || 0 };
    }
    return null;
  };

  const applyPreset = (preset) => {
    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);
    if (preset === 'today') {
      setAdsFrom(toStr); setAdsTo(toStr);
    } else if (preset === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
      setAdsFrom(start.toISOString().slice(0, 10)); setAdsTo(toStr);
    } else if (preset === 'month') {
      setAdsFrom(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
      setAdsTo(toStr);
    }
    setAdsPreset(preset);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('expenses')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'fixed'       && <button className="btn btn-primary" onClick={openNew}>+ {t('expenses')}</button>}
          {tab === 'withdrawals' && <button className="btn btn-primary" onClick={() => { setShowAddWithdrawal(true); setError(''); }}>+ Withdrawal</button>}
        </div>
      </div>

      {error   && <div className="alert alert-error">{error}<button style={{ float:'right', background:'none', border:'none', color:'inherit', cursor:'pointer' }} onClick={() => setError('')}>✕</button></div>}
      {success && <div className="alert alert-success">{success}<button style={{ float:'right', background:'none', border:'none', color:'inherit', cursor:'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      {/* ── Summary Cards ── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Monthly Burn Rate</div>
          <div className="stat-value">{fmt(totalMonthlyBurn)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD</span></div>
          <div className="stat-sub">fixed + ads + team salaries</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Per Order Cost</div>
          <div className="stat-value">{fmt(totalPerOrder)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD</span></div>
          <div className="stat-sub">expenses + team commissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ad Spend (This Month)</div>
          <div className="stat-value" style={{ color: '#a78bfa' }}>{fmt(adsThisMonth)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD</span></div>
          <div className="stat-sub">{connectedPlatformCount} connected · {fmt(adsAllTime)} manual all time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Withdrawals</div>
          <div className="stat-value" style={{ color: '#f87171' }}>{fmt(withdrawalTotal)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD</span></div>
          <div className="stat-sub">{fmt(manualTotal)} manual · {fmt(stockTotal)} stock</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <div className={`tab ${tab === 'overview'     ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <LayoutGrid size={13} strokeWidth={1.75} style={{ marginRight: 5 }} /> Overview
        </div>
        <div className={`tab ${tab === 'fixed'        ? 'active' : ''}`} onClick={() => setTab('fixed')}>
          <Receipt size={13} strokeWidth={1.75} style={{ marginRight: 5 }} /> Fixed Expenses
          <span style={{ marginLeft: 5, fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px' }}>{expenses.length}</span>
        </div>
        <div className={`tab ${tab === 'ads'          ? 'active' : ''}`} onClick={() => setTab('ads')}>
          <Megaphone size={13} strokeWidth={1.75} style={{ marginRight: 5 }} /> Ad Spend
          <span style={{ marginLeft: 5, fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px' }}>{platforms.length}</span>
        </div>
        <div className={`tab ${tab === 'team'         ? 'active' : ''}`} onClick={() => setTab('team')}>
          <Users size={13} strokeWidth={1.75} style={{ marginRight: 5 }} /> Team Costs
          <span style={{ marginLeft: 5, fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px' }}>{team.length}</span>
        </div>
        <div className={`tab ${tab === 'withdrawals'  ? 'active' : ''}`} onClick={() => setTab('withdrawals')}>
          <ArrowDownCircle size={13} strokeWidth={1.75} style={{ marginRight: 5 }} /> Withdrawals
          <span style={{ marginLeft: 5, fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px' }}>{withdrawals.length}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          OVERVIEW TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Monthly cost breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Monthly Cost Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Fixed monthly */}
              {active.filter(e => e.type === 'monthly' || e.type === 'annual').map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: '#8892b0' }}>{(CAT[e.category] || CAT.other).label}</span>
                  <span style={{ fontSize: 11 }}><span className={`badge ${TYPE[e.type]?.badge}`}>{TYPE[e.type]?.label}</span></span>
                  <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>
                    {fmt(e.type === 'annual' ? e.amount / 12 : e.amount)} MAD/mo
                  </span>
                </div>
              ))}

              {/* Team salaries */}
              {team.filter(m => m.payment_type === 'monthly' || m.payment_type === 'both').map(m => (
                <div key={`team-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: '#8892b0' }}>Team</span>
                  <span className="badge badge-blue" style={{ fontSize: 11 }}>Monthly</span>
                  <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmt(m.fixed_monthly)} MAD/mo</span>
                </div>
              ))}

              {/* Ad spend per platform (real API) */}
              {adsSummary?.platforms.filter(p => p.connected && p.spend_mad > 0).map(p => (
                <div key={`ad-${p.platform}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: '#8892b0' }}>Ads</span>
                  <span className="badge badge-purple" style={{ fontSize: 11 }}>This month</span>
                  <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmt(p.spend_mad)} MAD</span>
                </div>
              ))}

              {/* Total */}
              <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(totalMonthlyBurn)} MAD / month</span>
              </div>
            </div>
          </div>

          {/* Per-order cost breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Per Order Cost Breakdown</div>
            {active.filter(e => e.type === 'per_order').length === 0 && team.filter(m => m.payment_type === 'per_order' || m.payment_type === 'both').length === 0 ? (
              <div style={{ color: '#8892b0', fontSize: 13 }}>No per-order costs configured yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {active.filter(e => e.type === 'per_order').map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{e.name}</span>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>{(CAT[e.category] || CAT.other).label}</span>
                    <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmt(e.amount)} MAD/order</span>
                  </div>
                ))}
                {team.filter(m => m.payment_type === 'per_order' || m.payment_type === 'both').map(m => (
                  <div key={`team-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>Team</span>
                    <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmt(m.per_order_rate)} MAD/order</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(totalPerOrder)} MAD / order</span>
                </div>
              </div>
            )}
          </div>

          {/* One-time investments */}
          {expenses.filter(e => e.type === 'one_time').length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>One-time Investments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expenses.filter(e => e.type === 'one_time').map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: (CAT[e.category] || CAT.other).color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{e.name}</span>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>{(CAT[e.category] || CAT.other).label}</span>
                    <span style={{ fontSize: 11, color: '#8892b0' }}>{e.start_date ? new Date(e.start_date).toLocaleDateString() : ''}</span>
                    <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmt(e.amount)} MAD</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #2d3248', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{fmt(fixedOneTime)} MAD total</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          FIXED EXPENSES TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'fixed' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
            <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Paused only</option>
            </select>
            <select className="form-input" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={exportExpensesCSV} title="Export to CSV">
              ⬇ Export CSV
            </button>
          </div>
          <div className="card">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <Receipt size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>{expenses.length === 0 ? 'No expenses yet' : 'No results'}</h3>
                <p>{expenses.length === 0 ? 'Track every recurring and one-time cost' : 'Try adjusting the filters'}</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Category</th><th>Type</th><th>Amount</th><th>Monthly equiv.</th><th>Description</th><th>Since</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => {
                      const cat  = CAT[e.category]  || CAT.other;
                      const type = TYPE[e.type] || TYPE.monthly;
                      const monthlyEquiv = e.type === 'monthly' ? e.amount : e.type === 'annual' ? e.amount / 12 : null;
                      return (
                        <tr key={e.id} style={{ opacity: e.is_active ? 1 : 0.45 }}>
                          <td style={{ fontWeight: 600 }}>{e.name}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                              {cat.label}
                            </span>
                          </td>
                          <td><span className={`badge ${type.badge}`}>{type.label}</span></td>
                          <td style={{ fontWeight: 600 }}>
                            {fmt(e.amount)} MAD
                            <span style={{ fontSize: 11, color: '#8892b0', marginLeft: 3 }}>
                              {e.type === 'monthly' ? '/mo' : e.type === 'annual' ? '/yr' : e.type === 'per_order' ? '/order' : ''}
                            </span>
                          </td>
                          <td style={{ color: '#8892b0', fontSize: 13 }}>{monthlyEquiv !== null ? `${fmt(monthlyEquiv)} MAD` : '—'}</td>
                          <td style={{ color: '#8892b0', fontSize: 12 }}>{e.description || '—'}</td>
                          <td style={{ color: '#8892b0', fontSize: 12 }}>{e.start_date ? new Date(e.start_date).toLocaleDateString() : '—'}</td>
                          <td>
                            <button onClick={() => handleToggle(e.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: e.is_active ? '#0d2a1e' : '#2d3248', color: e.is_active ? '#00d48f' : '#8892b0' }}>
                              <Power size={10} /> {e.is_active ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}><Edit2 size={12} /></button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExpense(e.id)}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          AD SPEND TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Timeframe selector ── */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week',  label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: adsPreset === key ? '#a78bfa22' : '#1d1d27',
                  color: adsPreset === key ? '#a78bfa' : '#8892b0',
                  outline: adsPreset === key ? '1px solid #a78bfa55' : '1px solid #2d3248',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
            {adsPreset === 'custom' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
                <input type="date" className="form-input" style={{ width: 'auto' }} value={adsFrom} onChange={e => setAdsFrom(e.target.value)} />
                <span style={{ color: '#8892b0' }}>→</span>
                <input type="date" className="form-input" style={{ width: 'auto' }} value={adsTo} onChange={e => setAdsTo(e.target.value)} />
              </div>
            )}
          </div>

          {/* ── Per-platform blocks (connected only) ── */}
          {adsSummary && (() => {
            const connected = adsSummary.platforms.filter(p => p.connected);
            if (connected.length === 0) return (
              <div className="card"><div className="empty-state">
                <Megaphone size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
                <h3>No ad platforms connected</h3>
                <p>Go to the Ads page to connect your platforms</p>
              </div></div>
            );
            return (
              <>
                {/* Total bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1d1d27', borderRadius: 10, border: '1px solid #2d3248' }}>
                  <span style={{ fontSize: 13, color: '#8892b0' }}>Total ad spend · {connected.length} platform{connected.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#a78bfa' }}>{fmt(adsSummary.total_mad)} MAD</span>
                </div>
                {/* One card per connected platform */}
                {connected.map(p => (
                  <div key={p.platform} className="card" style={{ borderTop: `3px solid ${p.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: p.color === '#FFFC00' ? '#000' : '#fff', fontWeight: 800, fontSize: 14 }}>{p.label[0]}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{p.label}</div>
                        <div style={{ fontSize: 12, color: '#00d48f', marginTop: 2 }}>● Connected</div>
                      </div>
                      {p.error ? (
                        <span style={{ fontSize: 12, color: '#f87171' }}>Error fetching data</span>
                      ) : (
                        <>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#8892b0' }}>Spend (USD)</div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: '#60a5fa' }}>${fmt(p.spend_usd)}</div>
                          </div>
                          <div style={{ textAlign: 'right', paddingLeft: 20, borderLeft: '1px solid #2d3248' }}>
                            <div style={{ fontSize: 11, color: '#8892b0' }}>Spend (MAD)</div>
                            <div style={{ fontWeight: 700, fontSize: 20, color: p.spend_mad > 0 ? '#f59e0b' : '#8892b0' }}>{fmt(p.spend_mad)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}


          {/* ── Profitability Dashboard ── */}
          {connections.length > 0 && (() => {
            // Build connected campaign rows
            const rows = connections.map(conn => {
              let campaign = null;
              let platform = null;
              for (const p of platforms) {
                const c = p.campaigns.find(c => c.id === conn.campaign_id);
                if (c) { campaign = c; platform = p; break; }
              }
              if (!campaign) return null;
              const stats     = connStats[conn.id] || {};
              const days      = overlapDays(campaign.start_date, campaign.end_date, adsFrom, adsTo);
              const spend     = days * campaign.daily_rate_usd * usdRate;
              const delivered = stats.delivered_orders || 0;
              const adCost    = delivered > 0 ? spend / delivered : 0;
              const prices    = getItemPrices(conn.item_type, conn.item_id);
              const profit    = prices
                ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - adCost
                : null;
              const totalProfit = profit !== null ? profit * delivered : null;
              return { conn, campaign, platform, spend, delivered, stats, profit, totalProfit };
            }).filter(Boolean);

            if (rows.length === 0) return null;

            const totalSpend     = rows.reduce((s, r) => s + r.spend, 0);
            const totalDelivered = rows.reduce((s, r) => s + r.delivered, 0);
            const totalProfit    = rows.reduce((s, r) => s + (r.totalProfit || 0), 0);
            const avgReturn      = rows.length > 0 ? rows.reduce((s, r) => s + (r.stats.return_rate || 0), 0) / rows.length : 0;

            return (
              <div className="card" style={{ borderTop: '3px solid #a78bfa', marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <TrendingUp size={16} style={{ color: '#a78bfa' }} />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Real Profitability</span>
                  <span style={{ fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px', marginLeft: 4 }}>{rows.length} campaign{rows.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Summary row */}
                <div style={{ display: 'flex', gap: 0, background: '#13151e', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                  {[
                    { label: 'Total Spend', value: `${fmt(totalSpend)} MAD`, color: '#a78bfa' },
                    { label: 'Delivered Orders', value: totalDelivered, color: '#60a5fa' },
                    { label: 'Total Real Profit', value: `${fmt(totalProfit)} MAD`, color: totalProfit >= 0 ? '#00d48f' : '#f87171' },
                    { label: 'Avg Return Rate', value: `${avgReturn.toFixed(1)}%`, color: '#fbbf24' },
                  ].map((s, i) => (
                    <div key={i} style={{ flex: 1, padding: '12px 16px', borderRight: i < 3 ? '1px solid #222733' : 'none' }}>
                      <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Campaign cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map(({ conn, campaign, platform, spend, delivered, stats, profit, totalProfit }) => (
                    <div key={conn.id} style={{ background: '#13151e', borderRadius: 10, padding: '12px 14px', border: `1px solid ${totalProfit >= 0 ? '#0d2a1e' : '#2d1b1b'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: platform.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{platform.label}</span>
                          <span style={{ fontSize: 11, color: '#8892b0', marginLeft: 8 }}>{campaign.start_date.slice(0,10)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: '#8892b0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{conn.item_type}</span>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{conn.item_name}</div>
                        </div>
                        <button onClick={() => handleDeleteConnection(conn.id, campaign.id)} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 10, padding: 4 }}>✕</button>
                      </div>
                      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Spend', value: `${fmt(spend)} MAD`, color: '#a78bfa' },
                          { label: 'Delivered', value: delivered, color: '#60a5fa' },
                          { label: 'Return rate', value: `${stats.return_rate || 0}%`, color: (stats.return_rate || 0) > 30 ? '#f87171' : '#fbbf24' },
                          { label: 'Profit/order', value: profit !== null ? `${fmt(profit)} MAD` : '—', color: profit === null ? '#8892b0' : profit >= 0 ? '#00d48f' : '#f87171' },
                          { label: 'Total profit', value: totalProfit !== null ? `${fmt(totalProfit)} MAD` : '—', color: totalProfit === null ? '#8892b0' : totalProfit >= 0 ? '#00d48f' : '#f87171' },
                        ].map((s, i) => (
                          <div key={i} style={{ flex: '1 0 80px', padding: '6px 10px', borderRight: '1px solid #222733', lastChild: 'none' }}>
                            <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TEAM COSTS TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'team' && (
        <div className="card">
          {team.length === 0 ? (
            <div className="empty-state">
              <Users size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
              <h3>No team members</h3>
              <p>Add team members on the Team page to track labor costs</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Payment Type</th><th>Monthly Salary</th><th>Per Order Rate</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {team.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ color: '#8892b0' }}>{m.role || '—'}</td>
                      <td><span className="badge badge-purple">{m.payment_type}</span></td>
                      <td style={{ fontWeight: 600 }}>
                        {m.fixed_monthly ? <>{fmt(m.fixed_monthly)} <span style={{ fontSize: 11, color: '#8892b0' }}>MAD/mo</span></> : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {m.per_order_rate ? <>{fmt(m.per_order_rate)} <span style={{ fontSize: 11, color: '#8892b0' }}>MAD/order</span></> : '—'}
                      </td>
                      <td>{m.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #2d3248' }}>
                    <td colSpan={3} style={{ fontWeight: 700, paddingTop: 12 }}>Total</td>
                    <td style={{ fontWeight: 700, paddingTop: 12 }}>{teamMonthly > 0 ? `${fmt(teamMonthly)} MAD/mo` : '—'}</td>
                    <td style={{ fontWeight: 700, paddingTop: 12 }}>{teamPerOrder > 0 ? `${fmt(teamPerOrder)} MAD/order` : '—'}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          WITHDRAWALS TAB
         ══════════════════════════════════════════════════════ */}
      {tab === 'withdrawals' && (
        <div className="card">
          {withdrawals.length === 0 ? (
            <div className="empty-state">
              <ArrowDownCircle size={36} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
              <h3>No withdrawals yet</h3>
              <p>Manual cash withdrawals and auto-logged stock purchases appear here</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Description</th><th></th></tr></thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id}>
                      <td style={{ color: '#8892b0', fontSize: 12 }}>{w.date ? new Date(w.date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#f87171' }}>{fmt(w.amount)} MAD</td>
                      <td><span className={`badge ${w.type === 'stock_purchase' ? 'badge-yellow' : 'badge-red'}`}>{w.type === 'stock_purchase' ? 'Stock Purchase' : 'Manual'}</span></td>
                      <td style={{ color: '#8892b0' }}>{w.description || '—'}</td>
                      <td>{w.type === 'manual' ? <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWithdrawal(w.id)}><Trash2 size={12} /></button> : <span style={{ fontSize: 11, color: '#8892b0' }}>auto</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* ── Campaign Connect Sidebar ── */}
      {connectSidebar && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999 }}
            onClick={() => setConnectSidebar(null)}
          />
          <CampaignConnectSidebar
            campaign={connectSidebar.campaign}
            platformLabel={connectSidebar.platformLabel}
            existingConn={connectSidebar.existingConn}
            products={products}
            packs={packs}
            offers={offers}
            usdRate={usdRate}
            adsFrom={adsFrom}
            adsTo={adsTo}
            onSave={handleSaveConnection}
            onClose={() => setConnectSidebar(null)}
          />
        </>
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
