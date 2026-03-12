import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboardStats, getDashboardAttention, getDashboardWeekSummary, getReportSummary, getProducts, getMyStats, getLeads, getSetting, setSetting, errorMessage } from '../api';
import ErrorExplain from '../components/ErrorExplain';

// ── Translations ───────────────────────────────────────────────────────────
const T = {
  en: {
    title: 'Dashboard', overview: "Today's overview",
    periods: [
      { value: 'today',       label: 'Today' },
      { value: 'last_7_days', label: 'Last 7 Days' },
      { value: 'this_month',  label: 'This Month' },
      { value: 'custom',      label: 'Custom Range' },
    ],
    to: 'to', apply: 'Apply',
    toConfirm: 'To Confirm', awaitingPickup: 'Awaiting Pickup', inDelivery: 'In Delivery',
    delivered: 'Delivered', returned: 'Returned',
    cleanProfit: 'Clean Profit',
    vsPrev: 'vs prev',
    dailyGoal: 'Daily Revenue Goal', goalToday: 'Today',
    goalPlaceholder: 'e.g. 5000',
    goalSave: 'Save', goalCancel: '✕',
    goalReached: '✓ Goal reached!', goalToGo: 'MAD to go',
    goalHint: 'Click ✎ to set a daily revenue goal.',
    teamToday: 'Team Today', noActivity: 'No activity yet today.',
    orders: 'orders',
    lowStock: 'Low Stock Alerts', addStock: '+ Add Stock',
    threshold: 'threshold', outOfStock: '● OUT', left: 'left',
    quickActions: 'Quick Actions',
    uploadPickup: 'Upload Pickup PDF', processReturns: 'Process Returns',
    addStockBtn: '+ Add Stock', addProduct: '+ Add Product',
    myDashboard: 'My Dashboard', myOrders: 'My Orders',
    myEarnings: 'My Earnings', pending: 'Pending',
    deliveryRate: 'Delivery Rate', returnRate: 'Return Rate',
    myOverview: 'My Orders Overview',
  },
  fr: {
    title: 'Tableau de bord', overview: "Aperçu d'aujourd'hui",
    periods: [
      { value: 'today',       label: "Aujourd'hui" },
      { value: 'last_7_days', label: '7 derniers jours' },
      { value: 'this_month',  label: 'Ce mois-ci' },
      { value: 'custom',      label: 'Plage personnalisée' },
    ],
    to: 'au', apply: 'Appliquer',
    toConfirm: 'À confirmer', awaitingPickup: 'En attente ramassage', inDelivery: 'En livraison',
    delivered: 'Livrées', returned: 'Retours',
    cleanProfit: 'Bénéfice net',
    vsPrev: 'vs précédent',
    dailyGoal: 'Objectif journalier', goalToday: "Aujourd'hui",
    goalPlaceholder: 'ex. 5000',
    goalSave: 'Enregistrer', goalCancel: '✕',
    goalReached: '✓ Objectif atteint !', goalToGo: 'MAD restants',
    goalHint: 'Cliquez ✎ pour définir un objectif journalier.',
    teamToday: "Équipe aujourd'hui", noActivity: "Aucune activité aujourd'hui.",
    orders: 'commandes',
    lowStock: 'Alertes stock bas', addStock: '+ Ajouter du stock',
    threshold: 'seuil', outOfStock: '● ÉPUISÉ', left: 'restants',
    quickActions: 'Actions rapides',
    uploadPickup: 'Importer PDF ramassage', processReturns: 'Traiter les retours',
    addStockBtn: '+ Ajouter stock', addProduct: '+ Ajouter produit',
    myDashboard: 'Mon tableau de bord', myOrders: 'Mes commandes',
    myEarnings: 'Mes gains', pending: 'En attente',
    deliveryRate: 'Taux de livraison', returnRate: 'Taux de retour',
    myOverview: 'Aperçu de mes commandes',
  },
  ar: {
    title: 'لوحة التحكم', overview: 'نظرة عامة على اليوم',
    periods: [
      { value: 'today',       label: 'اليوم' },
      { value: 'last_7_days', label: 'آخر 7 أيام' },
      { value: 'this_month',  label: 'هذا الشهر' },
      { value: 'custom',      label: 'نطاق مخصص' },
    ],
    to: 'إلى', apply: 'تطبيق',
    toConfirm: 'للتأكيد', awaitingPickup: 'في انتظار الاستلام', inDelivery: 'قيد التوصيل',
    delivered: 'تم التوصيل', returned: 'مرتجعات',
    cleanProfit: 'الربح الصافي',
    vsPrev: 'مقارنة بالسابق',
    dailyGoal: 'هدف الإيرادات اليومي', goalToday: 'اليوم',
    goalPlaceholder: 'مثال: 5000',
    goalSave: 'حفظ', goalCancel: '✕',
    goalReached: '✓ تم بلوغ الهدف!', goalToGo: 'درهم متبقية',
    goalHint: 'اضغط ✎ لتحديد هدف يومي.',
    teamToday: 'الفريق اليوم', noActivity: 'لا نشاط حتى الآن.',
    orders: 'طلبات',
    lowStock: 'تنبيهات نقص المخزون', addStock: '+ إضافة مخزون',
    threshold: 'الحد', outOfStock: '● نفد', left: 'متبقي',
    quickActions: 'إجراءات سريعة',
    uploadPickup: 'رفع PDF الاستلام', processReturns: 'معالجة المرتجعات',
    addStockBtn: '+ إضافة مخزون', addProduct: '+ إضافة منتج',
    myDashboard: 'لوحتي', myOrders: 'طلباتي',
    myEarnings: 'أرباحي', pending: 'معلق',
    deliveryRate: 'معدل التوصيل', returnRate: 'معدل الإرجاع',
    myOverview: 'نظرة عامة على طلباتي',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function pctDelta(now, prev) {
  if (prev === 0) return null;
  return Math.round((now - prev) / prev * 100);
}

function Delta({ now, prev, label }) {
  const d = pctDelta(now, prev);
  if (d === null) return null;
  return (
    <div style={{ fontSize: 12, marginTop: 4, color: d >= 0 ? '#4ade80' : '#f87171' }}>
      {d >= 0 ? '▲' : '▼'} {Math.abs(d)}% {label}
    </div>
  );
}

// ── Mobile detection ───────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate, user, lang = 'en' }) {
  const t = T[lang] || T.en;
  const isMobile = useIsMobile();
  const isConfirmer = user?.role === 'confirmer';

  // New attention + week summary
  const [attention,        setAttention]        = useState(null);
  const [weekSummary,      setWeekSummary]      = useState(null);
  const [attentionLoading, setAttentionLoading] = useState(true);

  // Admin state
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [pendingLeads, setPendingLeads] = useState([]);
  const [leadsOpen, setLeadsOpen] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lowStockItems, setLowStockItems] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);

  // Confirmer state
  const [confPeriod, setConfPeriod] = useState('this_month');
  const [summary, setSummary] = useState(null);
  const [confLoading, setConfLoading] = useState(true);
  const [confError, setConfError] = useState('');

  const CONFIRMER_PERIODS = [
    { value: 'today',       label: t.periods[0].label },
    { value: 'last_7_days', label: t.periods[1].label },
    { value: 'this_month',  label: t.periods[2].label },
  ];

  // ── Admin: load dashboard stats ──────────────────────────────────────────
  const loadStats = (p, cs, ce) => {
    setLoading(true);
    setLoadError('');
    const params = { period: p };
    if (p === 'custom') { params.start = cs; params.end = ce; }
    getDashboardStats(params)
      .then(r => setStats(r.data))
      .catch(e => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isConfirmer) return;
    if (period !== 'custom') loadStats(period, '', '');

    setAttentionLoading(true);
    Promise.all([getDashboardAttention(), getDashboardWeekSummary()])
      .then(([a, w]) => { setAttention(a.data); setWeekSummary(w.data); })
      .catch(() => {})
      .finally(() => setAttentionLoading(false));

    getLeads().then(r => {
      const actionable = r.data.filter(l => l.status === 'pending' || l.status === 'unresponsive');
      setPendingLeads(actionable);
    }).catch(() => {});

    getProducts().then(r => {
      const items = r.data.flatMap(p =>
        p.variants
          .filter(v => v.low_stock_threshold > 0 && v.stock <= v.low_stock_threshold)
          .map(v => ({
            product: p.name,
            variant: [v.size, v.color].filter(Boolean).join(' / '),
            stock: v.stock,
            threshold: v.low_stock_threshold,
          }))
      );
      setLowStockItems(items);
    }).catch(() => {});

    getReportSummary({ period: 'today' })
      .then(r => setTodayRevenue(r.data.financials.revenue))
      .catch(() => {});

    getSetting('daily_revenue_goal').then(r => {
      const val = parseFloat(r.data.value);
      if (!isNaN(val) && val > 0) { setDailyGoal(val); setGoalInput(String(val)); }
    }).catch(() => {});
  }, [isConfirmer]);

  useEffect(() => {
    if (isConfirmer) return;
    if (period !== 'custom') loadStats(period, '', '');
  }, [period]);

  // ── Confirmer: load own stats ────────────────────────────────────────────
  useEffect(() => {
    if (!isConfirmer) return;
    setConfLoading(true);
    setConfError('');
    getMyStats({ period: confPeriod })
      .then(r => setSummary(r.data))
      .catch(e => setConfError(errorMessage(e)))
      .finally(() => setConfLoading(false));
  }, [isConfirmer, confPeriod]);

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0) return;
    try {
      await setSetting('daily_revenue_goal', val);
      setDailyGoal(val);
      setEditingGoal(false);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  };

  // ── Confirmer Dashboard ──────────────────────────────────────────────────
  if (isConfirmer) {
    const o = summary?.orders || {};
    const earnings = summary?.earnings ?? 0;
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t.myDashboard}</h1>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={confPeriod}
            onChange={e => setConfPeriod(e.target.value)}
          >
            {CONFIRMER_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {confError && <ErrorExplain message={confError} page="Dashboard" />}

        {confLoading ? <div className="loading">Loading...</div> : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">{t.myOrders}</div>
                <div className="stat-value blue">{o.total ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t.delivered}</div>
                <div className="stat-value green">{o.delivered ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t.returned}</div>
                <div className="stat-value red">{o.cancelled ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t.myEarnings}</div>
                <div className="stat-value purple">{earnings.toLocaleString()} MAD</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">{t.myOverview}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: t.pending,   val: o.pending ?? 0,   cls: 'badge-yellow' },
                  { label: t.delivered, val: o.delivered ?? 0, cls: 'badge-green' },
                  { label: t.returned,  val: o.cancelled ?? 0, cls: 'badge-red' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#8892b0' }}>{row.label}</span>
                    <span className={`badge ${row.cls}`}>{row.val}</span>
                  </div>
                ))}
                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>{t.deliveryRate}</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>{o.delivery_rate ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>{t.returnRate}</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{o.return_rate ?? 0}%</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">{t.quickActions}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => onNavigate('orders')}>{t.uploadPickup}</button>
                <button className="btn btn-secondary" onClick={() => onNavigate('orders')}>{t.processReturns}</button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Admin Dashboard ──────────────────────────────────────────────────────
  const current          = stats?.current          || {};
  const previous         = stats?.previous         || {};
  const hasPrev          = stats?.has_previous     ?? false;
  const teamToday        = stats?.team_today        || [];
  const cleanProfit      = stats?.clean_profit      ?? 0;
  const inDeliveryAmount = stats?.in_delivery_amount ?? 0;
  const olivAmount       = stats?.oliv_amount        ?? 0;
  const forceAmount      = stats?.force_amount       ?? 0;

  const total       = (current.to_confirm ?? 0) + (current.awaiting_pickup ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
  const confirmed   = (current.awaiting_pickup ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
  const confRate    = total > 0 ? Math.round(confirmed / total * 100) : null;
  const retTotal    = (current.delivered ?? 0) + (current.returned ?? 0);
  const returnRate  = retTotal > 0 ? Math.round((current.returned ?? 0) / retTotal * 100) : null;
  const returnAlert = returnRate !== null && returnRate >= 30;

  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  const staleLeads  = pendingLeads.filter(l => new Date(l.created_at).getTime() < sixHoursAgo);

  const pct = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;
  const clampedPct = Math.min(pct, 100);

  const kpiCards = [
    { label: t.toConfirm,      key: 'to_confirm',      color: '#fbbf24' },
    { label: t.awaitingPickup, key: 'awaiting_pickup',  color: '#fb923c' },
    { label: t.inDelivery,     key: 'in_delivery',      color: '#60a5fa' },
    { label: t.delivered,      key: 'delivered',        color: '#4ade80' },
    { label: t.returned,       key: 'returned',         color: '#f87171' },
  ];

  return (
    <div>
      <div className="page-header" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: 10 } : {}}>
        <h1 className="page-title">{t.title}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <select
            className="form-input"
            style={{ width: isMobile ? '100%' : 'auto', padding: '6px 12px' }}
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            {t.periods.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {period === 'custom' && (
            <>
              <input className="form-input" type="date" style={{ width: isMobile ? '100%' : 'auto' }}
                value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span style={{ color: '#8892b0' }}>{t.to}</span>
              <input className="form-input" type="date" style={{ width: isMobile ? '100%' : 'auto' }}
                value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              <button className="btn btn-primary btn-sm"
                onClick={() => loadStats('custom', customStart, customEnd)}>
                {t.apply}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Needs Attention strip ─────────────────────────────────────────── */}
      <style>{`
        @keyframes db-pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        .db-pulse-dot { animation: db-pulse-dot 1.6s ease-in-out infinite; }
      `}</style>
      {attentionLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', opacity: 0.4 }} />
          ))}
        </div>
      ) : attention && (() => {
        const cards = [
          { key: 'newLeads',         label: 'New Leads',          count: attention.newLeads,         color: '#4ade80', nav: 'leads',   pulse: false },
          { key: 'pendingOrders',    label: 'Pending Orders',      count: attention.pendingOrders,    color: '#fb923c', nav: 'orders',  pulse: false },
          { key: 'reportedDueToday', label: 'Reported Due Today',  count: attention.reportedDueToday, color: '#00c2cb', nav: 'orders',  pulse: true  },
          { key: 'lowStockItems',    label: 'Low Stock Items',     count: attention.lowStockItems,    color: '#f87171', nav: 'stock',   pulse: true  },
        ];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 8 }}>Needs Attention</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10 }}>
              {cards.map(c => {
                const active = c.count > 0;
                return (
                  <div key={c.key}
                    onClick={() => active && onNavigate(c.nav)}
                    style={{
                      position: 'relative', borderRadius: 10, padding: '14px 16px',
                      background: active ? `${c.color}08` : 'var(--card)',
                      border: `1px solid var(--border)`,
                      borderLeft: `3px solid ${active ? c.color : 'var(--border)'}`,
                      opacity: active ? 1 : 0.45,
                      cursor: active ? 'pointer' : 'default',
                      transition: 'opacity .15s',
                    }}
                  >
                    {active && c.pulse && (
                      <div className="db-pulse-dot" style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 7, height: 7, borderRadius: '50%', background: c.color,
                      }} />
                    )}
                    <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.count}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{c.label}</div>
                    {active && (
                      <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>Go to →</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── This Week summary bar ─────────────────────────────────────────── */}
      {weekSummary && !attentionLoading && (() => {
        const items = [
          { label: 'Revenue This Week',  value: `${weekSummary.revenue.toLocaleString()} MAD`, delta: weekSummary.revenueDelta },
          { label: 'Orders Confirmed',   value: weekSummary.ordersConfirmed,                   delta: weekSummary.ordersDelta },
          { label: 'Leads Converted',    value: weekSummary.leadsConverted,                    delta: weekSummary.leadsDelta },
        ];
        return (
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
            gap: 0, marginBottom: 16,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
          }}>
            {items.map((item, i) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderRight: !isMobile && i < 2 ? '1px solid var(--border)' : 'none',
                borderBottom: isMobile && i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: 'var(--t1)' }}>{item.value}</div>
                {item.delta !== null && item.delta !== undefined ? (
                  <div style={{ fontSize: 12, marginTop: 3, color: item.delta >= 0 ? '#4ade80' : '#f87171' }}>
                    {item.delta >= 0 ? '▲' : '▼'} {Math.abs(item.delta)}% vs last week
                  </div>
                ) : (
                  <div style={{ fontSize: 12, marginTop: 3, color: 'var(--t3)' }}>— vs last week</div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Low Stock Alerts — collapsible */}
      {lowStockItems.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid #f59e0b44' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setLowStockOpen(o => !o)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 15 }}>{t.lowStock}</span>
              <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {lowStockItems.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {lowStockOpen && (
                <button
                  onClick={e => { e.stopPropagation(); onNavigate('stock'); }}
                  className="btn btn-sm"
                  style={{ borderColor: '#f59e0b', color: '#f59e0b', fontSize: 12 }}
                >
                  {t.addStock}
                </button>
              )}
              <span style={{ color: '#f59e0b', fontSize: 13, lineHeight: 1 }}>
                {lowStockOpen ? '▲' : '▼'}
              </span>
            </div>
          </div>
          {lowStockOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {lowStockItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                  border: `1px solid ${item.stock === 0 ? '#f8717133' : '#f59e0b33'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.product}</span>
                    {item.variant && <span style={{ color: '#8892b0', marginLeft: 8, fontSize: 13 }}>{item.variant}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, fontSize: 13 }}>
                    <span style={{ color: '#8892b0' }}>
                      {t.threshold}: <span style={{ color: '#e2e8f0' }}>{item.threshold}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: item.stock === 0 ? '#f87171' : '#f59e0b', minWidth: 72, textAlign: 'right' }}>
                      {item.stock === 0 ? t.outOfStock : `${item.stock} ${t.left}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loadError && <ErrorExplain message={loadError} page="Dashboard" />}

      {loading ? <div className="loading">Loading...</div> : (
        <>
          {/* Return Rate Alert */}
          {returnAlert && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
              padding: '12px 16px', borderRadius: 10, background: '#f8717114', border: '1px solid #f8717144',
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <span style={{ fontWeight: 700, color: '#f87171' }}>High return rate — {returnRate}%</span>
                <span style={{ color: '#8892b0', fontSize: 13, marginLeft: 8 }}>for the selected period</span>
              </div>
            </div>
          )}

          {/* 4 KPI Cards + Clean Profit */}
          <div className="stat-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)' }}>
            {kpiCards.map(card => (
              <div key={card.key} className="stat-card">
                <div className="stat-label">{card.label}</div>
                <div className="stat-value" style={{ color: card.color }}>
                  {current[card.key] ?? 0}
                </div>
                {hasPrev && (
                  <Delta now={current[card.key] ?? 0} prev={previous[card.key] ?? 0} label={t.vsPrev} />
                )}
              </div>
            ))}
            <div className="stat-card">
              <div className="stat-label">{t.cleanProfit}</div>
              <div className={`stat-value ${cleanProfit >= 0 ? 'green' : 'red'}`}>
                {cleanProfit.toLocaleString()} MAD
              </div>
            </div>
          </div>

          {/* Secondary metrics — Money in Transit + Confirmation Rate */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="stat-card" style={{ background: '#60a5fa0d', border: '1px solid #60a5fa22' }}>
              <div className="stat-label">Money with Couriers</div>
              <div className="stat-value" style={{ color: '#60a5fa', fontSize: 22 }}>
                {inDeliveryAmount.toLocaleString()} MAD
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {olivAmount > 0 && <span style={{ fontSize: 12, color: '#8892b0' }}>🚚 {olivAmount.toLocaleString()}</span>}
                {forceAmount > 0 && <span style={{ fontSize: 12, color: '#8892b0' }}>📦 {forceAmount.toLocaleString()}</span>}
                {olivAmount === 0 && forceAmount === 0 && <span style={{ fontSize: 12, color: '#8892b0' }}>no orders in transit</span>}
              </div>
            </div>
            <div className="stat-card" style={{ background: confRate !== null && confRate < 50 ? '#f8717108' : '#4ade8008', border: `1px solid ${confRate !== null && confRate < 50 ? '#f8717122' : '#4ade8022'}` }}>
              <div className="stat-label">Confirmation Rate</div>
              <div className="stat-value" style={{ color: confRate === null ? '#8892b0' : confRate >= 70 ? '#4ade80' : confRate >= 50 ? '#fbbf24' : '#f87171' }}>
                {confRate !== null ? `${confRate}%` : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 4 }}>of orders past confirmation</div>
            </div>
          </div>

          {/* Pending Leads — collapsible */}
          {pendingLeads.length > 0 && (() => {
            const todayStr = new Date().toDateString();
            const newToday = pendingLeads.filter(l => new Date(l.created_at).toDateString() === todayStr).length;
            return (
              <div className="card" style={{ marginBottom: 16, border: '1px solid #a78bfa44' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setLeadsOpen(o => !o)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📋</span>
                    <span style={{ fontWeight: 700, color: '#a78bfa', fontSize: 15 }}>Pending Leads</span>
                    <span style={{ background: '#a78bfa22', color: '#a78bfa', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                      {pendingLeads.length}
                    </span>
                    {newToday > 0 && (
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                        +{newToday} today
                      </span>
                    )}
                    {staleLeads.length > 0 && (
                      <span style={{ background: '#f8717122', color: '#f87171', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                        {staleLeads.length} stale 6h+
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {leadsOpen && (
                      <button
                        onClick={e => { e.stopPropagation(); onNavigate('leads'); }}
                        className="btn btn-sm"
                        style={{ borderColor: '#a78bfa', color: '#a78bfa', fontSize: 12 }}
                      >
                        View All
                      </button>
                    )}
                    <span style={{ color: '#a78bfa', fontSize: 13 }}>{leadsOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {leadsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {pendingLeads.slice(0, 5).map(lead => {
                      const digits = lead.customer_phone.replace(/\D/g, '');
                      const waPhone = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
                      const items = lead.matched_items || lead.raw_items || [];
                      const itemsText = items.map(i => `${i.product_name} ×${i.quantity}`).join(', ') || '—';
                      const isNew   = new Date(lead.created_at).toDateString() === todayStr;
                      const isStale = new Date(lead.created_at).getTime() < sixHoursAgo;
                      return (
                        <div key={lead.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', background: 'var(--bg)', borderRadius: 8,
                          border: `1px solid ${isStale ? '#f8717133' : lead.status === 'unresponsive' ? '#6b728033' : '#a78bfa22'}`,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{lead.customer_name}</span>
                              {isStale && <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', background: '#f8717122', padding: '1px 6px', borderRadius: 99 }}>6H+</span>}
                              {!isStale && isNew && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#f59e0b22', padding: '1px 6px', borderRadius: 99 }}>NEW</span>}
                              {lead.status === 'unresponsive' && <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#6b728022', padding: '1px 6px', borderRadius: 99 }}>NO ANSWER</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lead.customer_city && <span>{lead.customer_city} · </span>}{itemsText}
                            </div>
                          </div>
                          {lead.total_amount > 0 && !isMobile && (
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', flexShrink: 0 }}>
                              {lead.total_amount.toFixed(0)} MAD
                            </span>
                          )}
                          <a
                            href={`tel:${lead.customer_phone}`}
                            onClick={e => e.stopPropagation()}
                            style={{
                              flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                              background: '#60a5fa22', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              textDecoration: 'none', color: '#60a5fa',
                            }}
                            title={`Call ${lead.customer_phone}`}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                            </svg>
                          </a>
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{
                              flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                              background: '#25D36622', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              textDecoration: 'none', color: '#25D366',
                            }}
                            title={`WhatsApp ${lead.customer_phone}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        </div>
                      );
                    })}
                    {pendingLeads.length > 5 && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ alignSelf: 'center', marginTop: 4 }}
                        onClick={() => onNavigate('leads')}
                      >
                        +{pendingLeads.length - 5} more — View All
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Charts — Orders Trend + Pipeline Funnel */}
          {(() => {
            const dailyOrders = stats?.daily_orders || [];
            const total = (current.to_confirm ?? 0) + (current.awaiting_pickup ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
            const funnelRows = [
              { label: t.toConfirm,      val: current.to_confirm      ?? 0, color: '#fbbf24', note: null },
              { label: t.awaitingPickup, val: current.awaiting_pickup  ?? 0, color: '#fb923c', note: null },
              { label: t.inDelivery,     val: current.in_delivery      ?? 0, color: '#60a5fa', note: null },
              { label: t.delivered,      val: current.delivered        ?? 0, color: '#4ade80', note: null },
              { label: t.returned,       val: current.returned         ?? 0, color: '#f87171', note: null },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Line chart — daily orders last 7 days */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Orders — Last 7 Days</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={dailyOrders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fill: '#8892b0', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                        labelStyle={{ color: '#e2e8f0' }}
                        itemStyle={{ color: '#00d48f' }}
                      />
                      <Line type="monotone" dataKey="orders" stroke="#00d48f" strokeWidth={2.5} dot={{ fill: '#00d48f', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Pipeline funnel */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>Order Pipeline</div>
                  {total === 0 ? (
                    <div style={{ color: '#8892b0', fontSize: 13 }}>No orders for this period.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {funnelRows.map(row => {
                        const pct = total > 0 ? Math.round(row.val / total * 100) : 0;
                        return (
                          <div key={row.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                              <span style={{ color: '#8892b0' }}>{row.label}</span>
                              <span style={{ fontWeight: 600, color: row.color }}>{row.val} <span style={{ color: '#8892b0', fontWeight: 400 }}>({pct}%)</span></span>
                            </div>
                            <div style={{ background: 'var(--bg)', borderRadius: 999, height: 7, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: row.color, transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Daily Goal + Team Today */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* Daily Revenue Goal — always today */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0 }}>{t.dailyGoal}</div>
                <span style={{ fontSize: 11, color: '#8892b0', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, fontWeight: 500 }}>
                  {t.goalToday}
                </span>
              </div>

              {editingGoal ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    type="number"
                    className="form-input"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    placeholder={t.goalPlaceholder}
                    style={{ flex: 1, fontSize: 14 }}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSaveGoal}>{t.goalSave}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingGoal(false)}>{t.goalCancel}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: '#60a5fa' }}>
                    {todayRevenue.toLocaleString()}
                  </span>
                  <span style={{ color: '#8892b0', fontSize: 14 }}>
                    / {dailyGoal > 0 ? `${dailyGoal.toLocaleString()} MAD` : '— MAD'}
                  </span>
                  <button
                    onClick={() => { setGoalInput(dailyGoal > 0 ? String(dailyGoal) : ''); setEditingGoal(true); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 14, padding: 0 }}
                    title="Set goal"
                  >✎</button>
                </div>
              )}

              {dailyGoal > 0 ? (
                <>
                  <div style={{ background: 'var(--bg)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{
                      height: '100%', borderRadius: 999, width: `${clampedPct}%`,
                      background: clampedPct >= 100 ? '#4ade80' : clampedPct >= 70 ? '#00d48f' : '#60a5fa',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: clampedPct >= 100 ? '#4ade80' : '#8892b0', fontWeight: 500 }}>
                      {pct.toFixed(1)}%
                    </span>
                    <span style={{ color: clampedPct >= 100 ? '#4ade80' : '#8892b0' }}>
                      {clampedPct >= 100
                        ? t.goalReached
                        : `${(dailyGoal - todayRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.goalToGo}`}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#8892b0' }}>{t.goalHint}</div>
              )}
            </div>

            {/* Team Today — always today */}
            <div className="card">
              <div className="card-title">{t.teamToday}</div>
              {teamToday.length === 0 ? (
                <div style={{ color: '#8892b0', fontSize: 13 }}>{t.noActivity}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teamToday.map((m, i) => {
                    const rate = m.total > 0 ? Math.round(m.delivered / m.total * 100) : 0;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                      }}>
                        <span style={{ flex: 1, fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{m.name}</span>
                        <span style={{ fontSize: 13, color: '#8892b0' }}>{m.total} {t.orders}</span>
                        <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600, minWidth: 48, textAlign: 'right' }}>{rate}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-title">{t.quickActions}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('orders')}>{t.uploadPickup}</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('orders')}>{t.processReturns}</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('stock')}>{t.addStockBtn}</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('products')}>{t.addProduct}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
