import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboardStats, getReportSummary, getProducts, getMyStats, getSetting, setSetting, errorMessage } from '../api';

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
    toConfirm: 'To Confirm', inDelivery: 'In Delivery',
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
    toConfirm: 'À confirmer', inDelivery: 'En livraison',
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
    toConfirm: 'للتأكيد', inDelivery: 'قيد التوصيل',
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate, user, lang = 'en' }) {
  const t = T[lang] || T.en;
  const isConfirmer = user?.role === 'confirmer';

  // Admin state
  const [lowStockOpen, setLowStockOpen] = useState(true);
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

        {confError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{confError}</div>}

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
  const current   = stats?.current   || {};
  const previous  = stats?.previous  || {};
  const hasPrev   = stats?.has_previous ?? false;
  const teamToday = stats?.team_today || [];
  const cleanProfit = stats?.clean_profit ?? 0;

  const pct = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;
  const clampedPct = Math.min(pct, 100);

  const kpiCards = [
    { label: t.toConfirm,  key: 'to_confirm',  color: '#fbbf24' },
    { label: t.inDelivery, key: 'in_delivery',  color: '#60a5fa' },
    { label: t.delivered,  key: 'delivered',    color: '#4ade80' },
    { label: t.returned,   key: 'returned',     color: '#f87171' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            {t.periods.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {period === 'custom' && (
            <>
              <input className="form-input" type="date" style={{ width: 'auto' }}
                value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span style={{ color: '#8892b0' }}>{t.to}</span>
              <input className="form-input" type="date" style={{ width: 'auto' }}
                value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              <button className="btn btn-primary btn-sm"
                onClick={() => loadStats('custom', customStart, customEnd)}>
                {t.apply}
              </button>
            </>
          )}
        </div>
      </div>

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

      {loadError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{loadError}</div>}

      {loading ? <div className="loading">Loading...</div> : (
        <>
          {/* 4 KPI Cards + Clean Profit */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
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

          {/* Charts — Orders Trend + Pipeline Funnel */}
          {(() => {
            const dailyOrders = stats?.daily_orders || [];
            const total = (current.to_confirm ?? 0) + (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
            const sentToDelivery = (current.in_delivery ?? 0) + (current.delivered ?? 0) + (current.returned ?? 0);
            const funnelRows = [
              { label: t.toConfirm,  val: current.to_confirm ?? 0,  color: '#fbbf24', note: null },
              { label: t.inDelivery, val: sentToDelivery,            color: '#60a5fa', note: null },
              { label: t.delivered,  val: current.delivered ?? 0,   color: '#4ade80', note: null },
              { label: t.returned,   val: current.returned ?? 0,    color: '#f87171', note: null },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

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
