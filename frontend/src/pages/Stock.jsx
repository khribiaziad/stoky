import { useState, useEffect } from 'react';
import { getProducts, getStockArrivals, addBulkStockArrival, getBrokenStock, addBrokenStock, updateBrokenStock, deleteBrokenStock, deleteArrival, adjustStock, addSupplierPayment, getWarehouses, getWarehouseStock } from '../api';
import StockMobile from './StockMobile';

const emptyItem = () => ({ product_id: '', variant_ids: [], quantity: 1 });

export default function Stock({ readOnly = false }) {
  if (window.innerWidth < 768) return <StockMobile readOnly={readOnly} />;
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
  const [arrivalWarehouseId, setArrivalWarehouseId] = useState(null);

  const [brokenForm, setBrokenForm] = useState({ product_id: '', variant_id: '', quantity: 1, source: 'storage', returnable_to_supplier: false });

  // Warehouse stock
  const [warehouses,       setWarehouses]       = useState([]);
  const [selectedWhId,     setSelectedWhId]     = useState(null);
  const [warehouseStock,   setWarehouseStock]   = useState(null); // { variant_id -> quantity }
  const [whStockLoading,   setWhStockLoading]   = useState(false);

  const load = () => {
    getProducts().then(r => setProducts(r.data));
    getStockArrivals().then(r => setArrivals(r.data));
    getBrokenStock().then(r => setBroken(r.data));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    getWarehouses().then(r => {
      setWarehouses(r.data);
      if (r.data.length > 0) {
        const def = r.data.find(w => w.is_default) || r.data[0];
        setSelectedWhId(def.id);
        setArrivalWarehouseId(def.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedWhId) { setWarehouseStock(null); return; }
    setWhStockLoading(true);
    getWarehouseStock(selectedWhId)
      .then(r => {
        const map = {};
        r.data.stock.forEach(s => { map[s.variant_id] = s.quantity; });
        setWarehouseStock(map);
      })
      .catch(() => setWarehouseStock(null))
      .finally(() => setWhStockLoading(false));
  }, [selectedWhId]);

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
        warehouse_id: arrivalWarehouseId || null,
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stock Management</h1>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => { setError(''); setShowAdd(true); }}>+ New Arrival</button>
            <button className="btn btn-danger" onClick={() => { setError(''); setShowAddBroken(true); }}>Report Broken</button>
          </div>
        )}
      </div>

      {success && (
        <div className="alert alert-success">
          {success}
          <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      <div className="tabs">
        <div className={`tab ${tab === 'arrivals' ? 'active' : ''}`} onClick={() => setTab('arrivals')}>Stock Arrivals</div>
        <div className={`tab ${tab === 'broken' ? 'active' : ''}`} onClick={() => setTab('broken')}>Broken Stock</div>
        <div className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Current Stock</div>
      </div>

      {/* Current Stock Overview */}
      {tab === 'overview' && (
        <div className="card">
          {/* Warehouse selector — only when warehouses exist */}
          {warehouses.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--t2)', flexShrink: 0 }}>Warehouse:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {warehouses.map(wh => (
                  <button key={wh.id}
                    onClick={() => setSelectedWhId(wh.id)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: selectedWhId === wh.id ? 700 : 400, cursor: 'pointer',
                      border: `1.5px solid ${selectedWhId === wh.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedWhId === wh.id ? 'var(--accent-b)' : 'var(--card-2)',
                      color: selectedWhId === wh.id ? 'var(--accent)' : 'var(--t2)',
                    }}>
                    {wh.name} <span style={{ opacity: 0.6, fontSize: 11 }}>({wh.city})</span>
                    {wh.is_default && <span style={{ marginLeft: 4, opacity: 0.6 }}>★</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {products.length === 0 ? (
            <div className="empty-state"><h3>No products yet</h3><p>Add products first from the Products page</p></div>
          ) : whStockLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t2)' }}>Loading stock…</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Product</th><th>Size</th><th>Color</th><th>Buy Price</th><th>Stock</th><th>Broken</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {products.flatMap(p =>
                    p.variants.map(v => {
                      const qty = warehouses.length > 0 && warehouseStock !== null
                        ? (warehouseStock[v.id] ?? 0)
                        : v.stock;
                      return (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td>{v.size || '—'}</td>
                          <td>{v.color || '—'}</td>
                          <td>{v.buying_price} MAD</td>
                          <td style={{ fontWeight: 700, color: qty <= v.low_stock_threshold ? '#fbbf24' : '#4ade80' }}>
                            {qty}
                          </td>
                          <td style={{ color: v.broken_stock > 0 ? '#f87171' : '#8892b0' }}>
                            {v.broken_stock || 0}
                          </td>
                          <td>
                            {qty === 0
                              ? <span className="badge badge-red">Out of Stock</span>
                              : qty <= v.low_stock_threshold
                                ? <span className="badge badge-yellow">Low Stock</span>
                                : <span className="badge badge-green">OK</span>
                            }
                          </td>
                          <td><button className="btn btn-secondary btn-sm" onClick={() => { setAdjustVariant({ id: v.id, name: p.name, size: v.size, color: v.color }); setAdjustValue(v.stock); }}>Adjust</button></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Arrivals History */}
      {tab === 'arrivals' && (
        <div className="card">
          {arrivals.length === 0 ? (
            <div className="empty-state"><h3>No stock arrivals yet</h3><p>Click "New Arrival" to record your first shipment</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Product</th><th>Variant</th><th>Qty</th><th>Unit Cost</th><th>Extra Fees</th><th>Total</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {arrivals.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: '#8892b0', fontSize: 12 }}>{a.date ? new Date(a.date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 500 }}>{a.product_name}</td>
                      <td>
                        {(a.size || a.color)
                          ? <span className="pill">{[a.size, a.color].filter(Boolean).join(' / ')}</span>
                          : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>+{a.quantity}</td>
                      <td style={{ color: '#8892b0' }}>
                        {a.additional_fees > 0
                          ? `${(a.total_cost - a.additional_fees).toFixed(0)} MAD`
                          : `${a.total_cost} MAD`}
                      </td>
                      <td style={{ color: a.additional_fees > 0 ? '#fbbf24' : '#8892b0' }}>
                        {a.additional_fees > 0 ? `${a.additional_fees} MAD` : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#f87171' }}>{a.total_cost} MAD</td>
                      <td style={{ color: '#8892b0', fontSize: 12 }}>{a.description || '—'}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteArrival(a.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Broken Stock */}
      {tab === 'broken' && (
        <div className="card">
          {broken.length === 0 ? (
            <div className="empty-state"><h3>No broken stock</h3><p>Nothing broken yet — great!</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Product</th><th>Variant</th><th>Qty</th><th>Source</th><th>Returnable</th><th>Value Lost</th><th></th></tr>
                </thead>
                <tbody>
                  {broken.map(b => (
                    <tr key={b.id}>
                      <td style={{ color: '#8892b0', fontSize: 12 }}>{b.date ? new Date(b.date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 500 }}>{b.product_name}</td>
                      <td>
                        {(b.size || b.color)
                          ? <span className="pill">{[b.size, b.color].filter(Boolean).join(' / ')}</span>
                          : '—'}
                      </td>
                      <td>{b.quantity}</td>
                      <td><span className={`badge ${b.source === 'return' ? 'badge-yellow' : 'badge-gray'}`}>{b.source}</span></td>
                      <td>
                        {b.returnable_to_supplier
                          ? <span className="badge badge-green">Yes</span>
                          : <span className="badge badge-red">No</span>}
                      </td>
                      <td style={{ color: b.returnable_to_supplier ? '#8892b0' : '#f87171' }}>
                        {b.returnable_to_supplier ? '0 (refund)' : `${b.value_lost} MAD`}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditBroken(b); setEditBrokenForm({ quantity: b.quantity, returnable_to_supplier: b.returnable_to_supplier }); }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBroken(b.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bulk Stock Arrival Modal */}
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

              {/* Warehouse selector */}
              {warehouses.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Destination Warehouse</label>
                  <select className="form-input" value={arrivalWarehouseId || ''} onChange={e => setArrivalWarehouseId(parseInt(e.target.value) || null)}>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name} — {wh.city}{wh.is_default ? ' (default)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* Report Broken Modal */}
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

      {/* Adjust Stock Modal */}
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

      {/* Edit Broken Modal */}
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
