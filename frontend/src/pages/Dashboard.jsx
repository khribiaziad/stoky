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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const weekRevenue = weekSummary?.revenue ?? 0;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* ── Period Picker ── */}
      <div className="page-header" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: 12 } : {}}>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* ── HERO ── */}
      <div className="dash-hero">
        <div className="dash-hero-bg" />
        <div className="dash-hero-grid" />
        <div className="dash-hero-glow1" />
        <div className="dash-hero-glow2" />
        <div className="dash-hero-left">
          <div className="dash-hero-eyebrow">{new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar-MA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="dash-hero-title">{greeting}, <span>{user?.username}</span></div>
          <div className="dash-hero-sub">
            {attention && <>
              <strong style={{ color: 'var(--green)' }}>{attention.pendingOrders ?? 0} to confirm</strong>
              &nbsp;·&nbsp;
              <strong style={{ color: 'var(--yellow)' }}>{attention.lowStockItems ?? 0} low stock</strong>
              {attention.reportedDueToday > 0 && <>&nbsp;·&nbsp;<strong style={{ color: 'var(--blue)' }}>{attention.reportedDueToday} due today</strong></>}
            </>}
          </div>
        </div>
        {!isMobile && (
          <div className="dash-hero-right">
            <div className="dash-hero-kpi">
              <div className="dash-hero-kpi-val" style={{ color: 'var(--accent-soft)' }}>
                {loading ? '—' : cleanProfit.toLocaleString()}
              </div>
              <div className="dash-hero-kpi-label">{t.cleanProfit} · MAD</div>
              {hasPrev && !loading && (
                <div className="dash-hero-kpi-delta" style={{ color: cleanProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {cleanProfit >= 0 ? '↑' : '↓'} vs prev period
                </div>
              )}
            </div>
            <div className="dash-hero-kpi">
              <div className="dash-hero-kpi-val" style={{ color: 'var(--t1)' }}>
                {attentionLoading ? '—' : weekRevenue.toLocaleString()}
              </div>
              <div className="dash-hero-kpi-label">Week Revenue · MAD</div>
              {weekSummary?.revenueDelta != null && (
                <div className="dash-hero-kpi-delta" style={{ color: weekSummary.revenueDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {weekSummary.revenueDelta >= 0 ? '↑' : '↓'} {Math.abs(weekSummary.revenueDelta)}% vs last week
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── ALERT (attention strip) ── */}
      {attentionLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 6 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 'var(--r)', background: 'var(--card)', border: '1px solid var(--border)', opacity: 0.4 }} />)}
        </div>
      ) : attention && (() => {
        const alerts = [
          { key: 'newLeads',         label: 'New Leads',      count: attention.newLeads,         color: 'var(--green)', nav: 'leads'  },
          { key: 'pendingOrders',    label: 'To Confirm',     count: attention.pendingOrders,    color: 'var(--yellow)', nav: 'orders' },
          { key: 'reportedDueToday', label: 'Due Today',      count: attention.reportedDueToday, color: 'var(--blue)',  nav: 'orders' },
          { key: 'lowStockItems',    label: 'Low Stock',      count: attention.lowStockItems,    color: 'var(--red)',   nav: 'stock'  },
        ];
        const hasAlert = alerts.some(a => a.count > 0);
        return hasAlert ? (
          <div className="dash-alert">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div className="dash-alert-text">
              {alerts.filter(a => a.count > 0).map((a, i) => (
                <span key={a.key}>
                  {i > 0 && ' · '}
                  <em style={{ color: a.color, cursor: 'pointer' }} onClick={() => onNavigate(a.nav)}>
                    {a.count} {a.label}
                  </em>
                </span>
              ))}
              {returnAlert && <span> · <em style={{ color: 'var(--red)' }}>Return rate {returnRate}% is high</em></span>}
            </div>
          </div>
        ) : null;
      })()}

      {loadError && <ErrorExplain message={loadError} page="Dashboard" />}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* ── PIPELINE ── */}
          <div className="dash-pipeline">
            {kpiCards.map((card, idx) => {
              const colors = ['var(--yellow)','var(--blue)','var(--accent-soft)','var(--green)','var(--red)'];
              const glows  = ['#FBBF24','#60A5FA','#9B8DF9','#34D399','#F87171'];
              const val    = current[card.key] ?? 0;
              const prevVal = previous[card.key] ?? 0;
              const delta  = hasPrev ? val - prevVal : null;
              return (
                <div key={card.key} className="dash-pipe" style={{ animationDelay: `${0.1 + idx * 0.05}s` }}>
                  <div className="dash-pipe-glow" style={{ background: glows[idx] }} />
                  <div className="dash-pipe-label">{card.label}</div>
                  <div className="dash-pipe-val" style={{ color: colors[idx] }}>{val}</div>
                  {card.key === 'in_delivery' && inDeliveryAmount > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 500 }}>{inDeliveryAmount.toLocaleString()} MAD</div>
                  )}
                  {delta !== null && (
                    <div className="dash-pipe-delta" style={{ color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} {t.vsPrev}
                    </div>
                  )}
                  <div className="dash-pipe-bar" style={{ background: glows[idx] }} />
                </div>
              );
            })}
          </div>

          {/* ── BENTO ROW 1: Chart + Pipeline Funnel ── */}
          <div className="dash-bento">

            {/* Bar chart */}
            <div className="card dash-col2" style={{ marginBottom: 0, animationDelay: '0.2s', animation: 'fadeIn 0.35s ease both' }}>
              <div className="card-header">
                <div className="card-label">Orders — Last 7 Days</div>
                <span className="card-link" onClick={() => onNavigate('reports')}>Reports →</span>
              </div>
              {dailyOrders.length > 0 ? (
                <>
                  <div className="dash-chart-wrap">
                    {dailyOrders.map((d, i) => {
                      const maxOrders = Math.max(...dailyOrders.map(x => x.orders), 1);
                      const isToday = i === dailyOrders.length - 1;
                      const h = Math.max((d.orders / maxOrders) * 100, 4);
                      return (
                        <div key={i} className={`dash-bar ${isToday ? 'dash-bar-today' : 'dash-bar-past'}`}
                          style={{ height: `${h}%` }} title={`${d.day}: ${d.orders} orders`} />
                      );
                    })}
                  </div>
                  <div className="dash-chart-labels">
                    {dailyOrders.map((d, i) => (
                      <div key={i} className={`dash-chart-lbl${i === dailyOrders.length - 1 ? ' dash-chart-lbl-today' : ''}`}>{d.day}</div>
                    ))}
                  </div>
                  <div className="dash-chart-footer">
                    <div className="dash-chart-footer-label">Period total</div>
                    <div className="dash-chart-footer-val">
                      {dailyOrders.reduce((s,d) => s + d.orders, 0)}
                      <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>orders</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>No data for this period</div>
              )}
            </div>

            {/* Pipeline funnel */}
            <div className="card dash-col2" style={{ marginBottom: 0, animationDelay: '0.25s', animation: 'fadeIn 0.35s ease both' }}>
              <div className="card-header">
                <div className="card-label">Order Pipeline</div>
                <span className="card-link" onClick={() => onNavigate('orders')}>View all →</span>
              </div>
              {total === 0 ? (
                <div style={{ color: 'var(--t3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No orders for this period.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {funnelRows.map(row => {
                    const rowPct = total > 0 ? Math.round(row.val / total * 100) : 0;
                    return (
                      <div key={row.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                          <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontWeight: 700, color: row.color }}>
                            {row.val} <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: 10 }}>({rowPct}%)</span>
                          </span>
                        </div>
                        <div style={{ background: 'var(--card-2)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${rowPct}%`, background: row.color, opacity: 0.8, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Performance gauges */}
            <div className="card" style={{ marginBottom: 0, animationDelay: '0.3s', animation: 'fadeIn 0.35s ease both' }}>
              <div className="card-header"><div className="card-label">Performance</div></div>
              <div className="dash-gauge">
                <div>
                  <div className="dash-gauge-header">
                    <div className="dash-gauge-label">Confirmation</div>
                    <div className="dash-gauge-val" style={{ color: confRate === null ? 'var(--t3)' : confRate >= 70 ? 'var(--green)' : confRate >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
                      {confRate !== null ? `${confRate}%` : '—'}
                    </div>
                  </div>
                  <div className="dash-gauge-bg">
                    <div className="dash-gauge-fill" style={{ width: `${confRate ?? 0}%`, background: confRate >= 70 ? 'var(--green)' : confRate >= 50 ? 'var(--yellow)' : 'var(--red)' }} />
                  </div>
                  <div className="dash-gauge-hint">Target 70%+</div>
                </div>
                <div>
                  <div className="dash-gauge-header">
                    <div className="dash-gauge-label">Return Rate</div>
                    <div className="dash-gauge-val" style={{ color: returnRate === null ? 'var(--t3)' : returnRate <= 15 ? 'var(--green)' : returnRate <= 30 ? 'var(--yellow)' : 'var(--red)' }}>
                      {returnRate !== null ? `${returnRate}%` : '—'}
                    </div>
                  </div>
                  <div className="dash-gauge-bg">
                    <div className="dash-gauge-fill" style={{ width: `${returnRate ?? 0}%`, background: returnRate <= 15 ? 'var(--green)' : returnRate <= 30 ? 'var(--yellow)' : 'var(--red)' }} />
                  </div>
                  <div className="dash-gauge-hint">Keep below 20%</div>
                </div>
              </div>
            </div>

            {/* Daily Goal */}
            <div className="card" style={{ marginBottom: 0, animationDelay: '0.35s', animation: 'fadeIn 0.35s ease both' }}>
              <div className="card-header">
                <div className="card-label">{t.dailyGoal}</div>
                <span className="card-link" onClick={() => { setGoalInput(dailyGoal > 0 ? String(dailyGoal) : ''); setEditingGoal(true); }}>✎ Edit</span>
              </div>
              {editingGoal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                    placeholder={t.goalPlaceholder} autoFocus className="form-input" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveGoal}>{t.goalSave}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingGoal(false)}>{t.goalCancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dash-goal-row">
                    <div className="dash-goal-val">{todayRevenue.toLocaleString()}</div>
                    <div className="dash-goal-target">/ {dailyGoal > 0 ? `${dailyGoal.toLocaleString()} MAD` : 'no goal set'}</div>
                  </div>
                  <div className="dash-goal-bar-bg">
                    <div className="dash-goal-bar-fill" style={{ width: `${clampedPct}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: clampedPct >= 100 ? 'var(--green)' : 'var(--t3)', fontWeight: 600 }}>
                    {dailyGoal > 0
                      ? clampedPct >= 100
                        ? t.goalReached
                        : `${(dailyGoal - todayRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t.goalToGo} — ${pct.toFixed(0)}%`
                      : t.goalHint
                    }
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>{current.delivered ?? 0}</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Delivered</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-soft)' }}>{cleanProfit.toLocaleString()}</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Net Profit</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Team Today */}
            <div className="card dash-col2" style={{ marginBottom: 0, animationDelay: '0.4s', animation: 'fadeIn 0.35s ease both' }}>
              <div className="card-header">
                <div className="card-label">{t.teamToday}</div>
              </div>
              {teamToday.length === 0 ? (
                <div style={{ color: 'var(--t3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>{t.noActivity}</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0 }}>
                  {teamToday.map((m, i) => {
                    const avColors = ['135deg,#7C6AF7,#A78BFA','135deg,#34D399,#059669','135deg,#F87171,#DC2626','135deg,#FBBF24,#D97706','135deg,#60A5FA,#2563EB','135deg,#A78BFA,#7C6AF7'];
                    const delivRate = m.orders > 0 && m.delivered != null ? Math.round(m.delivered / m.orders * 100) : null;
                    const half = Math.ceil(teamToday.length / 2);
                    const isRight = !isMobile && i >= half;
                    return (
                      <div key={i} className="dash-team-row" style={{
                        paddingLeft: isRight ? 16 : 0,
                        paddingRight: isRight ? 0 : 16,
                        borderLeft: isRight ? '1px solid var(--border)' : 'none',
                      }}>
                        <div className="dash-team-av" style={{ background: `linear-gradient(${avColors[i % avColors.length]})` }}>
                          {(m.name || 'T')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="dash-team-name">{m.name}</div>
                          <div className="dash-team-stat">{m.orders} {t.orders}</div>
                          {delivRate !== null && (
                            <div className="dash-team-bar-bg">
                              <div className="dash-team-bar-fill" style={{ width: `${delivRate}%` }} />
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          {m.delivered != null && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--green-a)', color: 'var(--green)' }}>
                              {m.delivered} del.
                            </span>
                          )}
                          {delivRate !== null && <div className="dash-team-rate">{delivRate}%</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Low Stock */}
            {lowStockItems.length > 0 && (
              <div className="card dash-col2" style={{ marginBottom: 0, animationDelay: '0.45s', animation: 'fadeIn 0.35s ease both' }}>
                <div className="card-header">
                  <div className="card-label">{t.lowStock}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', background: 'var(--red-a)', color: 'var(--red)', borderRadius: 5 }}>{lowStockItems.length} items</span>
                    <span className="card-link" onClick={() => onNavigate('stock')}>{t.addStock} →</span>
                  </div>
                </div>
                <div>
                  {lowStockItems.slice(0, 6).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < Math.min(lowStockItems.length, 6) - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{item.product_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
                          {[item.size, item.color].filter(Boolean).join(' · ')} · threshold {item.threshold}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 6,
                        background: item.stock === 0 ? 'var(--red-a)' : 'var(--yellow-a)',
                        color: item.stock === 0 ? 'var(--red)' : 'var(--yellow)',
                      }}>
                        {item.stock === 0 ? t.outOfStock : `${item.stock} ${t.left}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
