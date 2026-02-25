import { useState, useEffect } from 'react';
import { UserCheck, Trash2, Phone, MapPin, Package, Clock, RefreshCw } from 'lucide-react';
import { getLeads, deleteLead } from '../api';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      color: '#f59e0b', bg: '#f59e0b1f' },
  cancelled:    { label: 'Cancelled',    color: '#ef4444', bg: '#ef44441f' },
  unresponsive: { label: 'Unresponsive', color: '#6b7280', bg: '#6b72801f' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
      padding: '3px 9px', borderRadius: 99,
      color: cfg.color, background: cfg.bg,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  );
}

function LeadCard({ lead, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete lead from ${lead.customer_name}?`)) return;
    setDeleting(true);
    try {
      await deleteLead(lead.id);
      onDelete(lead.id);
    } catch {
      setDeleting(false);
    }
  };

  const waLink = `https://wa.me/${lead.customer_phone.replace(/\D/g, '')}`;
  const items  = lead.matched_items || lead.raw_items || [];
  const date   = lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—';

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

        {/* Left: customer info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{lead.customer_name}</span>
            <StatusBadge status={lead.status} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13, color: 'var(--t2)' }}>
            <a href={waLink} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#25d366', fontWeight: 500, textDecoration: 'none' }}>
              <Phone size={13} strokeWidth={1.75} />
              {lead.customer_phone}
            </a>
            {lead.customer_city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={13} strokeWidth={1.75} />
                {lead.customer_city}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={13} strokeWidth={1.75} />
              {date}
            </span>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((item, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 99,
                  background: 'var(--card-2)', border: '1px solid var(--border)',
                  color: 'var(--t1)',
                }}>
                  <Package size={11} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {item.product_name} ×{item.quantity}
                </span>
              ))}
            </div>
          )}

          {lead.notes && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t2)', fontStyle: 'italic' }}>
              {lead.notes}
            </div>
          )}
        </div>

        {/* Right: amount + delete */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          {lead.total_amount != null && (
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
              {lead.total_amount.toFixed(0)} MAD
            </span>
          )}
          <button
            className="btn-icon"
            title="Delete lead"
            onClick={handleDelete}
            disabled={deleting}
            style={{ width: 30, height: 30, borderRadius: 8, color: 'var(--danger)' }}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>

      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getLeads();
      setLeads(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id) => setLeads(prev => prev.filter(l => l.id !== id));

  const counts = {
    pending:      leads.filter(l => l.status === 'pending').length,
    cancelled:    leads.filter(l => l.status === 'cancelled').length,
    unresponsive: leads.filter(l => l.status === 'unresponsive').length,
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserCheck size={20} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          <h1 className="page-title">Leads</h1>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={13} strokeWidth={1.75} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {leads.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'pending',      label: 'Pending',      color: '#f59e0b' },
            { key: 'cancelled',    label: 'Cancelled',    color: '#ef4444' },
            { key: 'unresponsive', label: 'Unresponsive', color: '#6b7280' },
          ].map(({ key, label, color }) => (
            <div key={key} style={{
              padding: '10px 18px', borderRadius: 'var(--r-sm)',
              background: 'var(--card)', border: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--t2)' }}>{label}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{counts[key]}</span>
            </div>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)', fontSize: 14 }}>
          Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: 'var(--t3)', fontSize: 14,
        }}>
          <UserCheck size={40} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--t2)', marginBottom: 6 }}>No leads yet</div>
          <div>Once customers submit orders on your website, they'll appear here for confirmation.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
