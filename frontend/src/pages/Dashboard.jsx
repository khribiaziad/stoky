import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboardStats, getDashboardAttention, getDashboardWeekSummary, getReportSummary, getMyStats, getSetting, setSetting, errorMessage } from '../api';
import ErrorExplain from '../components/ErrorExplain';

// ── Translations ───────────────────────────────────────────────────────────
const T = {
  en: {
    title: 'Dashboard',
    periods: [
      { value: 'today',       label: 'Today' },
      { value: 'last_7_days', label: '7 Days' },
      { value: 'this_month',  label: 'This Month' },
      { value: 'custom',      label: 'Custom' },
    ],
    to: 'to', apply: 'Apply',
    toConfirm: 'To Confirm', awaitingPickup: 'Awaiting Pickup', inDelivery: 'In Delivery',
    delivered: 'Delivered', returned: 'Returned',
    cleanProfit: 'Clean Profit', vsPrev: 'vs prev',
    dailyGoal: 'Daily Goal', goalToday: 'Today',
    goalPlaceholder: 'e.g. 5000', goalSave: 'Save', goalCancel: '✕',
    goalReached: '✓ Goal reached!', goalToGo: 'MAD to go',
    goalHint: 'Click ✎ to set a daily revenue goal.',
    teamToday: 'Team Today', noActivity: 'No activity yet today.',
    orders: 'orders', lowStock: 'Low Stock', addStock: '+ Add Stock',
    threshold: 'threshold', outOfStock: '● OUT', left: 'left',
    quickActions: 'Quick Actions',
    myDashboard: 'My Dashboard', myOrders: 'My Orders',
    myEarnings: 'My Earnings', pending: 'Pending',
    deliveryRate: 'Delivery Rate', returnRate: 'Return Rate',
    myOverview: 'My Orders Overview',
  },
  fr: {
    title: 'Tableau de bord',
    periods: [
      { value: 'today',       label: "Aujourd'hui" },
      { value: 'last_7_days', label: '7 jours' },
      { value: 'this_month',  label: 'Ce mois' },
      { value: 'custom',      label: 'Personnalisé' },
    ],
    to: 'au', apply: 'Appliquer',
    toConfirm: 'À confirmer', awaitingPickup: 'En attente', inDelivery: 'En livraison',
    delivered: 'Livrées', returned: 'Retours',
    cleanProfit: 'Bénéfice net', vsPrev: 'vs précédent',
    dailyGoal: 'Objectif', goalToday: "Aujourd'hui",
    goalPlaceholder: 'ex. 5000', goalSave: 'Enregistrer', goalCancel: '✕',
    goalReached: '✓ Objectif atteint !', goalToGo: 'MAD restants',
    goalHint: 'Cliquez ✎ pour définir un objectif.',
    teamToday: "Équipe aujourd'hui", noActivity: "Aucune activité aujourd'hui.",
    orders: 'commandes', lowStock: 'Stock bas', addStock: '+ Ajouter stock',
    threshold: 'seuil', outOfStock: '● ÉPUISÉ', left: 'restants',
    quickActions: 'Actions rapides',
    myDashboard: 'Mon tableau de bord', myOrders: 'Mes commandes',
    myEarnings: 'Mes gains', pending: 'En attente',
    deliveryRate: 'Taux de livraison', returnRate: 'Taux de retour',
    myOverview: 'Aperçu de mes commandes',
  },
  ar: {
    title: 'لوحة التحكم',
    periods: [
      { value: 'today',       label: 'اليوم' },
      { value: 'last_7_days', label: '7 أيام' },
      { value: 'this_month',  label: 'هذا الشهر' },
      { value: 'custom',      label: 'مخصص' },
    ],
    to: 'إلى', apply: 'تطبيق',
    toConfirm: 'للتأكيد', awaitingPickup: 'في انتظار', inDelivery: 'قيد التوصيل',
    delivered: 'تم التوصيل', returned: 'مرتجعات',
    cleanProfit: 'الربح الصافي', vsPrev: 'مقارنة بالسابق',
    dailyGoal: 'هدف اليوم', goalToday: 'اليوم',
    goalPlaceholder: 'مثال: 5000', goalSave: 'حفظ', goalCancel: '✕',
    goalReached: '✓ تم بلوغ الهدف!', goalToGo: 'درهم متبقية',
    goalHint: 'اضغط ✎ لتحديد هدف.',
    teamToday: 'الفريق اليوم', noActivity: 'لا نشاط حتى الآن.',
    orders: 'طلبات', lowStock: 'مخزون منخفض', addStock: '+ إضافة مخزون',
    threshold: 'الحد', outOfStock: '● نفد', left: 'متبقي',
    quickActions: 'إجراءات سريعة',
    myDashboard: 'لوحتي', myOrders: 'طلباتي',
    myEarnings: 'أرباحي', pending: 'معلق',
    deliveryRate: 'معدل التوصيل', returnRate: 'معدل الإرجاع',
    myOverview: 'نظرة عامة على طلباتي',
  },
};

function pctDelta(now, prev) {
  if (prev === 0) return null;
  return Math.round((now - prev) / prev * 100);
}

function DeltaBadge({ now, prev, label }) {
  const d = pctDelta(now, prev);
  if (d === null) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: d >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
      color: d >= 0 ? '#22C55E' : '#EF4444',
    }}>
      {d >= 0 ? '▲' : '▼'} {Math.abs(d)}% {label}
    </span>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Dashboard({ onNavigate, user, lang = 'en' }) {
  const t = T[lang] || T.en;
  const isMobile = useIsMobile();
  const isConfirmer = user?.role === 'confirmer';

  const [attention,        setAttention]        = useState(null);
  const [weekSummary,      setWeekSummary]      = useState(null);
  const [attentionLoading, setAttentionLoading] = useState(true);

  const [period,      setPeriod]      = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [dailyGoal,    setDailyGoal]   = useState(0);
  const [goalInput,    setGoalInput]   = useState('');
  const [editingGoal,  setEditingGoal] = useState(false);

  const [confPeriod,  setConfPeriod]  = useState('this_month');
  const [summary,     setSummary]     = useState(null);
  const [confLoading, setConfLoading] = useState(true);
  const [confError,   setConfError]   = useState('');

  const CONFIRMER_PERIODS = [
    { value: 'today',       label: t.periods[0].label },
    { value: 'last_7_days', label: t.periods[1].label },
    { value: 'this_month',  label: t.periods[2].label },
  ];

  const loadStats = (p, cs, ce) => {
    setLoading(true); setLoadError('');
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
      .catch(e => console.error(e))
      .finally(() => setAttentionLoading(false));
    getReportSummary({ period: 'today' }).then(r => setTodayRevenue(r.data.financials.revenue)).catch(() => {});
    getSetting('daily_revenue_goal').then(r => {
      const val = parseFloat(r.data.value);
      if (!isNaN(val) && val > 0) { setDailyGoal(val); setGoalInput(String(val)); }
    }).catch(() => {});
  }, [isConfirmer]);

  useEffect(() => {
    if (isConfirmer) return;
    if (period !== 'custom') loadStats(period, '', '');
  }, [period]);

  useEffect(() => {
    if (!isConfirmer) return;
    setConfLoading(true); setConfError('');
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
      setDailyGoal(val); setEditingGoal(false);
    } catch (e) { setLoadError(errorMessage(e)); }
  };

  // ── Confirmer Dashboard ──────────────────────────────────────────────────
  if (isConfirmer) {
    const o = summary?.orders || {};
    const earnings = summary?.earnings ?? 0;
    return (
      <div style={{ animation: 'fadeIn 0.25s ease' }}>
        <div className="page-header">
          <h1 className="page-title">{t.myDashboard}</h1>
          <div className="period-pills">
            {CONFIRMER_PERIODS.map(p => (
              <button key={p.value} className={`period-pill${confPeriod === p.value ? ' active' : ''}`}
                onClick={() => setConfPeriod(p.value)}>{p.label}</button>
            ))}
          </div>
        </div>

        {confError && <ErrorExplain message={confError} page="Dashboard" />}

        {confLoading ? <div className="loading">Loading...</div> : (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)' }}>
              {[
                { label: t.myOrders,   val: o.total ?? 0,     color: '#3B82F6' },
                { label: t.delivered,  val: o.delivered ?? 0, color: '#22C55E' },
                { label: t.returned,   val: o.cancelled ?? 0, color: '#EF4444' },
                { label: t.myEarnings, val: `${earnings.toLocaleString()} MAD`, color: '#8B5CF6' },
              ].map(card => (
                <div key={card.label} className="stat-card">
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value" style={{ color: card.color, fontSize: 26 }}>{card.val}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>{t.myOverview}</div>
              {[
                { label: t.pending,   val: o.pending ?? 0,   color: '#F59E0B' },
                { label: t.delivered, val: o.delivered ?? 0, color: '#22C55E' },
                { label: t.returned,  val: o.cancelled ?? 0, color: '#EF4444' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--t2)', fontSize: 13 }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color, fontSize: 15 }}>{row.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 }}>
                <span style={{ color: 'var(--t2)', fontSize: 13 }}>{t.deliveryRate}</span>
                <span style={{ fontWeight: 700, color: '#22C55E' }}>{o.delivery_rate ?? 0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <span style={{ color: 'var(--t2)', fontSize: 13 }}>{t.returnRate}</span>
                <span style={{ fontWeight: 700, color: '#EF4444' }}>{o.return_rate ?? 0}%</span>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>{t.quickActions}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => onNavigate('orders')}>Upload Pickup PDF</button>
                <button className="btn btn-secondary" onClick={() => onNavigate('orders')}>Process Returns</button>
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
  const lowStockItems    = stats?.low_stock          || [];
  const dailyOrders      = stats?.daily_orders       || [];

  const total       = (current.to_confirm ?? 0) + (current.awaiting_pickup ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
  const confirmed   = (current.awaiting_pickup ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
  const confRate    = total > 0 ? Math.round(confirmed / total * 100) : null;
  const retTotal    = (current.delivered ?? 0) + (current.returned ?? 0);
  const returnRate  = retTotal > 0 ? Math.round((current.returned ?? 0) / retTotal * 100) : null;
  const returnAlert = returnRate !== null && returnRate >= 30;

  const pct        = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;
  const clampedPct = Math.min(pct, 100);

  const kpiCards = [
    { label: t.toConfirm,      key: 'to_confirm',     color: '#F59E0B' },
    { label: t.awaitingPickup, key: 'awaiting_pickup', color: '#F97316' },
    { label: t.inDelivery,     key: 'in_delivery',     color: '#3B82F6' },
    { label: t.delivered,      key: 'delivered',       color: '#22C55E' },
    { label: t.returned,       key: 'returned',        color: '#EF4444' },
  ];

  const funnelRows = [
    { label: t.toConfirm,      val: current.to_confirm      ?? 0, color: '#F59E0B' },
    { label: t.awaitingPickup, val: current.awaiting_pickup  ?? 0, color: '#F97316' },
    { label: t.inDelivery,     val: current.in_delivery      ?? 0, color: '#3B82F6' },
    { label: t.delivered,      val: current.delivered        ?? 0, color: '#22C55E' },
    { label: t.returned,       val: current.returned         ?? 0, color: '#EF4444' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>

      {/* ── Header ── */}
      <div className="page-header" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: 12 } : {}}>
        <h1 className="page-title">{t.title}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="period-pills">
            {t.periods.map(p => (
              <button key={p.value}
                className={`period-pill${period === p.value ? ' active' : ''}`}
                onClick={() => setPeriod(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" type="date" style={{ width: 'auto' }}
                value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span style={{ color: 'var(--t2)', fontSize: 13 }}>{t.to}</span>
              <input className="form-input" type="date" style={{ width: 'auto' }}
                value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              <button className="btn btn-primary btn-sm"
                onClick={() => loadStats('custom', customStart, customEnd)}>
                {t.apply}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Attention Strip ── */}
      {attentionLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 88, borderRadius: 'var(--r)', background: 'var(--card)', border: '1px solid var(--border)', opacity: 0.5 }} />
          ))}
        </div>
      ) : attention && (() => {
        const cards = [
          { key: 'newLeads',         label: 'New Leads',         count: attention.newLeads,         color: '#22C55E', nav: 'leads'   },
          { key: 'pendingOrders',    label: 'Pending Orders',    count: attention.pendingOrders,    color: '#F97316', nav: 'orders'  },
          { key: 'reportedDueToday', label: 'Reported Due Today',count: attention.reportedDueToday, color: '#3B82F6', nav: 'orders'  },
          { key: 'lowStockItems',    label: 'Low Stock Items',   count: attention.lowStockItems,    color: '#EF4444', nav: 'stock'   },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {cards.map(c => {
              const active = c.count > 0;
              return (
                <div key={c.key} onClick={() => onNavigate(c.nav)} style={{
                  background: 'var(--card)', borderRadius: 'var(--r)',
                  padding: '18px 20px', cursor: 'pointer',
                  border: `1px solid ${active ? c.color + '40' : 'var(--border)'}`,
                  boxShadow: active ? `0 4px 16px ${c.color}18` : 'var(--shadow)',
                  transition: 'all 0.2s', opacity: active ? 1 : 0.55,
                }}>
                  <div style={{
                    fontSize: 32, fontWeight: 800, lineHeight: 1,
                    color: active ? c.color : 'var(--t3)',
                    letterSpacing: '-1px',
                  }}>{c.count}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 6, fontWeight: 500 }}>{c.label}</div>
                  {active && <div style={{ fontSize: 11, color: c.color, marginTop: 6, fontWeight: 600 }}>View →</div>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Week Summary Bar ── */}
      {weekSummary && !attentionLoading && (() => {
        const items = [
          { label: 'Revenue This Week',  value: `${weekSummary.revenue?.toLocaleString() ?? 0} MAD`, delta: weekSummary.revenueDelta },
          { label: 'Orders Confirmed',   value: weekSummary.ordersConfirmed ?? 0,                    delta: weekSummary.ordersDelta  },
          { label: 'Leads Converted',    value: weekSummary.leadsConverted ?? 0,                     delta: weekSummary.leadsDelta   },
        ];
        return (
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', overflow: 'hidden',
            marginBottom: 20, boxShadow: 'var(--shadow)',
          }}>
            {items.map((item, i) => (
              <div key={i} style={{
                padding: '18px 22px',
                borderRight: !isMobile && i < 2 ? '1px solid var(--border)' : 'none',
                borderBottom: isMobile && i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px' }}>{item.value}</div>
                {item.delta != null ? (
                  <div style={{ marginTop: 5 }}>
                    <DeltaBadge now={item.delta} prev={0} label="vs last week" />
                    <span style={{ marginLeft: 4, fontSize: 11, color: item.delta >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                      {item.delta >= 0 ? '▲' : '▼'} {Math.abs(item.delta)}% vs last week
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>— vs last week</div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {loadError && <ErrorExplain message={loadError} page="Dashboard" />}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* ── Return Rate Alert ── */}
          {returnAlert && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
              padding: '14px 18px', borderRadius: 'var(--r)',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <span style={{ fontWeight: 700, color: '#EF4444' }}>High return rate — {returnRate}%</span>
                <span style={{ color: 'var(--t2)', fontSize: 13, marginLeft: 8 }}>for the selected period</span>
              </div>
            </div>
          )}

          {/* ── KPI Pipeline Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
            {kpiCards.map(card => (
              <div key={card.key} className="stat-card" style={{ gap: 6 }}>
                <div className="stat-label">{card.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: card.color, letterSpacing: '-1px', lineHeight: 1 }}>
                  {current[card.key] ?? 0}
                </div>
                {card.key === 'in_delivery' && inDeliveryAmount > 0 && (
                  <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
                    {inDeliveryAmount.toLocaleString()} MAD
                    {olivAmount > 0 && <span style={{ color: 'var(--t2)', marginLeft: 5 }}>🚚 {olivAmount.toLocaleString()}</span>}
                    {forceAmount > 0 && <span style={{ color: 'var(--t2)', marginLeft: 5 }}>📦 {forceAmount.toLocaleString()}</span>}
                  </div>
                )}
                {hasPrev && (
                  <div style={{ fontSize: 11, fontWeight: 600,
                    color: (current[card.key] ?? 0) >= (previous[card.key] ?? 0) ? '#22C55E' : '#EF4444'
                  }}>
                    {(current[card.key] ?? 0) >= (previous[card.key] ?? 0) ? '▲' : '▼'}{' '}
                    {Math.abs((current[card.key] ?? 0) - (previous[card.key] ?? 0))} {t.vsPrev}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Main Grid: Hero Dark Card + Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* LEFT: Dark hero card */}
            <div className="hero-dark" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Clean Profit */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                  {t.cleanProfit}
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, color: '#C6FF00', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {cleanProfit.toLocaleString()}
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>MAD</span>
                </div>
                {hasPrev && (
                  <div style={{ marginTop: 8, fontSize: 12, color: cleanProfit >= 0 ? '#C6FF00' : '#EF4444', fontWeight: 600 }}>
                    {cleanProfit >= 0 ? '▲' : '▼'} vs previous period
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

              {/* Confirmation Rate + Return Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Confirmation Rate</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
                    color: confRate === null ? 'rgba(255,255,255,0.3)' : confRate >= 70 ? '#C6FF00' : confRate >= 50 ? '#F59E0B' : '#EF4444'
                  }}>
                    {confRate !== null ? `${confRate}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Return Rate</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
                    color: returnRate === null ? 'rgba(255,255,255,0.3)' : returnRate <= 15 ? '#C6FF00' : returnRate <= 30 ? '#F59E0B' : '#EF4444'
                  }}>
                    {returnRate !== null ? `${returnRate}%` : '—'}
                  </div>
                </div>
              </div>

              {/* Daily Goal */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {t.dailyGoal}
                  </div>
                  <button onClick={() => { setGoalInput(dailyGoal > 0 ? String(dailyGoal) : ''); setEditingGoal(true); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                    ✎
                  </button>
                </div>

                {editingGoal ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                      placeholder={t.goalPlaceholder} autoFocus
                      style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    <button onClick={handleSaveGoal}
                      style={{ background: '#C6FF00', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#111', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      {t.goalSave}
                    </button>
                    <button onClick={() => setEditingGoal(false)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>
                      {t.goalCancel}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                        {todayRevenue.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        / {dailyGoal > 0 ? `${dailyGoal.toLocaleString()} MAD` : '— set a goal'}
                      </span>
                    </div>
                    {dailyGoal > 0 && (
                      <>
                        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{
                            height: '100%', borderRadius: 999, width: `${clampedPct}%`,
                            background: clampedPct >= 100 ? '#C6FF00' : clampedPct >= 70 ? '#C6FF00cc' : '#C6FF0066',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: clampedPct >= 100 ? '#C6FF00' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                          {clampedPct >= 100
                            ? t.goalReached
                            : `${(dailyGoal - todayRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.goalToGo} — ${pct.toFixed(0)}%`}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RIGHT: Line Chart */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Orders — Last 7 Days</div>
              {dailyOrders.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyOrders} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: 'var(--t2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--t2)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)' }}
                      labelStyle={{ color: 'var(--t1)', fontWeight: 600 }}
                      itemStyle={{ color: '#111118' }}
                    />
                    <Line type="monotone" dataKey="orders" stroke="#111118" strokeWidth={2.5}
                      dot={{ fill: '#111118', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#C6FF00', stroke: '#111118', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
                  No data for this period
                </div>
              )}
            </div>
          </div>

          {/* ── Pipeline Funnel + Team Today ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Pipeline Funnel */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Order Pipeline</div>
              {total === 0 ? (
                <div style={{ color: 'var(--t2)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No orders for this period.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {funnelRows.map(row => {
                    const rowPct = total > 0 ? Math.round(row.val / total * 100) : 0;
                    return (
                      <div key={row.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontWeight: 700, color: row.color }}>
                            {row.val} <span style={{ color: 'var(--t3)', fontWeight: 400 }}>({rowPct}%)</span>
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, width: `${rowPct}%`, background: row.color, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Team Today */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>{t.teamToday}</div>
              {teamToday.length === 0 ? (
                <div style={{ color: 'var(--t2)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>{t.noActivity}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {teamToday.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < teamToday.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--t1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--surface)', flexShrink: 0 }}>
                          {(m.name || 'T')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--t2)' }}>{m.orders} {t.orders}</div>
                        </div>
                      </div>
                      {m.delivered != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.10)', padding: '3px 10px', borderRadius: 999 }}>
                          {m.delivered} delivered
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Low Stock ── */}
          {lowStockItems.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title">{t.lowStock}</div>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('stock')}>{t.addStock}</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lowStockItems.slice(0, 8).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < Math.min(lowStockItems.length, 8) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{item.product_name}</span>
                      {item.size && <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 6 }}>{item.size}</span>}
                      {item.color && <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 4 }}>{item.color}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>{t.threshold}: {item.threshold}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, padding: '2px 10px', borderRadius: 999,
                        background: item.stock === 0 ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
                        color: item.stock === 0 ? '#EF4444' : '#F59E0B',
                      }}>
                        {item.stock === 0 ? t.outOfStock : `${item.stock} ${t.left}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
