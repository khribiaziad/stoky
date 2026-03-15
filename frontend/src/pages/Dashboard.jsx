import { useState, useEffect } from 'react';
import { getReportSummary, getMyStats, getProducts, getTopProducts, getSetting, setSetting } from '../api';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export default function Dashboard({ onNavigate, user }) {
  const [period, setPeriod] = useState('this_month');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin-only extras
  const [lowStockItems, setLowStockItems] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [topProducts, setTopProducts] = useState([]);

  const isConfirmer = user?.role === 'confirmer';

  // Low stock — runs once on mount (admin only)
  useEffect(() => {
    if (isConfirmer) return;
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
  }, [isConfirmer]);

  // Today's revenue, daily goal, top products — admin only
  useEffect(() => {
    if (isConfirmer) return;
    getReportSummary({ period: 'today' })
      .then(r => setTodayRevenue(r.data.financials.revenue))
      .catch(() => {});
    getSetting('daily_revenue_goal')
      .then(r => {
        const val = parseFloat(r.data.value);
        if (!isNaN(val) && val > 0) {
          setDailyGoal(val);
          setGoalInput(String(val));
        }
      })
      .catch(() => {});
    getTopProducts({ period: 'this_week' })
      .then(r => setTopProducts(r.data.slice(0, 5)))
      .catch(() => {});
  }, [isConfirmer]);

  const load = (p) => {
    setLoading(true);
    const params = p === 'all' ? {} : { period: p };
    const request = isConfirmer ? getMyStats(params) : getReportSummary(params);
    request
      .then(r => setSummary(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(period); }, [period]);

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0) return;
    try {
      await setSetting('daily_revenue_goal', val);
      setDailyGoal(val);
      setEditingGoal(false);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Confirmer Dashboard ────────────────────────────────────────────────────
  if (isConfirmer) {
    const o = summary?.orders || {};
    const earnings = summary?.earnings ?? 0;
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">My Dashboard</h1>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">My Orders</div>
                <div className="stat-value blue">{o.total ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Delivered</div>
                <div className="stat-value green">{o.delivered ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Returned</div>
                <div className="stat-value red">{o.cancelled ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">My Earnings</div>
                <div className="stat-value purple">{earnings.toLocaleString()} MAD</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">My Orders Overview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Pending</span>
                  <span className="badge badge-yellow">{o.pending ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Delivered</span>
                  <span className="badge badge-green">{o.delivered ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Returned</span>
                  <span className="badge badge-red">{o.cancelled ?? 0}</span>
                </div>
                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>Delivery Rate</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>{o.delivery_rate ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>Return Rate</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{o.return_rate ?? 0}%</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Quick Actions</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => onNavigate('orders')}>Upload Pickup PDF</button>
                <button className="btn btn-secondary" onClick={() => onNavigate('orders')}>Process Returns</button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────────────────────────
  const f = summary?.financials || {};
  const c = summary?.capital || {};
  const o = summary?.orders || {};
  const pct = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;
  const clampedPct = Math.min(pct, 100);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <select
          className="form-input"
          style={{ width: 'auto', padding: '6px 12px' }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* ── Low Stock Alerts ── */}
      {lowStockItems.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid #f59e0b44' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 15 }}>Low Stock Alerts</span>
              <span style={{
                background: '#f59e0b22', color: '#f59e0b',
                borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {lowStockItems.length}
              </span>
            </div>
            <button
              onClick={() => onNavigate('stock')}
              className="btn btn-sm"
              style={{ borderColor: '#f59e0b', color: '#f59e0b', fontSize: 12 }}
            >
              + Add Stock
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lowStockItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                border: `1px solid ${item.stock === 0 ? '#f8717133' : '#f59e0b33'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.product}</span>
                  {item.variant && (
                    <span style={{ color: '#8892b0', marginLeft: 8, fontSize: 13 }}>{item.variant}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, fontSize: 13 }}>
                  <span style={{ color: '#8892b0' }}>
                    threshold: <span style={{ color: '#e2e8f0' }}>{item.threshold}</span>
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: item.stock === 0 ? '#f87171' : '#f59e0b',
                    minWidth: 72, textAlign: 'right',
                  }}>
                    {item.stock === 0 ? '● OUT' : `${item.stock} left`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* Capital */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Capital</div>
              <div className="stat-value purple">{(c.total_capital ?? 0).toLocaleString()} MAD</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cash Balance</div>
              <div className="stat-value blue">{(c.cash_balance ?? 0).toLocaleString()} MAD</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Stock Value</div>
              <div className="stat-value">{(c.stock_value ?? 0).toLocaleString()} MAD</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Clean Profit</div>
              <div className={`stat-value ${(f.clean_profit ?? 0) >= 0 ? 'green' : 'red'}`}>
                {(f.clean_profit ?? 0).toLocaleString()} MAD
              </div>
            </div>
          </div>

          {/* Daily Goal + Top Products */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* Daily Revenue Goal Tracker */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0 }}>Daily Goal</div>
                <span style={{
                  fontSize: 11, color: '#8892b0', background: 'var(--bg)',
                  padding: '2px 8px', borderRadius: 6, fontWeight: 500,
                }}>Today</span>
              </div>

              {editingGoal ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    type="number"
                    className="form-input"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    placeholder="e.g. 5000"
                    style={{ flex: 1, fontSize: 14 }}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSaveGoal}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingGoal(false)}>✕</button>
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
                  >
                    ✎
                  </button>
                </div>
              )}

              {dailyGoal > 0 ? (
                <>
                  <div style={{ background: 'var(--bg)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 999,
                      width: `${clampedPct}%`,
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
                        ? '✓ Goal reached!'
                        : `${(dailyGoal - todayRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD to go`}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#8892b0' }}>
                  Click ✎ to set a daily revenue goal.
                </div>
              )}
            </div>

            {/* Best Products This Week */}
            <div className="card">
              <div className="card-title">Best Products This Week</div>
              {topProducts.length === 0 ? (
                <div style={{ color: '#8892b0', fontSize: 13 }}>No delivered orders this week yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {topProducts.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 10px', background: 'var(--bg)', borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 16, minWidth: 26, textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <span style={{
                        flex: 1, fontWeight: 600, color: '#e2e8f0', fontSize: 14,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.product_name}
                      </span>
                      <span style={{ fontSize: 13, color: '#8892b0', flexShrink: 0 }}>
                        {p.total_qty} units
                      </span>
                      {p.revenue > 0 && (
                        <span style={{
                          fontSize: 13, color: '#4ade80', fontWeight: 600,
                          flexShrink: 0, minWidth: 80, textAlign: 'right',
                        }}>
                          {p.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revenue & Orders */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div className="card-title">Revenue</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>
                {(f.revenue ?? 0).toLocaleString()} MAD
              </div>
              <div style={{ fontSize: 13, color: '#8892b0' }}>
                Gross profit: <span style={{ color: '#4ade80' }}>{(f.gross_profit ?? 0).toLocaleString()} MAD</span>
              </div>
              <hr className="divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8892b0' }}>Team costs</div>
                  <div style={{ color: '#f87171' }}>-{(f.team_costs ?? 0).toLocaleString()} MAD</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8892b0' }}>Fixed expenses</div>
                  <div style={{ color: '#f87171' }}>-{(f.fixed_costs ?? 0).toLocaleString()} MAD</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8892b0' }}>Facebook ads</div>
                  <div style={{ color: '#f87171' }}>-{(f.ads_costs ?? 0).toLocaleString()} MAD</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Orders Overview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Total Orders</span>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{o.total ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Delivered</span>
                  <span className="badge badge-green">{o.delivered ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Pending</span>
                  <span className="badge badge-yellow">{o.pending ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8892b0' }}>Returned</span>
                  <span className="badge badge-red">{o.cancelled ?? 0}</span>
                </div>
                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>Delivery Rate</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>{o.delivery_rate ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8892b0' }}>Return Rate</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{o.return_rate ?? 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-title">Quick Actions</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => onNavigate('orders')}>Upload Pickup PDF</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('orders')}>Process Returns</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('stock')}>+ Add Stock</button>
              <button className="btn btn-secondary" onClick={() => onNavigate('products')}>+ Add Product</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
