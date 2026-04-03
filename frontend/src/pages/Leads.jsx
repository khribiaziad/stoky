import { useState, useEffect } from 'react';
import { UserCheck, Trash2, Phone, MapPin, Package, Clock, RefreshCw, CheckCircle, MessageCircle } from 'lucide-react';
import { getLeads, deleteLead, confirmLead, cancelLead, notAnsweringLead, reportLead, errorMessage } from '../api';
import ErrorExplain from '../components/ErrorExplain';

const STATUS_CONFIG = {
  pending:      { label: 'New Lead',      color: '#f59e0b', bg: '#f59e0b1f' },
  reported:     { label: 'Reported',      color: '#a855f7', bg: '#a855f71f' },
  unresponsive: { label: 'Not Answering', color: '#6b7280', bg: '#6b72801f' },
  cancelled:    { label: 'Cancelled',     color: '#ef4444', bg: '#ef44441f' },
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

const leadCardStyle = (lead, isDueToday) => {
  if (isDueToday) return { borderLeft: '3px solid #a855f7', background: 'rgba(168,85,247,0.10)' };
  const S = {
    pending:      { borderLeft: '3px solid rgba(245,166,35,0.5)',  background: 'rgba(245,166,35,0.045)' },
    reported:     { borderLeft: '3px dashed rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.05)' },
    unresponsive: { borderLeft: '3px solid rgba(107,114,128,0.4)', background: 'rgba(107,114,128,0.03)' },
    cancelled:    { borderLeft: '3px solid rgba(240,79,79,0.4)',   background: 'rgba(240,79,79,0.03)' },
  };
  return S[lead.status] || {};
};

function LeadCard({ lead, isExpanded, onToggle, onUpdate, onDelete }) {
  const [confirming,  setConfirming]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState('');
  const [showReport,  setShowReport]  = useState(false);
  const [reportDate,  setReportDate]  = useState('');

  const today     = new Date().toISOString().slice(0, 10);
  const isDueToday = lead.status === 'reported' && lead.reported_date && lead.reported_date.slice(0, 10) === today;
  const isPending  = lead.status === 'pending' || lead.status === 'unresponsive' || lead.status === 'reported';

  const digits  = lead.customer_phone.replace(/\D/g, '');
  const waPhone = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
  const items   = lead.matched_items || lead.raw_items || [];
  const date    = lead.created_at
    ? new Date(lead.created_at).toLocaleString('fr-MA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const itemsText = items.map(i => `${i.product_name} ×${i.quantity}`).join(', ');
  const waMsg = encodeURIComponent(
    `Bonjour ${lead.customer_name} ! 👋\n` +
    `Nous avons bien reçu votre commande : ${itemsText || 'à confirmer'}.\n` +
    (lead.total_amount ? `Total : ${lead.total_amount.toFixed(0)} MAD\n` : '') +
    `Pouvez-vous confirmer ?`
  );

  const firstItem   = items[0];
  const itemSummary = firstItem
    ? `${firstItem.product_name}${items.length > 1 ? ` +${items.length - 1}` : ''}`.slice(0, 30)
    : null;

  const handleConfirm = async () => {
    setConfirming(true); setError('');
    try {
      await confirmLead(lead.id);
      onUpdate(lead.id, 'confirmed');
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    }
  };

  const handleNotAnswering = async () => {
    setError('');
    try {
      await notAnsweringLead(lead.id);
      onUpdate(lead.id, 'unresponsive');
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleCancel = async () => {
    setError('');
    try {
      await cancelLead(lead.id);
      onUpdate(lead.id, 'cancelled');
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportDate) return;
    try {
      await reportLead(lead.id, reportDate);
      onUpdate(lead.id, 'reported', reportDate);
      setShowReport(false);
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete lead from ${lead.customer_name}?`)) return;
    setDeleting(true);
    try {
      await deleteLead(lead.id);
      onDelete(lead.id);
    } catch { setDeleting(false); }
  };

  return (
    <div
      className={isDueToday ? 'lead-due-today-card' : ''}
      style={{
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        opacity: lead.status === 'cancelled' ? 0.65 : 1,
        ...leadCardStyle(lead, isDueToday),
      }}
    >
      {/* Collapsed header — always visible, click to toggle */}
      <div
        onClick={onToggle}
        style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{lead.customer_name}</span>
            <StatusBadge status={lead.status} />
            {isDueToday && <span className="lead-due-today-pill">⚡ Due Today</span>}
            {lead.status === 'reported' && !isDueToday && lead.reported_date && (
              <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.1)', color: '#a855f7', padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                📅 {new Date(lead.reported_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>📞 {lead.customer_phone}</span>
            {(lead.customer_city || lead.customer_address) && (
              <span>📍 {[lead.customer_city, lead.customer_address].filter(Boolean).join(' — ')}</span>
            )}
            {itemSummary && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>📦 {itemSummary}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {lead.total_amount != null && (
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>
              {lead.total_amount.toFixed(0)} MAD
            </span>
          )}
          {isPending && (
            <button
              className="btn btn-primary btn-sm"
              onClick={e => { e.stopPropagation(); handleConfirm(); }}
              disabled={confirming}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <CheckCircle size={12} strokeWidth={1.75} />
              {confirming ? '…' : 'Confirm'}
            </button>
          )}
          <span style={{ color: 'var(--t3)', fontSize: 11, userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'rgba(0,0,0,0.12)' }}>

          {/* Full items list */}
          {items.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {items.map((item, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 99,
                  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <Package size={11} strokeWidth={1.75} />
                  {item.product_name} ×{item.quantity}
                </span>
              ))}
            </div>
          )}

          {/* Meta: date + callback date */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} strokeWidth={1.75} />
              {date}
            </span>
            {lead.status === 'reported' && lead.reported_date && (
              <span style={{ color: isDueToday ? '#a855f7' : 'var(--t2)', fontWeight: isDueToday ? 700 : 400 }}>
                📅 Callback: {new Date(lead.reported_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {lead.notes && (
            <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 10 }}>
              📝 {lead.notes}
            </div>
          )}

          {error && <div className="alert alert-error" style={{ marginBottom: 10, padding: '6px 12px', fontSize: 12 }}>{error}</div>}

          {/* Inline report date picker */}
          {showReport && (
            <form onSubmit={handleReport} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '10px 12px', background: 'var(--card-2)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: '#a855f7', fontWeight: 600 }}>📅 Schedule call:</span>
              <input
                className="form-input"
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                required
                autoFocus
                style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
              />
              <button type="submit" className="btn btn-sm" style={{ background: '#a855f7', color: '#fff', border: 'none' }} disabled={!reportDate}>Save</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReport(false)}>✕</button>
            </form>
          )}

          {/* Flat action buttons — no dropdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <a href={`tel:${lead.customer_phone}`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
            >
              <Phone size={12} strokeWidth={1.75} /> Call
            </a>

            <a href={`https://wa.me/${waPhone}?text=${waMsg}`}
              target="_blank" rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#25d366', textDecoration: 'none' }}
            >
              <MessageCircle size={12} strokeWidth={1.75} /> WhatsApp
            </a>

            {isPending && (
              <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={confirming}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={12} strokeWidth={1.75} />
                {confirming ? 'Confirming…' : 'Confirm Order'}
              </button>
            )}

            {isPending && !showReport && (
              <button className="btn btn-secondary btn-sm"
                style={{ color: '#a855f7', borderColor: 'rgba(168,85,247,0.5)' }}
                onClick={() => { setReportDate(lead.reported_date ? lead.reported_date.slice(0, 10) : ''); setShowReport(true); }}>
                📅 Report
              </button>
            )}

            {isPending && (
              <button className="btn btn-secondary btn-sm"
                style={{ color: '#6b7280' }}
                onClick={handleNotAnswering}>
                📵 Not Answering
              </button>
            )}

            {isPending && (
              <button className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', borderColor: 'rgba(240,79,79,0.5)' }}
                onClick={handleCancel}>
                ✕ Cancel
              </button>
            )}

            <button
              className="btn-icon"
              title="Delete lead"
              onClick={handleDelete}
              disabled={deleting}
              style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, color: 'var(--t3)' }}
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Leads() {
  const [leads,      setLeads]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [filter,     setFilter]     = useState('pending');
  const [expandedId, setExpandedId] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getLeads();
      setLeads(res.data.leads);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = (id, newStatus, reportedDate) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus, reported_date: reportedDate || l.reported_date } : l));
  };

  const handleDelete = (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const handleFilterChange = (key) => {
    setFilter(key);
    setExpandedId(null);
  };

  const counts = {
    all:          leads.length,
    pending:      leads.filter(l => l.status === 'pending').length,
    unresponsive: leads.filter(l => l.status === 'unresponsive').length,
    cancelled:    leads.filter(l => l.status === 'cancelled').length,
  };

  const visibleLeads = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  return (
    <div>
      <style>{`
        @keyframes lead-pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        @keyframes lead-pulse-border { 0%,100% { border-left-color:#a855f7; } 50% { border-left-color:rgba(168,85,247,0.2); } }
        .lead-due-today-pill { font-size:10px; background:rgba(168,85,247,0.15); color:#a855f7; padding:2px 7px; border-radius:99px; white-space:nowrap; animation:lead-pulse 1.5s ease-in-out infinite; }
        .lead-due-today-card { animation:lead-pulse-border 2s ease-in-out infinite; }
      `}</style>

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

      {leads.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'pending',      label: 'New Leads',     color: '#f59e0b' },
            { key: 'unresponsive', label: 'Not Answering', color: '#6b7280' },
            { key: 'cancelled',    label: 'Cancelled',     color: '#ef4444' },
            { key: 'all',          label: 'All',           color: 'var(--accent)' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: filter === key ? color + '22' : 'var(--card)',
                border: `1px solid ${filter === key ? color : 'var(--border)'}`,
                display: 'flex', gap: 8, alignItems: 'center',
                color: filter === key ? color : 'var(--t2)',
                fontWeight: filter === key ? 700 : 400,
                fontSize: 13, transition: 'all .15s',
              }}
            >
              {label}
              <span style={{
                fontWeight: 700, fontSize: 12,
                background: filter === key ? color + '33' : 'var(--bg)',
                color: filter === key ? color : 'var(--t3)',
                padding: '1px 7px', borderRadius: 99,
              }}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <ErrorExplain message={error} page="Leads" />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)', fontSize: 14 }}>
          Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)', fontSize: 14 }}>
          <UserCheck size={40} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--t2)', marginBottom: 6 }}>No leads yet</div>
          <div>Once customers submit orders on your website, they'll appear here.</div>
        </div>
      ) : visibleLeads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)', fontSize: 14 }}>
          No {filter === 'all' ? '' : filter} leads.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isExpanded={expandedId === lead.id}
              onToggle={() => setExpandedId(prev => prev === lead.id ? null : lead.id)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
