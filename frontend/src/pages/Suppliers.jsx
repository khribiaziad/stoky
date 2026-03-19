import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, getSupplierDetail, addSupplierPayment, deleteSupplierPayment } from '../api';
import SuppliersMobile from './SuppliersMobile';

const PLATFORMS = ['Alibaba', 'AliExpress', 'Local', 'Wholesale', 'Direct', 'Other'];

const fmt = (n) => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Suppliers() {
  if (window.innerWidth < 768) return <SuppliersMobile />;
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
  const [showPayment, setShowPayment] = useState(null); // supplier id

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
        setDetail(d => { const copy = {...d}; delete copy[editingSupplier.id]; return copy; });
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>

      {suppliers.length === 0 ? (
        <div className="empty-state">
          <h3>No suppliers yet</h3>
          <p>Add your first supplier to track purchases and payments</p>
        </div>
      ) : (
        suppliers.map(s => {
          const d = detail[s.id];
          const isExpanded = expanded === s.id;
          const balance = s.balance;
          return (
            <div key={s.id} className="card" style={{ marginBottom: 12 }}>
              {/* Header row */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isExpanded ? 16 : 0 }}
                onClick={() => toggleExpand(s.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#8892b0', fontSize: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</div>
                    <div style={{ color: '#8892b0', fontSize: 12, marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {s.platform && <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px', fontSize: 11 }}>{s.platform}</span>}
                      {s.phone && <span>📞 {s.phone}</span>}
                      <span>{s.product_count} product{s.product_count !== 1 ? 's' : ''}</span>
                      <span>Purchased: <strong>{fmt(s.total_purchased)} MAD</strong></span>
                      <span>Paid: <strong style={{ color: '#4ade80' }}>{fmt(s.total_paid)} MAD</strong></span>
                      <span style={{ color: balance > 0 ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                        {balance > 0 ? `Owed: ${fmt(balance)} MAD` : 'Settled ✓'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div onClick={e => e.stopPropagation()}>
                  {loadingDetail === s.id && <div style={{ color: '#8892b0', fontSize: 13 }}>Loading...</div>}
                  {d && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                      {/* Balance summary */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total Purchased', value: `${fmt(d.total_purchased)} MAD`, color: '#fbbf24' },
                          { label: 'Total Paid', value: `${fmt(d.total_paid)} MAD`, color: '#4ade80' },
                          { label: 'Balance Owed', value: `${fmt(d.balance)} MAD`, color: d.balance > 0 ? '#f87171' : '#4ade80' },
                        ].map(stat => (
                          <div key={stat.label} className="card" style={{ flex: '1 1 140px', padding: '12px 16px', background: 'var(--bg)' }}>
                            <div style={{ fontSize: 11, color: '#8892b0', marginBottom: 4 }}>{stat.label}</div>
                            <div style={{ fontWeight: 700, fontSize: 18, color: stat.color }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Linked products */}
                      {d.products.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#8892b0', textTransform: 'uppercase', letterSpacing: 1 }}>Linked Products</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {d.products.map(p => (
                              <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div style={{ color: '#8892b0', fontSize: 11 }}>{p.variant_count} variants · {p.total_stock} in stock</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Purchase History + Payments side by side */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

                        {/* Purchase History */}
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#8892b0', textTransform: 'uppercase', letterSpacing: 1 }}>Purchase History</div>
                          {d.arrivals.length === 0 ? (
                            <div style={{ color: '#8892b0', fontSize: 13 }}>No purchases yet.</div>
                          ) : (
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {d.arrivals.map(a => (
                                    <tr key={a.id}>
                                      <td style={{ color: '#8892b0', fontSize: 12 }}>{a.date?.split('T')[0]}</td>
                                      <td>
                                        <div>{a.product_name}</div>
                                        {a.variant !== '—' && <div style={{ color: '#8892b0', fontSize: 11 }}>{a.variant}</div>}
                                      </td>
                                      <td>{a.quantity}</td>
                                      <td style={{ fontWeight: 600, color: '#fbbf24' }}>{fmt(a.total_cost)} MAD</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Payments */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#8892b0', textTransform: 'uppercase', letterSpacing: 1 }}>Payments Made</div>
                            <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setShowPayment(s.id); }}>+ Add</button>
                          </div>

                          {showPayment === s.id && (
                            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                              {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                <div className="form-group">
                                  <label className="form-label">Amount (MAD) *</label>
                                  <input className="form-input" type="number" placeholder="0" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({...f, amount: e.target.value}))} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Date</label>
                                  <input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({...f, date: e.target.value}))} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">Note</label>
                                  <input className="form-input" placeholder="e.g. cash, transfer..." value={paymentForm.note} onChange={e => setPaymentForm(f => ({...f, note: e.target.value}))} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowPayment(null)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={() => handleAddPayment(s.id)}>Save</button>
                              </div>
                            </div>
                          )}

                          {d.payments.length === 0 ? (
                            <div style={{ color: '#8892b0', fontSize: 13 }}>No payments recorded yet.</div>
                          ) : (
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr><th>Date</th><th>Amount</th><th>Note</th><th></th></tr>
                                </thead>
                                <tbody>
                                  {d.payments.map(p => (
                                    <tr key={p.id}>
                                      <td style={{ color: '#8892b0', fontSize: 12 }}>{p.date?.split('T')[0]}</td>
                                      <td style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(p.amount)} MAD</td>
                                      <td style={{ color: '#8892b0' }}>{p.note || '—'}</td>
                                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDeletePayment(s.id, p.id)}>✕</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add / Edit Supplier Modal */}
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
                  <input className="form-input" placeholder="e.g. Alibaba Store #1" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select className="form-input" value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}>
                    <option value="">— Select —</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone / WhatsApp</label>
                  <input className="form-input" placeholder="+212..." value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} placeholder="Payment terms, contact details..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
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
