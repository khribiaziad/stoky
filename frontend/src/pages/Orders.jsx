import { useState, useEffect, useRef } from 'react';
import { getOrders, getProducts, getPacks, uploadPickupPDF, bulkCreateOrders, uploadReturnPDF, processReturns, updateOrderStatus, updateOrder, deleteOrder, updateOrderNotes, bulkUpdateOrderStatus } from '../api';

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE = {
  pending: 'badge-yellow',
  delivered: 'badge-green',
  cancelled: 'badge-red',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // PDF upload states
  const [parsedOrders, setParsedOrders] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [orderExpenses, setOrderExpenses] = useState({});
  const [uploading, setUploading] = useState(false);

  // Returns states (PDF flow)
  const [returnOrders, setReturnOrders] = useState(null);
  const [returnChoices, setReturnChoices] = useState({});

  // Manual order creation
  const [showManualOrder, setShowManualOrder] = useState(false);
  const emptyManualOrder = () => ({ caleo_id: '', customer_name: '', customer_phone: '', customer_address: '', city: '', total_amount: '' });
  const [manualOrder, setManualOrder] = useState(emptyManualOrder());
  const [manualItems, setManualItems] = useState([{ variant_id: '', quantity: 1 }]);
  const [manualExpenses, setManualExpenses] = useState({ sticker: 0, seal_bag: 0, packaging: 1 });

  // Manual return
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [manualReturnChoice, setManualReturnChoice] = useState({ seal_bag_returned: false, product_broken: false });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Notes modal
  const [notesOrder, setNotesOrder] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  // Edit order modal
  const [editOrder, setEditOrder] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editItems, setEditItems] = useState([]);
  const [editExpenses, setEditExpenses] = useState({ sticker: 0, seal_bag: 0, packaging: 1 });

  // Exchange flow
  const [exchangeOrder, setExchangeOrder] = useState(null);
  const [exchangeStep, setExchangeStep] = useState(1); // 1 = return, 2 = new order
  const [exchangeReturnChoice, setExchangeReturnChoice] = useState({ seal_bag_returned: false, product_broken: false });
  const [exchangeItems, setExchangeItems] = useState([{ variant_id: '', quantity: 1 }]);
  const [exchangeExpenses, setExchangeExpenses] = useState({ sticker: 0, seal_bag: 0, packaging: 1 });
  const [exchangeTotal, setExchangeTotal] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pickupRef = useRef();
  const returnRef = useRef();

  const allVariants = products.flatMap(p => p.variants.map(v => ({
    ...v,
    label: `${p.name} — ${v.size || ''} ${v.color || ''}`.trim(),
    under_1kg: p.under_1kg,
  })));

  // Auto-set seal_bag based on whether any selected product is under 1kg
  const autoSealBag = (items) => {
    return items.some(item => {
      if (!item.isPack && item.variant_id) {
        return allVariants.find(v => v.id === parseInt(item.variant_id))?.under_1kg;
      }
      if (item.isPack && item.customItems) {
        return item.customItems.some(ci => allVariants.find(v => v.id === parseInt(ci.variant_id))?.under_1kg);
      }
      return false;
    }) ? 1 : 0;
  };

  const updateItemsAndSealBag = (orderIndex, newItems) => {
    setOrderItems(prev => ({ ...prev, [orderIndex]: newItems }));
    setOrderExpenses(prev => ({
      ...prev,
      [orderIndex]: { ...prev[orderIndex], seal_bag: autoSealBag(newItems) },
    }));
  };

  const load = () => {
    Promise.all([getOrders(), getProducts(), getPacks()])
      .then(([o, p, pk]) => { setOrders(o.data); setProducts(p.data); setPacks(pk.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Handle pickup PDF upload
  const handleManualOrder = async () => {
    setError('');
    if (!manualOrder.caleo_id.trim()) { setError('CMD ID is required'); return; }
    if (!manualOrder.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!manualOrder.total_amount) { setError('Total amount is required'); return; }
    const flatItems = manualItems
      .filter(item => item.variant_id)
      .map(item => ({ variant_id: parseInt(item.variant_id), quantity: parseInt(item.quantity) || 1 }));
    if (flatItems.length === 0) { setError('Add at least one product'); return; }
    try {
      await bulkCreateOrders([{ ...manualOrder, total_amount: parseFloat(manualOrder.total_amount), items: flatItems, expenses: manualExpenses }]);
      setSuccess('Order created successfully!');
      setShowManualOrder(false);
      setManualOrder(emptyManualOrder());
      setManualItems([{ variant_id: '', quantity: 1 }]);
      setManualExpenses({ sticker: 0, seal_bag: 0, packaging: 1 });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error creating order'); }
  };

  const handleManualReturn = async () => {
    if (!selectedReturn) { setError('Select an order to return'); return; }
    try {
      await processReturns([{ order_id: selectedReturn.id, ...manualReturnChoice }]);
      setSuccess('Return processed!');
      setShowManualReturn(false);
      setSelectedReturn(null);
      setReturnSearch('');
      setManualReturnChoice({ seal_bag_returned: false, product_broken: false });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error processing return'); }
  };

  const handlePickupUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadPickupPDF(file);
      const extracted = res.data.orders;
      setParsedOrders(extracted);

      // Initialize order items and expenses
      const items = {};
      const expenses = {};
      extracted.forEach((_, i) => {
        items[i] = [{ variant_id: '', quantity: 1 }];
        expenses[i] = { sticker: 0, seal_bag: 0, packaging: 1 };
      });
      setOrderItems(items);
      setOrderExpenses(expenses);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to parse PDF');
    }
    setUploading(false);
    pickupRef.current.value = '';
  };

  // Handle return PDF upload
  const handleReturnUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadReturnPDF(file);
      setReturnOrders(res.data);
      const choices = {};
      res.data.matched_orders.forEach(o => {
        choices[o.id] = { seal_bag_returned: false, product_broken: false };
      });
      setReturnChoices(choices);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to parse return PDF');
    }
    setUploading(false);
    returnRef.current.value = '';
  };

  const handleSaveOrders = async () => {
    setError('');
    const ordersToCreate = parsedOrders.map((order, i) => {
      // Flatten items: regular products + pack composition items
      const flatItems = [];
      for (const item of (orderItems[i] || [])) {
        if (!item.isPack) {
          if (item.variant_id) flatItems.push({ variant_id: parseInt(item.variant_id), quantity: parseInt(item.quantity) || 1 });
        } else {
          // Pack: push each component as a separate item
          for (const ci of (item.customItems || [])) {
            if (ci.variant_id) flatItems.push({ variant_id: parseInt(ci.variant_id), quantity: parseInt(ci.quantity) || 1 });
          }
        }
      }
      return {
        ...order,
        items: flatItems,
        expenses: orderExpenses[i] || { sticker: 0, seal_bag: 0, packaging: 1 },
      };
    }).filter(o => o.items.length > 0);

    if (ordersToCreate.length === 0) {
      setError('Please assign at least one product to at least one order');
      return;
    }

    try {
      const res = await bulkCreateOrders(ordersToCreate);
      setSuccess(`${res.data.count} orders created successfully!`);
      setParsedOrders(null);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error creating orders');
    }
  };

  const handleProcessReturns = async () => {
    const returns = Object.entries(returnChoices).map(([orderId, choices]) => ({
      order_id: parseInt(orderId),
      ...choices,
    }));
    try {
      await processReturns(returns);
      setSuccess('Returns processed successfully!');
      setReturnOrders(null);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error processing returns');
    }
  };

  const handleStatusChange = async (id, status) => {
    await updateOrderStatus(id, status);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this order?')) return;
    await deleteOrder(id);
    load();
  };

  // ── Bulk & CSV ────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const handleBulkStatus = async (status) => {
    const count = selectedIds.size;
    try {
      await bulkUpdateOrderStatus([...selectedIds], status);
      setSelectedIds(new Set());
      setSuccess(`${count} orders updated to ${status}`);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error updating orders');
    }
  };

  const exportCSV = () => {
    const rows = [
      ['CMD-ID', 'Customer', 'Phone', 'City', 'Address', 'Amount (MAD)', 'Status', 'Items', 'Confirmed By', 'Date', 'Notes'],
      ...filtered.map(o => [
        o.caleo_id,
        o.customer_name,
        o.customer_phone || '',
        o.city || '',
        o.customer_address || '',
        o.total_amount,
        o.status,
        o.items?.map(i => `${i.product_name} x${i.quantity}`).join('; ') || '',
        o.confirmed_by || '',
        o.order_date ? new Date(o.order_date).toLocaleDateString() : '',
        o.notes || '',
      ]),
    ];
    downloadCSV(rows, `orders_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Notes ─────────────────────────────────────────────────────────────────
  const openNotes = (order) => {
    setNotesOrder(order);
    setNotesDraft(order.notes || '');
  };

  const handleSaveNotes = async () => {
    try {
      await updateOrderNotes(notesOrder.id, notesDraft);
      setOrders(prev => prev.map(o => o.id === notesOrder.id ? { ...o, notes: notesDraft } : o));
      setNotesOrder(null);
      setSuccess('Notes saved');
    } catch (e) {
      setError('Error saving notes');
    }
  };

  // ── Edit order ────────────────────────────────────────────────────────────────
  const openEdit = (order) => {
    setEditOrder(order);
    setEditForm({
      caleo_id: order.caleo_id || '',
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_address: order.customer_address || '',
      city: order.city || '',
      total_amount: order.total_amount ?? '',
    });
    setEditItems(
      order.items?.length > 0
        ? order.items.map(i => ({ variant_id: String(i.variant_id), quantity: i.quantity }))
        : [{ variant_id: '', quantity: 1 }]
    );
    setEditExpenses({
      sticker: order.expenses?.sticker ?? 0,
      seal_bag: order.expenses?.seal_bag ?? 0,
      packaging: order.expenses?.packaging ?? 1,
    });
    setError('');
  };

  const handleSaveEdit = async () => {
    setError('');
    if (!editForm.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!editForm.total_amount) { setError('Total amount is required'); return; }
    const flatItems = editItems
      .filter(i => i.variant_id)
      .map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 }));
    if (flatItems.length === 0) { setError('Add at least one product'); return; }
    try {
      await updateOrder(editOrder.id, {
        ...editForm,
        total_amount: parseFloat(editForm.total_amount),
        items: flatItems,
        expenses: editExpenses,
      });
      setSuccess('Order updated successfully');
      setEditOrder(null);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error updating order');
    }
  };

  // ── Exchange ──────────────────────────────────────────────────────────────────
  const openExchange = (order) => {
    setExchangeOrder(order);
    setExchangeStep(1);
    setExchangeReturnChoice({ seal_bag_returned: false, product_broken: false });
    setExchangeItems([{ variant_id: '', quantity: 1 }]);
    setExchangeExpenses({ sticker: 0, seal_bag: 0, packaging: 1 });
    // Pre-fill total with the delivery fee from the original order
    setExchangeTotal(order.expenses?.delivery_fee || 35);
    setError('');
  };

  const handleExchange = async () => {
    setError('');
    const flatItems = exchangeItems
      .filter(i => i.variant_id)
      .map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 }));
    if (flatItems.length === 0) { setError('Add at least one replacement product'); return; }
    if (!exchangeTotal) { setError('Total amount is required'); return; }
    try {
      // Step 1: process the return
      await processReturns([{ order_id: exchangeOrder.id, ...exchangeReturnChoice }]);
      // Step 2: create the exchange order
      await bulkCreateOrders([{
        caleo_id: `EXCH-${exchangeOrder.caleo_id}`,
        customer_name: exchangeOrder.customer_name,
        customer_phone: exchangeOrder.customer_phone || '',
        customer_address: exchangeOrder.customer_address || '',
        city: exchangeOrder.city || '',
        total_amount: parseFloat(exchangeTotal),
        items: flatItems,
        expenses: exchangeExpenses,
      }]);
      setSuccess(`Exchange created for ${exchangeOrder.customer_name} — delivery fee only: ${exchangeTotal} MAD`);
      setExchangeOrder(null);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Error processing exchange');
    }
  };

  const filtered = orders
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.caleo_id?.includes(search) ||
      o.city?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search));

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="file" ref={pickupRef} accept=".pdf" style={{ display: 'none' }} onChange={handlePickupUpload} />
          <input type="file" ref={returnRef} accept=".pdf" style={{ display: 'none' }} onChange={handleReturnUpload} />
          <button className="btn btn-primary" onClick={() => { setError(''); setShowManualOrder(true); }}>+ New Order</button>
          <button className="btn btn-secondary" onClick={() => { setError(''); setShowManualReturn(true); }}>↩ Return Order</button>
          <button className="btn btn-secondary" onClick={() => pickupRef.current.click()} disabled={uploading}>
            {uploading ? '⏳ Parsing...' : '📤 Upload Pickup PDF'}
          </button>
          <button className="btn btn-secondary" onClick={() => returnRef.current.click()} disabled={uploading}>
            📥 Upload Return PDF
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} title="Export visible orders to CSV">
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error} <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>✕</button></div>}
      {success && <div className="alert alert-success">{success} <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {['all', 'pending', 'delivered', 'cancelled'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <span>🔍</span>
          <input placeholder="Search by name, CMD, city, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1a2e', border: '1px solid #00d48f44', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#00d48f' }}>{selectedIds.size} selected</span>
          <span style={{ color: '#8892b0', fontSize: 13 }}>Update to:</span>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#4ade80', color: '#4ade80' }} onClick={() => handleBulkStatus('delivered')}>✓ Delivered</button>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => handleBulkStatus('pending')}>⏳ Pending</button>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#f87171', color: '#f87171' }} onClick={() => handleBulkStatus('cancelled')}>✕ Cancelled</button>
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Orders Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No orders found</h3>
            <p>Upload a Pickup Parcels PDF to create orders</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} title="Select all" />
                  </th>
                  <th>CMD-ID</th><th>Customer</th><th>City</th><th>Amount</th><th>Items</th><th>Confirmed by</th><th>Status</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ background: selectedIds.has(o.id) ? '#1a2a1a' : undefined }}>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.caleo_id}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                      {o.customer_phone ? (
                        <a href={`https://wa.me/${o.customer_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#25D366', fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                          💬 {o.customer_phone}
                        </a>
                      ) : <div style={{ color: '#8892b0', fontSize: 11 }}>—</div>}
                    </td>
                    <td>{o.city}</td>
                    <td style={{ fontWeight: 600, color: '#60a5fa' }}>{o.total_amount} MAD</td>
                    <td>
                      {o.items?.length > 0
                        ? o.items.map(item => <div key={item.id} style={{ fontSize: 12 }}>{item.product_name} {item.size} {item.color} x{item.quantity}</div>)
                        : <span style={{ color: '#8892b0' }}>—</span>}
                    </td>
                    <td>
                      {o.confirmed_by
                        ? <span style={{ fontSize: 12, color: '#00d48f', fontWeight: 500 }}>{o.confirmed_by}</span>
                        : <span style={{ color: '#8892b0', fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}
                        value={o.status}
                        onChange={e => handleStatusChange(o.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td style={{ color: '#8892b0', fontSize: 12 }}>
                      {o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Edit order"
                          onClick={() => openEdit(o)}>
                          ✏
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Exchange — return & send replacement"
                          style={{ color: '#a78bfa' }}
                          onClick={() => openExchange(o)}>
                          ↔
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title={o.notes ? 'View/Edit notes' : 'Add note'}
                          style={{ color: o.notes ? '#f59e0b' : undefined }}
                          onClick={() => openNotes(o)}>
                          {o.notes ? '📝' : '✎'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Order Modal */}
      {editOrder && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>✏ Edit Order — {editOrder.caleo_id}</h2>
              <button className="btn-icon" onClick={() => { setEditOrder(null); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label">CMD ID</label>
                  <input className="form-input" value={editForm.caleo_id}
                    onChange={e => setEditForm({ ...editForm, caleo_id: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Customer Name *</label>
                  <input className="form-input" value={editForm.customer_name}
                    onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="0600000000" value={editForm.customer_phone}
                    onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input className="form-input" value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <input className="form-input" value={editForm.customer_address}
                    onChange={e => setEditForm({ ...editForm, customer_address: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Total Amount (MAD) *</label>
                  <input className="form-input" type="number" min="0" value={editForm.total_amount}
                    onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Products</label>
                {editItems.map((item, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-input" style={{ flex: 1 }} value={item.variant_id}
                      onChange={e => {
                        const updated = [...editItems];
                        updated[j] = { ...updated[j], variant_id: e.target.value };
                        setEditItems(updated);
                        setEditExpenses(prev => ({ ...prev, seal_bag: autoSealBag(updated) }));
                      }}>
                      <option value="">Select product...</option>
                      {allVariants.map(v => (
                        <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                      ))}
                    </select>
                    <input className="form-input" type="number" min="1" placeholder="Qty" style={{ width: 80 }}
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...editItems];
                        updated[j] = { ...updated[j], quantity: e.target.value };
                        setEditItems(updated);
                      }} />
                    {editItems.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        const updated = editItems.filter((_, idx) => idx !== j);
                        setEditItems(updated);
                        setEditExpenses(prev => ({ ...prev, seal_bag: autoSealBag(updated) }));
                      }}>✕</button>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm"
                  onClick={() => setEditItems([...editItems, { variant_id: '', quantity: 1 }])}>
                  + Add Product
                </button>
              </div>

              <div style={{ display: 'flex', gap: 16, padding: 12, background: '#0f1117', borderRadius: 8, flexWrap: 'wrap' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editExpenses.sticker === 1}
                    onChange={e => setEditExpenses({ ...editExpenses, sticker: e.target.checked ? 1 : 0 })} />
                  Sticker (1 MAD)
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editExpenses.seal_bag === 1}
                    onChange={e => setEditExpenses({ ...editExpenses, seal_bag: e.target.checked ? 1 : 0 })} />
                  Sell Bag (1 MAD)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#8892b0', fontSize: 13 }}>Packaging:</span>
                  <input className="form-input" type="number" min="0" style={{ width: 60, padding: '4px 8px' }}
                    value={editExpenses.packaging}
                    onChange={e => setEditExpenses({ ...editExpenses, packaging: parseFloat(e.target.value) || 0 })} />
                  <span style={{ color: '#8892b0', fontSize: 13 }}>MAD</span>
                </div>
              </div>

              {editOrder.status !== 'pending' && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#2a1a0a', border: '1px solid #f59e0b44', borderRadius: 8, fontSize: 12, color: '#f59e0b' }}>
                  ⚠ This order is <strong>{editOrder.status}</strong> — product changes will not affect stock levels.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setEditOrder(null); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>📝 Notes — {notesOrder.caleo_id}</h2>
              <button className="btn-icon" onClick={() => setNotesOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 10 }}>
                {notesOrder.customer_name} · {notesOrder.city}
              </div>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: 130, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Internal notes, follow-up reminders, customer requests..."
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNotesOrder(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNotes}>Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {/* Parsed Orders Modal (after pickup PDF) */}
      {parsedOrders && (
        <div className="modal-overlay">
          <div className="modal modal-xl">
            <div className="modal-header">
              <h2>📦 Assign Products to Orders ({parsedOrders.length} orders found)</h2>
              <button className="btn-icon" onClick={() => setParsedOrders(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              {parsedOrders.map((order, i) => (
                <div key={i} style={{ border: '1px solid #2d3248', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace', color: '#7c6ef5' }}>{order.caleo_id}</div>
                      <div style={{ marginTop: 4 }}>{order.customer_name} · {order.city} · <strong style={{ color: '#60a5fa' }}>{order.total_amount} MAD</strong></div>
                      <div style={{ color: '#8892b0', fontSize: 12 }}>{order.customer_phone} · {order.customer_address}</div>
                    </div>
                  </div>

                  {/* Product / Pack selection */}
                  {orderItems[i]?.map((item, j) => (
                    <div key={j} style={{ marginBottom: 10 }}>
                      {/* Type toggle */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <button
                          className={`btn btn-sm ${!item.isPack ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => {
                            const updated = [...orderItems[i]];
                            updated[j] = { variant_id: '', quantity: 1, isPack: false };
                            setOrderItems({ ...orderItems, [i]: updated });
                          }}
                        >Product</button>
                        <button
                          className={`btn btn-sm ${item.isPack ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => {
                            const updated = [...orderItems[i]];
                            updated[j] = { isPack: true, packId: '', presetId: '', customItems: [{ variant_id: '', quantity: 1 }] };
                            setOrderItems({ ...orderItems, [i]: updated });
                          }}
                        >Pack</button>
                        {orderItems[i].length > 1 && (
                          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
                            setOrderItems({ ...orderItems, [i]: orderItems[i].filter((_, idx) => idx !== j) });
                          }}>✕</button>
                        )}
                      </div>

                      {!item.isPack ? (
                        /* Regular product row */
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            className="form-input"
                            style={{ flex: 1 }}
                            value={item.variant_id}
                            onChange={e => {
                              const updated = [...orderItems[i]];
                              updated[j] = { ...updated[j], variant_id: e.target.value };
                              updateItemsAndSealBag(i, updated);
                            }}
                          >
                            <option value="">Select product...</option>
                            {allVariants.map(v => (
                              <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                            ))}
                          </select>
                          <input
                            className="form-input"
                            type="number" min="1" placeholder="Qty"
                            style={{ width: 80 }}
                            value={item.quantity}
                            onChange={e => {
                              const updated = [...orderItems[i]];
                              updated[j] = { ...updated[j], quantity: e.target.value };
                              setOrderItems({ ...orderItems, [i]: updated });
                            }}
                          />
                        </div>
                      ) : (
                        /* Pack row */
                        <div style={{ border: '1px solid #3d3070', borderRadius: 8, padding: 12, background: '#0f0d1a' }}>
                          {/* Select pack */}
                          <select
                            className="form-input"
                            style={{ marginBottom: 8 }}
                            value={item.packId}
                            onChange={e => {
                              const pack = packs.find(p => p.id === parseInt(e.target.value));
                              const updated = [...orderItems[i]];
                              updated[j] = {
                                ...updated[j],
                                packId: e.target.value,
                                presetId: '',
                                customItems: pack ? Array.from({ length: pack.item_count }, () => ({ variant_id: '', quantity: 1 })) : [{ variant_id: '', quantity: 1 }],
                              };
                              setOrderItems({ ...orderItems, [i]: updated });
                            }}
                          >
                            <option value="">Select pack...</option>
                            {packs.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — {p.selling_price} MAD ({p.item_count} items)</option>
                            ))}
                          </select>

                          {item.packId && (() => {
                            const pack = packs.find(p => p.id === parseInt(item.packId));
                            return pack ? (
                              <>
                                {/* Preset selector */}
                                {pack.presets.length > 0 && (
                                  <select
                                    className="form-input"
                                    style={{ marginBottom: 8 }}
                                    value={item.presetId}
                                    onChange={e => {
                                      const preset = pack.presets.find(pr => pr.id === parseInt(e.target.value));
                                      const updated = [...orderItems[i]];
                                      updated[j] = {
                                        ...updated[j],
                                        presetId: e.target.value,
                                        customItems: preset
                                          ? preset.items.map(it => ({ variant_id: String(it.variant_id), quantity: it.quantity }))
                                          : Array.from({ length: pack.item_count }, () => ({ variant_id: '', quantity: 1 })),
                                      };
                                      setOrderItems({ ...orderItems, [i]: updated });
                                    }}
                                  >
                                    <option value="">— Custom composition —</option>
                                    {pack.presets.map(pr => (
                                      <option key={pr.id} value={pr.id}>{pr.name}</option>
                                    ))}
                                  </select>
                                )}

                                {/* Composition items */}
                                <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 6 }}>
                                  Products inside this pack:
                                </div>
                                {(item.customItems || []).map((ci, k) => (
                                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <select
                                      className="form-input"
                                      style={{ flex: 1 }}
                                      value={ci.variant_id}
                                      onChange={e => {
                                        const updated = [...orderItems[i]];
                                        const newCustom = [...updated[j].customItems];
                                        newCustom[k] = { ...newCustom[k], variant_id: e.target.value };
                                        updated[j] = { ...updated[j], customItems: newCustom, presetId: '' };
                                        updateItemsAndSealBag(i, updated);
                                      }}
                                    >
                                      <option value="">Select product...</option>
                                      {allVariants.map(v => (
                                        <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                                      ))}
                                    </select>
                                    <input
                                      className="form-input"
                                      type="number" min="1"
                                      style={{ width: 70 }}
                                      value={ci.quantity}
                                      onChange={e => {
                                        const updated = [...orderItems[i]];
                                        const newCustom = [...updated[j].customItems];
                                        newCustom[k] = { ...newCustom[k], quantity: parseInt(e.target.value) || 1 };
                                        updated[j] = { ...updated[j], customItems: newCustom, presetId: '' };
                                        setOrderItems({ ...orderItems, [i]: updated });
                                      }}
                                    />
                                    <button className="btn btn-danger btn-sm" onClick={() => {
                                      const updated = [...orderItems[i]];
                                      const newCustom = updated[j].customItems.filter((_, idx) => idx !== k);
                                      updated[j] = { ...updated[j], customItems: newCustom.length ? newCustom : [{ variant_id: '', quantity: 1 }], presetId: '' };
                                      setOrderItems({ ...orderItems, [i]: updated });
                                    }}>✕</button>
                                  </div>
                                ))}
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                  const updated = [...orderItems[i]];
                                  updated[j] = { ...updated[j], customItems: [...(updated[j].customItems || []), { variant_id: '', quantity: 1 }], presetId: '' };
                                  setOrderItems({ ...orderItems, [i]: updated });
                                }}>+ Add Product</button>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => {
                    setOrderItems({ ...orderItems, [i]: [...orderItems[i], { variant_id: '', quantity: 1, isPack: false }] });
                  }}>+ Add Item</button>

                  {/* Expenses */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: 10, background: '#0f1117', borderRadius: 8 }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={orderExpenses[i]?.sticker === 1} onChange={e => setOrderExpenses({ ...orderExpenses, [i]: { ...orderExpenses[i], sticker: e.target.checked ? 1 : 0 } })} />
                      Sticker (1 MAD)
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={orderExpenses[i]?.seal_bag === 1} onChange={e => setOrderExpenses({ ...orderExpenses, [i]: { ...orderExpenses[i], seal_bag: e.target.checked ? 1 : 0 } })} />
                      Sell Bag (1 MAD)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8892b0', fontSize: 13 }}>Packaging:</span>
                      <input
                        className="form-input"
                        type="number" min="0" style={{ width: 60, padding: '4px 8px' }}
                        value={orderExpenses[i]?.packaging || 1}
                        onChange={e => setOrderExpenses({ ...orderExpenses, [i]: { ...orderExpenses[i], packaging: parseFloat(e.target.value) || 0 } })}
                      />
                      <span style={{ color: '#8892b0', fontSize: 13 }}>MAD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setParsedOrders(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveOrders}>Save All Orders</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Order Modal */}
      {showManualOrder && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>+ New Order</h2>
              <button className="btn-icon" onClick={() => { setShowManualOrder(false); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label">CMD ID *</label>
                  <input className="form-input" placeholder="e.g. CMD-123456" value={manualOrder.caleo_id}
                    onChange={e => setManualOrder({ ...manualOrder, caleo_id: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Customer Name *</label>
                  <input className="form-input" placeholder="Full name" value={manualOrder.customer_name}
                    onChange={e => setManualOrder({ ...manualOrder, customer_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="0600000000" value={manualOrder.customer_phone}
                    onChange={e => setManualOrder({ ...manualOrder, customer_phone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="City" value={manualOrder.city}
                    onChange={e => setManualOrder({ ...manualOrder, city: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <input className="form-input" placeholder="Delivery address" value={manualOrder.customer_address}
                    onChange={e => setManualOrder({ ...manualOrder, customer_address: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Total Amount (MAD) *</label>
                  <input className="form-input" type="number" min="0" placeholder="0.00" value={manualOrder.total_amount}
                    onChange={e => setManualOrder({ ...manualOrder, total_amount: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Products</label>
                {manualItems.map((item, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select className="form-input" style={{ flex: 1 }} value={item.variant_id}
                      onChange={e => {
                        const newItems = [...manualItems];
                        newItems[j] = { ...newItems[j], variant_id: e.target.value };
                        setManualItems(newItems);
                        setManualExpenses(prev => ({ ...prev, seal_bag: autoSealBag(newItems) }));
                      }}>
                      <option value="">Select product...</option>
                      {allVariants.map(v => (
                        <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                      ))}
                    </select>
                    <input className="form-input" type="number" min="1" placeholder="Qty" style={{ width: 80 }}
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...manualItems];
                        newItems[j] = { ...newItems[j], quantity: e.target.value };
                        setManualItems(newItems);
                      }} />
                    {manualItems.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        const newItems = manualItems.filter((_, idx) => idx !== j);
                        setManualItems(newItems);
                        setManualExpenses(prev => ({ ...prev, seal_bag: autoSealBag(newItems) }));
                      }}>✕</button>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setManualItems([...manualItems, { variant_id: '', quantity: 1 }])}>
                  + Add Product
                </button>
              </div>

              <div style={{ display: 'flex', gap: 16, padding: 12, background: '#0f1117', borderRadius: 8, flexWrap: 'wrap' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={manualExpenses.sticker === 1}
                    onChange={e => setManualExpenses({ ...manualExpenses, sticker: e.target.checked ? 1 : 0 })} />
                  Sticker (1 MAD)
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={manualExpenses.seal_bag === 1}
                    onChange={e => setManualExpenses({ ...manualExpenses, seal_bag: e.target.checked ? 1 : 0 })} />
                  Sell Bag (1 MAD)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#8892b0', fontSize: 13 }}>Packaging:</span>
                  <input className="form-input" type="number" min="0" style={{ width: 60, padding: '4px 8px' }}
                    value={manualExpenses.packaging}
                    onChange={e => setManualExpenses({ ...manualExpenses, packaging: parseFloat(e.target.value) || 0 })} />
                  <span style={{ color: '#8892b0', fontSize: 13 }}>MAD</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowManualOrder(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManualOrder}>Create Order</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Return Modal */}
      {showManualReturn && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>↩ Return Order</h2>
              <button className="btn-icon" onClick={() => { setShowManualReturn(false); setError(''); setSelectedReturn(null); setReturnSearch(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ marginBottom: 12 }}>
                <input className="form-input" placeholder="Search by CMD ID or customer name..."
                  value={returnSearch} onChange={e => { setReturnSearch(e.target.value); setSelectedReturn(null); }} />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16, border: '1px solid #2d3248', borderRadius: 8 }}>
                {orders
                  .filter(o => o.status === 'pending' && (!returnSearch || o.caleo_id.toLowerCase().includes(returnSearch.toLowerCase()) || o.customer_name?.toLowerCase().includes(returnSearch.toLowerCase())))
                  .slice(0, 50)
                  .map(o => (
                    <div key={o.id}
                      style={{ padding: '10px 14px', borderBottom: '1px solid #2d3248', cursor: 'pointer', background: selectedReturn?.id === o.id ? '#0d2a1e' : 'transparent', borderLeft: selectedReturn?.id === o.id ? '3px solid #00d48f' : '3px solid transparent' }}
                      onClick={() => setSelectedReturn(o)}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c6ef5' }}>{o.caleo_id}</div>
                      <div style={{ marginTop: 2 }}>{o.customer_name} · <span style={{ color: '#8892b0' }}>{o.city}</span> · <strong style={{ color: '#60a5fa' }}>{o.total_amount} MAD</strong></div>
                    </div>
                  ))}
                {orders.filter(o => o.status === 'pending').length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#8892b0' }}>No pending orders found</div>
                )}
              </div>
              {selectedReturn && (
                <div style={{ padding: 14, background: '#0d2a1e', border: '1px solid #00d48f33', borderRadius: 8 }}>
                  <div style={{ fontWeight: 500, marginBottom: 10, color: '#00d48f' }}>
                    Selected: <span style={{ fontFamily: 'monospace' }}>{selectedReturn.caleo_id}</span> — {selectedReturn.customer_name}
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={manualReturnChoice.seal_bag_returned}
                        onChange={e => setManualReturnChoice({ ...manualReturnChoice, seal_bag_returned: e.target.checked })} />
                      Sell Bag Returned (+1 MAD)
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={manualReturnChoice.product_broken}
                        onChange={e => setManualReturnChoice({ ...manualReturnChoice, product_broken: e.target.checked })} />
                      Product Broken (broken stock)
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowManualReturn(false); setError(''); setSelectedReturn(null); setReturnSearch(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleManualReturn} disabled={!selectedReturn}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Modal */}
      {exchangeOrder && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>↔ Exchange — {exchangeOrder.caleo_id}</h2>
              <button className="btn-icon" onClick={() => { setExchangeOrder(null); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {/* Original order info */}
              <div style={{ padding: '10px 14px', background: '#0f1117', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{exchangeOrder.customer_name}</div>
                <div style={{ color: '#8892b0' }}>
                  {exchangeOrder.city} · {exchangeOrder.customer_phone} · {exchangeOrder.total_amount} MAD
                </div>
                <div style={{ marginTop: 6, color: '#8892b0' }}>
                  Original items: {exchangeOrder.items?.map(i => `${i.product_name} ${i.size || ''} ${i.color || ''} x${i.quantity}`).join(', ') || '—'}
                </div>
              </div>

              {/* Step tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #2d3248' }}>
                {[{ n: 1, label: '① Return original' }, { n: 2, label: '② Replacement order' }].map(({ n, label }) => (
                  <button key={n} onClick={() => setExchangeStep(n)} style={{
                    background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    color: exchangeStep === n ? 'var(--accent, #00d48f)' : '#8892b0',
                    borderBottom: `2px solid ${exchangeStep === n ? 'var(--accent, #00d48f)' : 'transparent'}`,
                  }}>{label}</button>
                ))}
              </div>

              {/* Step 1: Return */}
              {exchangeStep === 1 && (
                <div>
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#8892b0' }}>
                    The original order will be marked as <strong style={{ color: '#f87171' }}>cancelled</strong> and stock will be restored.
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={exchangeReturnChoice.seal_bag_returned}
                        onChange={e => setExchangeReturnChoice({ ...exchangeReturnChoice, seal_bag_returned: e.target.checked })} />
                      Sell Bag Returned (+1 MAD)
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={exchangeReturnChoice.product_broken}
                        onChange={e => setExchangeReturnChoice({ ...exchangeReturnChoice, product_broken: e.target.checked })} />
                      Product Broken (goes to broken stock)
                    </label>
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={() => setExchangeStep(2)}>Next →</button>
                  </div>
                </div>
              )}

              {/* Step 2: New exchange order */}
              {exchangeStep === 2 && (
                <div>
                  <div style={{ marginBottom: 14, fontSize: 13, color: '#8892b0' }}>
                    A new order will be created for the same customer. The client only pays the <strong style={{ color: '#00d48f' }}>delivery fee</strong>.
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Total Amount — delivery fee only (MAD) *</label>
                    <input className="form-input" type="number" min="0" style={{ maxWidth: 180 }}
                      value={exchangeTotal}
                      onChange={e => setExchangeTotal(e.target.value)} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Replacement Product(s)</label>
                    {exchangeItems.map((item, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <select className="form-input" style={{ flex: 1 }} value={item.variant_id}
                          onChange={e => {
                            const updated = [...exchangeItems];
                            updated[j] = { ...updated[j], variant_id: e.target.value };
                            setExchangeItems(updated);
                            setExchangeExpenses(prev => ({ ...prev, seal_bag: autoSealBag(updated) }));
                          }}>
                          <option value="">Select product...</option>
                          {allVariants.map(v => (
                            <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                          ))}
                        </select>
                        <input className="form-input" type="number" min="1" placeholder="Qty" style={{ width: 80 }}
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...exchangeItems];
                            updated[j] = { ...updated[j], quantity: e.target.value };
                            setExchangeItems(updated);
                          }} />
                        {exchangeItems.length > 1 && (
                          <button className="btn btn-danger btn-sm" onClick={() => {
                            const updated = exchangeItems.filter((_, idx) => idx !== j);
                            setExchangeItems(updated);
                          }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => setExchangeItems([...exchangeItems, { variant_id: '', quantity: 1 }])}>
                      + Add Product
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 16, padding: 12, background: '#0f1117', borderRadius: 8, flexWrap: 'wrap' }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={exchangeExpenses.sticker === 1}
                        onChange={e => setExchangeExpenses({ ...exchangeExpenses, sticker: e.target.checked ? 1 : 0 })} />
                      Sticker (1 MAD)
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={exchangeExpenses.seal_bag === 1}
                        onChange={e => setExchangeExpenses({ ...exchangeExpenses, seal_bag: e.target.checked ? 1 : 0 })} />
                      Sell Bag (1 MAD)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8892b0', fontSize: 13 }}>Packaging:</span>
                      <input className="form-input" type="number" min="0" style={{ width: 60, padding: '4px 8px' }}
                        value={exchangeExpenses.packaging}
                        onChange={e => setExchangeExpenses({ ...exchangeExpenses, packaging: parseFloat(e.target.value) || 0 })} />
                      <span style={{ color: '#8892b0', fontSize: 13 }}>MAD</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setExchangeOrder(null); setError(''); }}>Cancel</button>
              {exchangeStep === 1
                ? <button className="btn btn-primary" onClick={() => setExchangeStep(2)}>Next →</button>
                : <button className="btn btn-primary" onClick={handleExchange}>↔ Confirm Exchange</button>
              }
            </div>
          </div>
        </div>
      )}

      {/* Return Orders Modal */}
      {returnOrders && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>📥 Process Returns ({returnOrders.matched_orders.length} matched)</h2>
              <button className="btn-icon" onClick={() => setReturnOrders(null)}>✕</button>
            </div>
            <div className="modal-body">
              {returnOrders.unmatched_cmd_ids.length > 0 && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  Not found in database: {returnOrders.unmatched_cmd_ids.join(', ')}
                </div>
              )}
              {returnOrders.matched_orders.length === 0 ? (
                <div className="empty-state"><h3>No matching orders found</h3></div>
              ) : returnOrders.matched_orders.map(order => (
                <div key={order.id} style={{ border: '1px solid #2d3248', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace', color: '#7c6ef5' }}>{order.caleo_id}</div>
                  <div style={{ marginTop: 4 }}>{order.customer_name} · {order.city} · {order.total_amount} MAD</div>
                  <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={returnChoices[order.id]?.seal_bag_returned || false}
                        onChange={e => setReturnChoices({ ...returnChoices, [order.id]: { ...returnChoices[order.id], seal_bag_returned: e.target.checked } })} />
                      Sell Bag Returned (+1 MAD)
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={returnChoices[order.id]?.product_broken || false}
                        onChange={e => setReturnChoices({ ...returnChoices, [order.id]: { ...returnChoices[order.id], product_broken: e.target.checked } })} />
                      Product Broken (goes to broken stock)
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReturnOrders(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleProcessReturns}>Confirm Returns</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
