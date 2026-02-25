import { useState, useEffect } from 'react';
import {
  Store, CheckCircle, XCircle, Clock, AlertTriangle,
  ArrowRight, Database,
} from 'lucide-react';
import { getPlatformStats, getPlatformGrowth, getPlatformStores, getStoreStorage } from '../../api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

// ── Growth Chart ──────────────────────────────────────────────────────────────

function GrowthChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ flex: 1 }}>
        <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>New Stores / Month</div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>
      </div>
    );
  }
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
                <rect x={x} y={y} width={barW} height={barH} rx={5} fill="var(--accent)" opacity={0.85} />
                {d.count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>{d.count}</text>
                )}
                <text x={x + barW / 2} y={padY + chartH + 16} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
                  {MONTHS[d.month - 1]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Needs Attention ───────────────────────────────────────────────────────────

function NeedsAttention({ stores, onNavigate }) {
  const flagged = stores.filter(s => {
    const days = daysUntil(s.subscription.end_date);
    const expiringSoon  = days !== null && days >= 0 && days <= 7;
    const expiredActive = s.subscription.status === 'expired' && s.is_approved;
    const needsRenewal  = s.subscription.needs_renewal;
    return expiringSoon || expiredActive || needsRenewal;
  }).map(s => {
    const days = daysUntil(s.subscription.end_date);
    let reason = '';
    if (s.subscription.needs_renewal) reason = 'Flagged for renewal';
    else if (s.subscription.status === 'expired' && s.is_approved) reason = 'Expired but still active';
    else if (days !== null && days >= 0 && days <= 7) reason = days === 0 ? 'Expires today' : `Expires in ${days} day${days !== 1 ? 's' : ''}`;
    return { ...s, reason };
  });

  if (flagged.length === 0) return null;

  return (
    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: 0, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b' }} strokeWidth={1.75} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>Needs Attention ({flagged.length})</span>
      </div>
      {flagged.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.store_name}</div>
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 1 }}>{s.reason}</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            onClick={() => onNavigate('stores')}
          >
            Manage <ArrowRight size={12} strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Top Storage Users ─────────────────────────────────────────────────────────

function TopStorageCard({ stores }) {
  const [storageData, setStorageData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const top5 = [...stores].sort((a, b) => b.order_count - a.order_count).slice(0, 5);
    if (top5.length === 0) { setLoading(false); return; }

    Promise.all(top5.map(s => getStoreStorage(s.id).then(r => ({ ...s, storage: r.data })).catch(() => ({ ...s, storage: { total_rows: 0, estimated_kb: 0 } }))))
      .then(results => {
        setStorageData(results.sort((a, b) => b.storage.total_rows - a.storage.total_rows));
        setLoading(false);
      });
  }, [stores]);

  const max = Math.max(...storageData.map(s => s.storage.total_rows), 1);

  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          Top Storage Users
        </div>
      </div>
      <div style={{ padding: '8px 0' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : storageData.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No stores yet</div>
        ) : storageData.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px' }}>
            <div style={{ width: 22, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>#{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.store_name}</div>
              <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${(s.storage.total_rows / max) * 100}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {s.storage.total_rows.toLocaleString()} rows
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Stores by Orders ──────────────────────────────────────────────────────

function TopOrders({ stores }) {
  const top = [...stores].sort((a, b) => b.order_count - a.order_count).slice(0, 5);
  const maxOrders = Math.max(...top.map(s => s.order_count), 1);

  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--border)' }}>Top Stores by Orders</div>
      <div style={{ padding: '8px 0' }}>
        {top.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No stores yet</div>
        ) : top.map((store, i) => (
          <div key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px' }}>
            <div style={{ width: 22, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PlatformDashboard({ onNavigate }) {
  const [stats, setStats]   = useState(null);
  const [growth, setGrowth] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPlatformStats(), getPlatformGrowth(), getPlatformStores()])
      .then(([s, g, st]) => { setStats(s.data); setGrowth(g.data); setStores(st.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Platform overview</div>
      </div>

      {!loading && <NeedsAttention stores={stores} onNavigate={onNavigate} />}

      {stats && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon={Store}         label="Total Stores"  value={stats.total}     color="#60a5fa" />
          <StatCard icon={CheckCircle}   label="Active"        value={stats.active}    color="#00d48f" />
          <StatCard icon={XCircle}       label="Suspended"     value={stats.suspended} color="#f87171" />
          <StatCard icon={AlertTriangle} label="Expiring Soon" value={stats.expiring}  color="#f59e0b" />
          <StatCard icon={Clock}         label="Expired"       value={stats.expired}   color="#94a3b8" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <GrowthChart data={growth} />
        <TopOrders stores={stores} />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <TopStorageCard stores={stores} />
      </div>

    </div>
  );
}
