import { useState, useEffect } from 'react';
import { getProducts, getStockArrivals, addBulkStockArrival, getBrokenStock, addBrokenStock, updateBrokenStock, deleteBrokenStock, deleteArrival, adjustStock, errorMessage } from '../api';

const emptyItem = () => ({ product_id: '', variant_id: '', quantity: 1 });

export default function Stock({ readOnly = false }) {
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

  const [brokenForm, setBrokenForm] = useState({ product_id: '', variant_id: '', quantity: 1, source: 'storage', returnable_to_supplier: false });

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
    const variants = getVariants(item.product_id);
    const variant = variants.find(v => v.id === parseInt(item.variant_id));
    return sum + (variant ? variant.buying_price * (parseInt(item.quantity) || 0) : 0);
  }, 0);
  const totalCost = totalStockCost + parseFloat(additionalFees || 0);

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    // Reset variant when product changes
    if (field === 'product_id') updated[index].variant_id = '';
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleAddStock = async () => {
    setError('');
    const validItems = items.filter(item => item.variant_id && item.quantity > 0);
    if (validItems.length === 0) { setError('Select at least one product variant with a quantity'); return; }

    try {
      const res = await addBulkStockArrival({
        items: validItems.map(item => ({ variant_id: parseInt(item.variant_id), quantity: parseInt(item.quantity) })),
        additional_fees: parseFloat(additionalFees) || 0,
        description: description || null,
        date,
      });
      setSuccess(`Stock arrival saved! ${res.data.items_count} item(s) added. Total cost: ${res.data.total_cost} MAD`);
      setShowAdd(false);
      setItems([emptyItem()]);
      setAdditionalFees(0);
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleAddBroken = async () => {
    if (!brokenForm.variant_id) { setError('Select a variant'); return; }
    try {
      await addBrokenStock({ ...brokenForm, variant_id: parseInt(brokenForm.variant_id) });
      setShowAddBroken(false);
      setBrokenForm({ product_id: '', variant_id: '', quantity: 1, source: 'storage', returnable_to_supplier: false });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleEditBroken = async () => {
    try {
      await updateBrokenStock(editBroken.id, editBrokenForm);
      setEditBroken(null);
      setSuccess('Updated successfully');
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleDeleteBroken = async (id) => {
    if (!window.confirm('Delete this broken stock record?')) return;
    try {
      await deleteBrokenStock(id);
      setSuccess('Deleted');
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleDeleteArrival = async (id) => {
    if (!window.confirm('Delete this arrival? Stock will be reversed.')) return;
    try {
      await deleteArrival(id);
      setSuccess('Arrival deleted and stock reversed');
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleAdjustStock = async () => {
    try {
      await adjustStock(adjustVariant.id, adjustValue);
      setAdjustVariant(null);
      setSuccess('Stock updated');
      load();
    } catch (e) { setError(errorMessage(e)); }
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
          {products.length === 0 ? (
            <div className="empty-state"><h3>No products yet</h3><p>Add products first from the Products page</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Product</th><th>Size</th><th>Color</th><th>Buy Price</th><th>Stock</th><th>Broken</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {products.flatMap(p =>
                    p.variants.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{v.size || '—'}</td>
                        <td>{v.color || '—'}</td>
                        <td>{v.buying_price} MAD</td>
                        <td style={{ fontWeight: 700, color: v.stock <= v.low_stock_threshold ? '#fbbf24' : '#4ade80' }}>
                          {v.stock}
                        </td>
                        <td style={{ color: v.broken_stock > 0 ? '#f87171' : '#8892b0' }}>
                          {v.broken_stock || 0}
                        </td>
                        <td>
                          {v.stock === 0
                            ? <span className="badge badge-red">Out of Stock</span>
                            : v.stock <= v.low_stock_threshold
                              ? <span className="badge badge-yellow">Low Stock</span>
                              : <span className="badge badge-green">OK</span>
                          }
                        </td>
                        <td><button className="btn btn-secondary btn-sm" onClick={() => { setAdjustVariant({ id: v.id, name: p.name, size: v.size, color: v.color }); setAdjustValue(v.stock); }}>Adjust</button></td>
                      </tr>
                    ))
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
                {items.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 36px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
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
                      {index === 0 && <div className="form-label">Variant</div>}
                      <select
                        className="form-input"
                        value={item.variant_id}
                        onChange={e => updateItem(index, 'variant_id', e.target.value)}
                        disabled={!item.product_id}
                      >
                        <option value="">Select variant...</option>
                        {getVariants(item.product_id).map(v => (
                          <option key={v.id} value={v.id}>
                            {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} — {v.buying_price} MAD (stock: {v.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      {index === 0 && <div className="form-label">Qty</div>}
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
                ))}
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
