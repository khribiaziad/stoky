import { useState, useEffect } from 'react';
import { getReportSummary, getTopProducts, getTopCities } from '../api';

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
  { value: '', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

export default function Reports() {
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topCities, setTopCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState(false);
  const [prevSummary, setPrevSummary] = useState(null);
  const [prevTopProducts, setPrevTopProducts] = useState([]);
  const [prevTopCities, setPrevTopCities] = useState([]);

  const getPrevPeriodParams = () => {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    if (period === 'today') {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      return { start: fmt(d), end: fmt(d) };
    }
    if (period === 'yesterday') {
      const d = new Date(today); d.setDate(d.getDate() - 2);
      return { start: fmt(d), end: fmt(d) };
    }
    if (period === 'last_7_days') {
      const end = new Date(today); end.setDate(end.getDate() - 7);
      const start = new Date(today); start.setDate(start.getDate() - 14);
      return { start: fmt(start), end: fmt(end) };
    }
    if (period === 'this_week') {
      const day = today.getDay();
      const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const prevEnd = new Date(startOfWeek); prevEnd.setDate(startOfWeek.getDate() - 1);
      const prevStart = new Date(startOfWeek); prevStart.setDate(startOfWeek.getDate() - 7);
      return { start: fmt(prevStart), end: fmt(prevEnd) };
    }
    if (period === 'this_month') {
      const year = today.getFullYear(), month = today.getMonth();
      const prevStart = new Date(year, month - 1, 1);
      const prevEnd = new Date(year, month, 0);
      return { start: fmt(prevStart), end: fmt(prevEnd) };
    }
    return null;
  };

  const load = () => {
    setLoading(true);
    const params = { period: period || undefined };
    if (period === 'custom') {
      params.start = customStart;
      params.end = customEnd;
    }

    Promise.all([
      getReportSummary(params),
      getTopProducts(params),
      getTopCities(params),
    ]).then(([s, p, c]) => {
      setSummary(s.data);
      setTopProducts(p.data);
      setTopCities(c.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (period !== 'custom') load();
  }, [period]);

  useEffect(() => {
    if (!compare || period === 'custom' || !period) {
      setPrevSummary(null);
      setPrevTopProducts([]);
      setPrevTopCities([]);
      return;
    }
    const pp = getPrevPeriodParams();
    if (!pp) { setPrevSummary(null); setPrevTopProducts([]); setPrevTopCities([]); return; }
    const prevParams = { period: 'custom', start: pp.start, end: pp.end };
    getReportSummary(prevParams)
      .then(r => setPrevSummary(r.data))
      .catch(() => setPrevSummary(null));
    if (compare && pp) {
      getTopProducts(prevParams).then(r => setPrevTopProducts(r.data));
      getTopCities(prevParams).then(r => setPrevTopCities(r.data));
    }
  }, [compare, period]);

  const f = summary?.financials || {};
  const c = summary?.capital || {};
  const o = summary?.orders || {};

  return (
    <div>
      <style>{`
        @media print {
          nav, aside, .sidebar, header, .topbar,
          .no-print, button { display: none !important; }
          body, * { background: white !important; color: black !important; }
          .card, .section-card { border: 1px solid #ccc !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {period === 'custom' && (
            <>
              <input className="form-input" type="date" style={{ width: 'auto' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span style={{ color: '#8892b0' }}>to</span>
              <input className="form-input" type="date" style={{ width: 'auto' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              <button className="btn btn-primary" onClick={load}>Apply</button>
            </>
          )}
          {!['', 'custom'].includes(period) && (
            <button
              className={`btn btn-sm ${compare ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCompare(v => !v)}
              title="Compare to previous period">
              ⇄ Compare
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print / Save as PDF">
            🖨 Print
          </button>
        </div>
      </div>

      {loading ? <div className="loading">Loading reports...</div> : (
        <>
          {/* Capital Summary */}
          {compare && prevSummary && (
            <div style={{ background: '#1a1a2e', border: '1px solid #2d3248', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#8892b0' }}>
              ⇄ Comparing to previous period
            </div>
          )}
          <div className="stat-grid">
            {[
              { label: 'Revenue', val: f.revenue, prev: prevSummary?.financials?.revenue, cls: 'blue' },
              { label: 'Gross Profit', val: f.gross_profit, prev: prevSummary?.financials?.gross_profit, cls: f.gross_profit >= 0 ? 'green' : 'red' },
              { label: 'Clean Profit', val: f.clean_profit, prev: prevSummary?.financials?.clean_profit, cls: f.clean_profit >= 0 ? 'green' : 'red' },
              { label: 'Total Capital', val: c.total_capital, prev: null, cls: 'purple' },
              { label: 'Cash Balance', val: c.cash_balance, prev: null, cls: 'blue' },
              { label: 'Stock Value', val: c.stock_value, prev: null, cls: '' },
            ].map(item => {
              const diff = (compare && item.prev != null && item.val != null) ? item.val - item.prev : null;
              return (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className={`stat-value ${item.cls}`}>{item.val?.toLocaleString()} MAD</div>
                  {diff !== null && (
                    <div style={{ fontSize: 11, color: diff >= 0 ? '#4ade80' : '#f87171', marginTop: 2 }}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()} vs prev
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Expenses Breakdown */}
            <div className="card">
              <div className="card-title">Expenses Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Team Costs', value: f.team_costs },
                  { label: 'Fixed Expenses', value: f.fixed_costs },
                  { label: 'Facebook Ads', value: f.ads_costs },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#8892b0' }}>{item.label}</span>
                    <span style={{ fontWeight: 600, color: '#f87171' }}>{item.value?.toLocaleString()} MAD</span>
                  </div>
                ))}
                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Total Expenses</span>
                  <span style={{ fontWeight: 700, color: '#f87171' }}>
                    {((f.team_costs || 0) + (f.fixed_costs || 0) + (f.ads_costs || 0)).toLocaleString()} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* Orders Stats */}
            <div className="card">
              <div className="card-title">Orders Performance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Total Orders', value: o.total, unit: '' },
                  { label: 'Delivered', value: o.delivered, unit: '' },
                  { label: 'Returned', value: o.cancelled, unit: '' },
                  { label: 'Pending', value: o.pending, unit: '' },
                  { label: 'Delivery Rate', value: o.delivery_rate, unit: '%' },
                  { label: 'Return Rate', value: o.return_rate, unit: '%' },
                  { label: 'Avg Order Value', value: o.avg_order_value, unit: ' MAD' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#8892b0' }}>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value}{item.unit}</span>
                  </div>
                ))}
                {f.ads_costs > 0 && (
                  <>
                    <hr className="divider" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#8892b0' }}>Ads Cost / Order</span>
                      <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                        {o.delivered > 0 ? `${(f.ads_costs / o.delivered).toFixed(1)} MAD` : '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top Products */}
            <div className="card">
              <div className="card-title">Top Products</div>
              {topProducts.length === 0 ? (
                <div style={{ color: '#8892b0', textAlign: 'center', padding: 20 }}>No data yet</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>Product</th><th>Units Sold</th><th>Orders</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {topProducts.map((p, i) => {
                        const prev = prevTopProducts.find(x => x.product_name === p.product_name);
                        const delta = compare && prev ? p.total_qty - prev.total_qty : null;
                        return (
                          <tr key={p.product_name}>
                            <td style={{ color: '#8892b0' }}>{i + 1}</td>
                            <td style={{ fontWeight: 500 }}>{p.product_name}</td>
                            <td style={{ fontWeight: 600, color: '#4ade80' }}>
                              {p.total_qty}
                              {delta !== null && <span style={{ fontSize: 11, marginLeft: 4, color: delta >= 0 ? '#4ade80' : '#f87171' }}>{delta >= 0 ? '+' : ''}{delta}</span>}
                            </td>
                            <td>{p.order_count}</td>
                            <td>{(p.revenue || 0).toLocaleString()} MAD</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Cities */}
            <div className="card">
              <div className="card-title">Top Cities</div>
              {topCities.length === 0 ? (
                <div style={{ color: '#8892b0', textAlign: 'center', padding: 20 }}>No data yet</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>City</th><th>Orders</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {topCities.map((c, i) => {
                        const prev = prevTopCities.find(x => x.city === c.city);
                        const delta = compare && prev ? c.order_count - prev.order_count : null;
                        return (
                          <tr key={c.city}>
                            <td style={{ color: '#8892b0' }}>{i + 1}</td>
                            <td style={{ fontWeight: 500 }}>{c.city}</td>
                            <td style={{ fontWeight: 600, color: '#60a5fa' }}>
                              {c.order_count}
                              {delta !== null && <span style={{ fontSize: 11, marginLeft: 4, color: delta >= 0 ? '#4ade80' : '#f87171' }}>{delta >= 0 ? '+' : ''}{delta}</span>}
                            </td>
                            <td>{c.revenue?.toLocaleString()} MAD</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
