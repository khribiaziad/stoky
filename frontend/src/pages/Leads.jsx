import { useState, useEffect, useRef } from 'react';
import { UserCheck, Trash2, Phone, MapPin, Package, Clock, RefreshCw, CheckCircle, MessageCircle, ChevronDown } from 'lucide-react';
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

function LeadCard({ lead, onUpdate, onDelete }) {
  const [confirming,  setConfirming]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState('');
  const [dropOpen,    setDropOpen]    = useState(false);
  const [showReport,  setShowReport]  = useState(false);
  const [reportDate,  setReportDate]  = useState('');
  const dropRef = useRef();

  const isPending = lead.status === 'pending' || lead.status === 'unresponsive' || lead.status === 'reported';

  const digits  = lead.customer_phone.replace(/\D/g, '');
  const waPhone = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
  const items   = lead.matched_items || lead.raw_items || [];
  const date    = lead.created_at ? new Date(lead.created_at).toLocaleString('fr-MA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const itemsText = items.map(i => `${i.product_name} ×${i.quantity}`).join(', ');
  const waMsg = encodeURIComponent(
    `Bonjour ${lead.customer_name} ! 👋\n` +
    `Nous avons bien reçu votre commande : ${itemsText || 'à confirmer'}.\n` +
    (lead.total_amount ? `Total : ${lead.total_amount.toFixed(0)} MAD\n` : '') +
    `Pouvez-vous confirmer ?`
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const handleDropAction = async (action) => {
    setDropOpen(false);
    setError('');
    try {
      if (action === 'report') {
        setReportDate(lead.reported_date ? lead.reported_date.slice(0, 10) : '');
        setShowReport(true);
        return;
      }
      if (action === 'not-answering') {
        await notAnsweringLead(lead.id);
        onUpdate(lead.id, 'unresponsive');
      }
      if (action === 'cancel') {
        await cancelLead(lead.id);
        onUpdate(lead.id, 'cancelled');
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportDate) return;
    try {
      await reportLead(lead.id, reportDate);
      onUpdate(lead.id, 'reported', reportDate);
      setShowReport(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

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

  return (
    <div className="card" style={{ padding: '16px 18px', opacity: lead.status === 'cancelled' ? 0.65 : 1 }}>

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{lead.customer_name}</span>
          <StatusBadge status={lead.status} />
          {lead.status === 'reported' && lead.reported_date && (
            <span style={{ fontSize: 12, color: '#a855f7', fontWeight: 600 }}>
              📅 {new Date(lead.reported_date).toLocaleDateString()}
            </span>
          )}
        </div>
        {lead.total_amount != null && (
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
            {lead.total_amount.toFixed(0)} MAD
          </span>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px', fontSize: 13, color: 'var(--t2)', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Phone size={12} strokeWidth={1.75} />
          {lead.customer_phone}
        </span>
        {lead.customer_city && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={12} strokeWidth={1.75} />
            {lead.customer_city}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={12} strokeWidth={1.75} />
          {date}
        </span>
      </div>

      {/* Items */}
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

      {lead.notes && (
        <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 10 }}>
          {lead.notes}
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 10, padding: '6px 12px', fontSize: 12 }}>{error}</div>}

      {/* Report date picker */}
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)', alignItems: 'center' }}>

        {/* Call */}
        <a href={`tel:${lead.customer_phone}`}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
        >
          <Phone size={13} strokeWidth={1.75} /> Call
        </a>

        {/* WhatsApp */}
        <a href={`https://wa.me/${waPhone}?text=${waMsg}`}
          target="_blank" rel="noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#25d366', textDecoration: 'none' }}
        >
          <MessageCircle size={13} strokeWidth={1.75} /> WhatsApp
        </a>

        {/* Confirm — primary action */}
        {isPending && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={confirming}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckCircle size={13} strokeWidth={1.75} />
            {confirming ? 'Confirming…' : 'Confirm Order'}
          </button>
        )}

        {/* Status dropdown */}
        {isPending && (
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setDropOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Update <ChevronDown size={12} strokeWidth={2} />
            </button>
            {dropOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,.3)',
              }}>
                {[
                  { action: 'report',        label: '📅 Report',        color: '#a855f7' },
                  { action: 'not-answering', label: '📵 Not Answering',  color: '#6b7280' },
                  { action: 'cancel',        label: '✕ Cancel',         color: '#ef4444' },
                ].map(({ action, label, color }) => (
                  <button
                    key={action}
                    onClick={() => handleDropAction(action)}
                    style={{
                      display: 'block', width: '100%', padding: '9px 14px',
                      background: 'none', border: 'none', textAlign: 'left',
                      cursor: 'pointer', fontSize: 13, color,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete */}
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
  );
}

export default function Leads() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('pending');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getLeads();
      setLeads(res.data);
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

  const counts = {
    all:          leads.length,
    pending:      leads.filter(l => l.status === 'pending').length,
    unresponsive: leads.filter(l => l.status === 'unresponsive').length,
    cancelled:    leads.filter(l => l.status === 'cancelled').length,
  };

  const visibleLeads = filter === 'all' ? leads : leads.filter(l => l.status === filter);

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
              onClick={() => setFilter(key)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleLeads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
