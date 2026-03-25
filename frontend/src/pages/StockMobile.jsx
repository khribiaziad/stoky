import { useState, useEffect } from 'react';
import { getProducts, getStockArrivals, addBulkStockArrival, getBrokenStock, addBrokenStock, updateBrokenStock, deleteBrokenStock, deleteArrival, adjustStock, addSupplierPayment } from '../api';

const emptyItem = () => ({ product_id: '', variant_ids: [], quantity: 1 });

export default function StockMobile({ readOnly = false }) {
  const [tab, setTab] = useState('arrivals');
  const [products, setProducts] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [broken, setBroken] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddBroken, setShowAddBroken] = useState(false);
  const [editBroken, setEditBroken] = useState(null);
  const [editBrokenForm, setEditBrokenForm] = useState({ quantity: 1, returnable_to_supplier: false });
  const [adjustVariant, setAdjustVariant] = useState(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bulk arrival form
  const [items, setItems] = useState([emptyItem()]);
  const [additionalFees, setAdditionalFees] = useState(0);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paid, setPaid] = useState(false);

  const [brokenForm, setBrokenForm] = useState({ product_id: '', variant_id: '', quantity: 1, source: 'storage', returnable_to_supplier: false });

  // Overview tab accordion state — independent from other tabs
  const [expandedStock, setExpandedStock] = useState(null);

  const load = () => {
    getProducts().then(r => setProducts(r.data));
    getStockArrivals().then(r => setArrivals(r.data));
    getBrokenStock().then(r => setBroken(r.data));
  };

  useEffect(() => { load(); }, []);

  // Get variants for a given product_id
  const getVariants = (product_id) => {
    const p = products.find(p => p.id === parseInt(product_id));
    return p ? p.variants : [];
  };

  // Calculate total cost preview
  const totalStockCost = items.reduce((sum, item) => {
    const variants = getVariants(item.product_id).filter(v => item.variant_ids.includes(v.id));
    return sum + variants.reduce((s, v) => s + v.buying_price * (parseInt(item.quantity) || 0), 0);
  }, 0);
  const totalCost = totalStockCost + parseFloat(additionalFees || 0);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'product_id') updated[index].variant_ids = [];
    setItems(updated);
  };

  const toggleVariant = (index, variantId) => {
    const updated = [...items];
    const ids = updated[index].variant_ids;
    updated[index].variant_ids = ids.includes(variantId)
      ? ids.filter(id => id !== variantId)
      : [...ids, variantId];
    setItems(updated);
  };

  const toggleAllVariants = (index) => {
    const updated = [...items];
    const all = getVariants(updated[index].product_id).map(v => v.id);
    updated[index].variant_ids = updated[index].variant_ids.length === all.length ? [] : all;
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleAddStock = async () => {
    setError('');
    const expanded = [];
    for (const item of items) {
      if (item.variant_ids.length > 0 && parseInt(item.quantity) > 0) {
        for (const vid of item.variant_ids) {
          expanded.push({ variant_id: vid, quantity: parseInt(item.quantity) });
        }
      }
    }
    if (expanded.length === 0) { setError('Select at least one variant with a quantity'); return; }

    try {
      const res = await addBulkStockArrival({
        items: expanded,
        additional_fees: parseFloat(additionalFees) || 0,
        description: description || null,
        date,
      });

      // If paid, auto-create a payment per supplier based on their variants' cost
      if (paid) {
        const supplierAmounts = {};
        for (const { variant_id, quantity } of expanded) {
          for (const p of products) {
            const v = p.variants.find(v => v.id === variant_id);
            if (v && p.supplier_id) {
              supplierAmounts[p.supplier_id] = (supplierAmounts[p.supplier_id] || 0) + v.buying_price * quantity;
            }
          }
        }
        await Promise.allSettled(
          Object.entries(supplierAmounts).map(([sid, amount]) =>
            addSupplierPayment(sid, { amount: parseFloat(amount.toFixed(2)), date, note: description ? `Payment: ${description}` : 'Stock arrival payment' })
          )
        );
      }

      setSuccess(`Stock arrival saved! ${res.data.items_count} item(s) added. Total cost: ${res.data.total_cost} MAD${paid ? ' — Supplier payment recorded.' : ' — Recorded as debt.'}`);
      setShowAdd(false);
      setItems([emptyItem()]);
      setAdditionalFees(0);
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setPaid(false);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error adding stock'); }
  };

  const handleAddBroken = async () => {
    if (!brokenForm.variant_id) { setError('Select a variant'); return; }
    try {
      await addBrokenStock({ ...brokenForm, variant_id: parseInt(brokenForm.variant_id) });
      setShowAddBroken(false);
      setBrokenForm({ product_id: '', variant_id: '', quantity: 1, source: 'storage', returnable_to_supplier: false });
      load();
    } catch (e) {
      const d = e.response?.data?.detail;
      setError(typeof d === 'string' ? d : d ? JSON.stringify(d) : `Error ${e.response?.status ?? ''} — check backend terminal`);
    }
  };

  const handleEditBroken = async () => {
    try {
      await updateBrokenStock(editBroken.id, editBrokenForm);
      setEditBroken(null);
      setSuccess('Updated successfully');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const handleDeleteBroken = async (id) => {
    if (!window.confirm('Delete this broken stock record?')) return;
    try {
      await deleteBrokenStock(id);
      setSuccess('Deleted');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const handleDeleteArrival = async (id) => {
    if (!window.confirm('Delete this arrival? Stock will be reversed.')) return;
    try {
      await deleteArrival(id);
      setSuccess('Arrival deleted and stock reversed');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const handleAdjustStock = async () => {
    try {
      await adjustStock(adjustVariant.id, adjustValue);
      setAdjustVariant(null);
      setSuccess('Stock updated');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  // Shared card style for arrivals and broken lists
  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  };

  // Pill style for variant labels
  const pillStyle = {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'var(--accent-b, rgba(99,102,241,0.15))',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
  };

  const badgeStyle = (color) => ({
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 20,
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Stock</h1>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { setError(''); setShowAdd(true); }}>+ Arrival</button>
            <button className="btn btn-danger" onClick={() => { setError(''); setShowAddBroken(true); }}>Broken</button>
          </div>
        )}
      </div>

      {/* Success banner */}
      {success && (
        <div className="alert alert-success">
          {success}
          <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'arrivals' ? 'active' : ''}`} onClick={() => setTab('arrivals')}>Arrivals</div>
        <div className={`tab ${tab === 'broken' ? 'active' : ''}`} onClick={() => setTab('broken')}>Broken</div>
        <div className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Stock</div>
      </div>

      {/* ── Arrivals tab ── */}
      {tab === 'arrivals' && (
        <div>
          {arrivals.length === 0 ? (
            <div className="empty-state"><h3>No stock arrivals yet</h3><p>Tap "+ Arrival" to record your first shipment</p></div>
          ) : (
            arrivals.map(a => (
              <div key={a.id} style={cardStyle}>
                {/* Row 1: date + product name */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#8892b0', flexShrink: 0 }}>
                    {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.product_name}
                  </span>
                  {(a.size || a.color) && (
                    <span style={pillStyle}>{[a.size, a.color].filter(Boolean).join(' / ')}</span>
                  )}
                </div>
                {/* Row 2: qty + cost + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 15 }}>+{a.quantity}</span>
                  <span style={{ fontWeight: 700, color: '#f87171', fontSize: 14 }}>{a.total_cost} MAD</span>
                  {a.description && (
                    <span style={{ fontSize: 11, color: '#8892b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</span>
                  )}
                  {!readOnly && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 'auto', flexShrink: 0 }}
                      onClick={() => handleDeleteArrival(a.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Broken tab ── */}
      {tab === 'broken' && (
        <div>
          {broken.length === 0 ? (
            <div className="empty-state"><h3>No broken stock</h3><p>Nothing broken yet — great!</p></div>
          ) : (
            broken.map(b => (
              <div key={b.id} style={cardStyle}>
                {/* Row 1: date + product + variant pill */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#8892b0', flexShrink: 0 }}>
                    {b.date ? new Date(b.date).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.product_name}
                  </span>
                  {(b.size || b.color) && (
                    <span style={pillStyle}>{[b.size, b.color].filter(Boolean).join(' / ')}</span>
                  )}
                </div>
                {/* Row 2: qty + source badge + returnable badge + value lost */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>x{b.quantity}</span>
                  <span style={badgeStyle(b.source === 'return' ? '#fbbf24' : '#8892b0')}>{b.source}</span>
                  {b.returnable_to_supplier
                    ? <span style={badgeStyle('#4ade80')}>Returnable</span>
                    : <span style={badgeStyle('#f87171')}>Not returnable</span>}
                  <span style={{ color: b.returnable_to_supplier ? '#8892b0' : '#f87171', fontWeight: 600, fontSize: 13 }}>
                    {b.returnable_to_supplier ? '0 MAD (refund)' : `${b.value_lost} MAD lost`}
                  </span>
                </div>
                {/* Row 3: action buttons */}
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setEditBroken(b); setEditBrokenForm({ quantity: b.quantity, returnable_to_supplier: b.returnable_to_supplier }); }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBroken(b.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Current Stock (overview) tab — accordion by product ── */}
      {tab === 'overview' && (
        <div>
          {products.length === 0 ? (
            <div className="empty-state"><h3>No products yet</h3><p>Add products first from the Products page</p></div>
          ) : (
            products.map(p => {
              const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
              const hasLow = p.variants.some(v => v.stock > 0 && v.stock <= v.low_stock_threshold);
              const hasOut = p.variants.some(v => v.stock === 0);
              const isOpen = expandedStock === p.id;
              const stockColor = totalStock === 0 ? '#f87171' : hasLow ? '#fbbf24' : '#4ade80';

              return (
                <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  {/* Collapsed header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedStock(isOpen ? null : p.id)}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #8892b0)', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: stockColor, flexShrink: 0 }}>{totalStock}</span>
                    {hasLow && <span style={badgeStyle('#fbbf24')}>Low</span>}
                    {hasOut && <span style={badgeStyle('#f87171')}>Out</span>}
                  </div>

                  {/* Expanded: variant rows */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 12px' }}>
                      {p.variants.length === 0 ? (
                        <div style={{ color: '#8892b0', fontSize: 13, padding: '6px 0' }}>No variants</div>
                      ) : (
                        p.variants.map(v => {
                          const label = [v.size, v.color].filter(Boolean).join(' / ') || 'Default';
                          const vColor = v.stock === 0 ? '#f87171' : v.stock <= v.low_stock_threshold ? '#fbbf24' : '#4ade80';
                          return (
                            <div
                              key={v.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}
                            >
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
                              <span style={{ fontWeight: 700, fontSize: 16, color: vColor }}>{v.stock}</span>
                              {!readOnly && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ flexShrink: 0 }}
                                  onClick={() => { setAdjustVariant({ id: v.id, name: p.name, size: v.size, color: v.color }); setAdjustValue(v.stock); }}
                                >
                                  Adjust
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Bulk Stock Arrival Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Stock Arrival</h2>
              <button className="btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {/* Items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>Products in this Shipment</div>
                {items.map((item, index) => {
                  const variants = getVariants(item.product_id);
                  const allSelected = variants.length > 0 && item.variant_ids.length === variants.length;
                  return (
                    <div key={index} style={{ marginBottom: 12, padding: 12, background: 'var(--card-2)', borderRadius: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 36px', gap: 8, alignItems: 'end', marginBottom: item.product_id ? 10 : 0 }}>
                        <div>
                          {index === 0 && <div className="form-label">Product</div>}
                          <select
                            className="form-input"
                            value={item.product_id}
                            onChange={e => updateItem(index, 'product_id', e.target.value)}
                          >
                            <option value="">Select product...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          {index === 0 && <div className="form-label">Qty each</div>}
                          <input
                            className="form-input"
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div style={{ paddingBottom: 1 }}>
                          {items.length > 1 && (
                            <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={() => removeItem(index)}>✕</button>
                          )}
                        </div>
                      </div>
                      {item.product_id && variants.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--t2)' }}>Variants</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={allSelected} onChange={() => toggleAllVariants(index)} />
                              Select all
                            </label>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {variants.map(v => {
                              const label = [v.size, v.color].filter(Boolean).join(' / ') || 'Default';
                              const checked = item.variant_ids.includes(v.id);
                              return (
                                <label key={v.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                                  padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                  background: checked ? 'var(--accent-b)' : 'var(--card)',
                                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                                  color: checked ? 'var(--accent)' : 'var(--t2)',
                                }}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleVariant(index, v.id)} style={{ display: 'none' }} />
                                  {label}
                                  <span style={{ color: 'var(--t3)', fontSize: 11 }}>({v.stock})</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Another Product</button>
              </div>

              <hr className="divider" />

              {/* Shared fees */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Additional Fees (MAD) — entire shipment</label>
                  <input className="form-input" type="number" min="0" value={additionalFees} onChange={e => setAdditionalFees(e.target.value)} placeholder="e.g. shipping cost" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="e.g. From supplier Ali" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              {/* Paid checkbox */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} />
                  <span style={{ fontWeight: 600, color: paid ? 'var(--accent)' : 'var(--t1)' }}>
                    Paid
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                    {paid ? '— Payment will be recorded to supplier' : '— Will be recorded as debt to supplier'}
                  </span>
                </label>
              </div>

              {/* Cost preview */}
              <div style={{ background: '#0f1117', border: '1px solid #2d3248', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#8892b0', fontSize: 12 }}>Stock cost</div>
                  <div style={{ fontWeight: 600 }}>{totalStockCost} MAD</div>
                </div>
                <div style={{ color: '#8892b0' }}>+</div>
                <div>
                  <div style={{ color: '#8892b0', fontSize: 12 }}>Additional fees</div>
                  <div style={{ fontWeight: 600 }}>{parseFloat(additionalFees) || 0} MAD</div>
                </div>
                <div style={{ color: '#8892b0' }}>=</div>
                <div>
                  <div style={{ color: '#8892b0', fontSize: 12 }}>Total withdrawn</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#f87171' }}>{totalCost} MAD</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStock}>Save Arrival</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Broken Modal ── */}
      {showAddBroken && (
        <div className="modal-overlay" onClick={() => setShowAddBroken(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Report Broken Stock</h2>
              <button className="btn-icon" onClick={() => setShowAddBroken(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-input" value={brokenForm.product_id} onChange={e => setBrokenForm({...brokenForm, product_id: e.target.value, variant_id: ''})}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Variant</label>
                <select className="form-input" value={brokenForm.variant_id} onChange={e => setBrokenForm({...brokenForm, variant_id: e.target.value})} disabled={!brokenForm.product_id}>
                  <option value="">Select variant...</option>
                  {getVariants(brokenForm.product_id).map(v => (
                    <option key={v.id} value={v.id}>{[v.size, v.color].filter(Boolean).join(' / ') || 'Default'}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" value={brokenForm.quantity} onChange={e => setBrokenForm({...brokenForm, quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={brokenForm.returnable_to_supplier} onChange={e => setBrokenForm({...brokenForm, returnable_to_supplier: e.target.checked})} />
                  Returnable to Supplier (still counts in capital)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddBroken(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleAddBroken}>Report Broken</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust Stock Modal ── */}
      {adjustVariant && (
        <div className="modal-overlay" onClick={() => setAdjustVariant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Stock</h2>
              <button className="btn-icon" onClick={() => setAdjustVariant(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, color: 'var(--t2)', fontSize: 14 }}>
                {adjustVariant.name} — {[adjustVariant.size, adjustVariant.color].filter(Boolean).join(' / ') || 'Default'}
              </div>
              <div className="form-group">
                <label className="form-label">New Stock Count</label>
                <input className="form-input" type="number" min="0" value={adjustValue} onChange={e => setAdjustValue(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAdjustVariant(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdjustStock}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Broken Modal ── */}
      {editBroken && (
        <div className="modal-overlay" onClick={() => setEditBroken(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Broken Stock</h2>
              <button className="btn-icon" onClick={() => setEditBroken(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 8, color: 'var(--t2)', fontSize: 14 }}>
                {editBroken.product_name} — {[editBroken.size, editBroken.color].filter(Boolean).join(' / ') || 'Default'}
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" value={editBrokenForm.quantity} onChange={e => setEditBrokenForm({ ...editBrokenForm, quantity: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={editBrokenForm.returnable_to_supplier} onChange={e => setEditBrokenForm({ ...editBrokenForm, returnable_to_supplier: e.target.checked })} />
                  Returnable to Supplier
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditBroken(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditBroken}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
