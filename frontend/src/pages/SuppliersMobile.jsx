import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, getSupplierDetail, addSupplierPayment, deleteSupplierPayment } from '../api';

const PLATFORMS = ['Alibaba', 'AliExpress', 'Local', 'Wholesale', 'Direct', 'Other'];

const fmt = (n) => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SuppliersMobile() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', platform: '', notes: '' });
  const [error, setError] = useState('');

  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [showPayment, setShowPayment] = useState(null);
  const [historyTab, setHistoryTab] = useState({}); // { [supplierId]: 'purchases' | 'payments' }

  const load = () => {
    getSuppliers().then(r => setSuppliers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadDetail = async (id) => {
    if (detail[id]) return;
    setLoadingDetail(id);
    try {
      const r = await getSupplierDetail(id);
      setDetail(d => ({ ...d, [id]: r.data }));
    } finally {
      setLoadingDetail(null);
    }
  };

  const toggleExpand = (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadDetail(id);
  };

  const reloadDetail = async (id) => {
    const r = await getSupplierDetail(id);
    setDetail(d => ({ ...d, [id]: r.data }));
    load();
  };

  const openAdd = () => {
    setForm({ name: '', phone: '', platform: '', notes: '' });
    setError('');
    setShowAdd(true);
  };

  const openEdit = (s) => {
    setForm({ name: s.name, phone: s.phone || '', platform: s.platform || '', notes: s.notes || '' });
    setEditingSupplier(s);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, form);
        setEditingSupplier(null);
        setDetail(d => { const copy = { ...d }; delete copy[editingSupplier.id]; return copy; });
      } else {
        await createSupplier(form);
        setShowAdd(false);
      }
      setError('');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error saving supplier'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier? Products will be unlinked.')) return;
    await deleteSupplier(id);
    load();
  };

  const handleAddPayment = async (supplierId) => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { setError('Enter a valid amount'); return; }
    try {
      await addSupplierPayment(supplierId, { ...paymentForm, amount: parseFloat(paymentForm.amount) });
      setShowPayment(null);
      setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
      setError('');
      await reloadDetail(supplierId);
    } catch (e) { setError(e.response?.data?.detail || 'Error adding payment'); }
  };

  const handleDeletePayment = async (supplierId, paymentId) => {
    if (!confirm('Delete this payment?')) return;
    await deleteSupplierPayment(paymentId);
    await reloadDetail(supplierId);
  };

  if (loading) return <div className="loading">Loading suppliers...</div>;

  // ── Shared styles ──────────────────────────────────────────────────────────
  const S = {
    card: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
    },
    cardHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      cursor: 'pointer',
      userSelect: 'none',
    },
    chevron: {
      fontSize: 11,
      color: 'var(--text-muted)',
      flexShrink: 0,
      transition: 'transform 0.2s',
    },
    meta: {
      flex: 1,
      minWidth: 0,
    },
    supplierName: {
      fontWeight: 700,
      fontSize: 15,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    badges: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    pill: (color) => ({
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 20,
      background: color + '22',
      color: color,
      border: `1px solid ${color}44`,
    }),
    expandedBody: {
      borderTop: '1px solid var(--border)',
      padding: '0 12px 12px',
    },
    actionRow: {
      display: 'flex',
      gap: 8,
      paddingTop: 12,
      paddingBottom: 12,
    },
    actionBtn: (color) => ({
      flex: 1,
      minHeight: 40,
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 8,
      border: `1px solid ${color || 'var(--border)'}`,
      background: 'transparent',
      color: color || 'var(--text)',
      cursor: 'pointer',
    }),
    sectionLabel: {
      fontWeight: 600,
      fontSize: 12,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
      marginTop: 16,
    },
    statRow: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 4,
    },
    statPill: (color) => ({
      flex: '1 1 0',
      background: 'var(--bg)',
      border: `1px solid var(--border)`,
      borderRadius: 8,
      padding: '8px 10px',
      textAlign: 'center',
    }),
    statPillLabel: {
      fontSize: 10,
      color: 'var(--text-muted)',
      marginBottom: 3,
    },
    statPillValue: (color) => ({
      fontWeight: 700,
      fontSize: 13,
      color: color,
    }),
    productPill: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 12,
      display: 'inline-flex',
      flexDirection: 'column',
      gap: 1,
    },
    arrivalCard: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      marginBottom: 6,
      fontSize: 12,
    },
    paymentRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 0',
      borderBottom: '1px solid var(--border)',
    },
    paymentFormBox: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 14,
      marginTop: 10,
      marginBottom: 10,
    },
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>

      {/* ── Supplier list ── */}
      {suppliers.length === 0 ? (
        <div className="empty-state">
          <h3>No suppliers yet</h3>
          <p>Add your first supplier to track purchases and payments</p>
        </div>
      ) : (
        suppliers.map(s => {
          const d = detail[s.id];
          const isOpen = expanded === s.id;
          const balance = s.balance;

          return (
            <div key={s.id} style={S.card}>
              {/* Collapsed header — tap to toggle */}
              <div style={S.cardHeader} onClick={() => toggleExpand(s.id)}>
                <span style={{ ...S.chevron, transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>

                <div style={S.meta}>
                  <div style={S.supplierName}>{s.name}</div>
                  <div style={S.badges}>
                    {s.platform && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: 'var(--bg)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                        {s.platform}
                      </span>
                    )}
                    <span style={S.pill(balance > 0 ? '#f87171' : '#4ade80')}>
                      {balance > 0 ? `Owed ${fmt(balance)} MAD` : 'Settled ✓'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={S.expandedBody} onClick={e => e.stopPropagation()}>

                  {/* Action buttons — full width row */}
                  <div style={S.actionRow}>
                    <button style={S.actionBtn()} onClick={() => openEdit(s)}>Edit</button>
                    <button
                      style={S.actionBtn('var(--accent)')}
                      onClick={() => { setError(''); setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' }); setShowPayment(s.id); }}
                    >
                      + Payment
                    </button>
                    <button style={S.actionBtn('#f87171')} onClick={() => handleDelete(s.id)}>Delete</button>
                  </div>

                  {/* Loading indicator */}
                  {loadingDetail === s.id && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Loading...</div>
                  )}

                  {/* Detail content */}
                  {d && (
                    <>
                      {/* 3 stat pills */}
                      <div style={S.statRow}>
                        <div style={S.statPill('#fbbf24')}>
                          <div style={S.statPillLabel}>Total Purchased</div>
                          <div style={S.statPillValue('#fbbf24')}>{fmt(d.total_purchased)} MAD</div>
                        </div>
                        <div style={S.statPill('#4ade80')}>
                          <div style={S.statPillLabel}>Total Paid</div>
                          <div style={S.statPillValue('#4ade80')}>{fmt(d.total_paid)} MAD</div>
                        </div>
                        <div style={S.statPill(d.balance > 0 ? '#f87171' : '#4ade80')}>
                          <div style={S.statPillLabel}>Balance</div>
                          <div style={S.statPillValue(d.balance > 0 ? '#f87171' : '#4ade80')}>{fmt(d.balance)} MAD</div>
                        </div>
                      </div>

                      {/* Linked Products */}
                      {d.products.length > 0 && (
                        <>
                          <div style={S.sectionLabel}>Linked Products</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {d.products.map(p => (
                              <div key={p.id} style={S.productPill}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.variant_count} variant{p.variant_count !== 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* History toggle filter */}
                      {(() => {
                        const hTab = historyTab[s.id] || 'purchases';
                        const setHTab = (t) => setHistoryTab(h => ({ ...h, [s.id]: t }));
                        return (
                          <>
                            <div style={{ display: 'flex', marginTop: 16, marginBottom: 10, background: 'var(--bg)', borderRadius: 8, padding: 3, gap: 3 }}>
                              {[{ key: 'purchases', label: 'Purchases' }, { key: 'payments', label: 'Payments' }].map(opt => (
                                <button
                                  key={opt.key}
                                  onClick={() => setHTab(opt.key)}
                                  style={{
                                    flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: hTab === opt.key ? 700 : 400,
                                    background: hTab === opt.key ? 'var(--card)' : 'transparent',
                                    color: hTab === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                                    boxShadow: hTab === opt.key ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                                  }}
                                >
                                  {opt.label}
                                  <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.7 }}>
                                    ({opt.key === 'purchases' ? d.arrivals.length : d.payments.length})
                                  </span>
                                </button>
                              ))}
                            </div>

                            {/* Purchases */}
                            {hTab === 'purchases' && (
                              d.arrivals.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No purchases yet.</div>
                              ) : (
                                d.arrivals.map(a => (
                                  <div key={a.id} style={S.arrivalCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.product_name}</div>
                                        {a.variant && a.variant !== '—' && (
                                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>{a.variant}</div>
                                        )}
                                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                          {a.date?.split('T')[0]} · qty {a.quantity}
                                        </div>
                                      </div>
                                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24', flexShrink: 0, marginLeft: 8 }}>
                                        {fmt(a.total_cost)} MAD
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )
                            )}

                            {/* Payments */}
                            {hTab === 'payments' && (
                              <>
                                {showPayment === s.id && (
                                  <div style={S.paymentFormBox}>
                                    {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
                                    <div className="form-group">
                                      <label className="form-label">Amount (MAD) *</label>
                                      <input className="form-input" type="number" placeholder="0" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Date</label>
                                      <input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Note</label>
                                      <input className="form-input" placeholder="e.g. cash, transfer..." value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                      <button style={{ ...S.actionBtn(), flex: 'none', padding: '0 16px' }} onClick={() => setShowPayment(null)}>Cancel</button>
                                      <button style={{ ...S.actionBtn('var(--accent)'), flex: 1 }} onClick={() => handleAddPayment(s.id)}>Save Payment</button>
                                    </div>
                                  </div>
                                )}
                                {d.payments.length === 0 ? (
                                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payments recorded yet.</div>
                                ) : (
                                  <div style={{ marginTop: 4 }}>
                                    {d.payments.map((p, idx) => (
                                      <div key={p.id} style={{ ...S.paymentRow, borderBottom: idx === d.payments.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{p.date?.split('T')[0]}</span>
                                        <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 13, flexShrink: 0 }}>{fmt(p.amount)} MAD</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note || '—'}</span>
                                        <button style={{ ...S.actionBtn('#f87171'), flex: 'none', padding: '0 10px', minHeight: 30, fontSize: 11 }} onClick={() => handleDeletePayment(s.id, p.id)}>✕</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Add / Edit Supplier Modal ── */}
      {(showAdd || editingSupplier) && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setEditingSupplier(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="btn-icon" onClick={() => { setShowAdd(false); setEditingSupplier(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Alibaba Store #1"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select
                    className="form-input"
                    value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone / WhatsApp</label>
                  <input
                    className="form-input"
                    placeholder="+212..."
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Payment terms, contact details..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setEditingSupplier(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editingSupplier ? 'Save Changes' : 'Add Supplier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
