import { useState, useEffect, useRef } from 'react';
import { getOrders, getProducts, getPacks, uploadPickupPDF, bulkCreateOrders, uploadReturnPDF, processReturns, updateOrderStatus, updateOrder, deleteOrder, bulkUpdateOrderStatus, sendToOlivraison, sendToForcelog, getForcelogStatus, syncAllForcelog, syncAllOlivraison, requestOlivRamassage, requestForcelogRamassage, confirmPickup, errorMessage } from '../api';
import ErrorExplain from '../components/ErrorExplain';
import { validatePhone, validateAmount, numericOnly, fieldErrorStyle } from '../utils/validate';

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL = {
  pending: 'Pending',
  awaiting_pickup: 'Awaiting Pickup',
  in_delivery: 'In Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusStyle = (o) => {
  if (o.delivery_status) {
    const ds = o.delivery_status.toLowerCase();
    if (['livr', 'deliver'].some(k => ds.includes(k)))
      return { background: 'rgba(74,222,128,0.15)', color: '#4ade80' };
    if (['annul', 'retour', 'cancel', 'refus', 'echec', 'échou', 'lost'].some(k => ds.includes(k)))
      return { background: 'rgba(248,113,113,0.15)', color: '#f87171' };
    if (['appel', 'call', 'vocal', 'injoign', 'réponse', 'reponse', 'sms', 'whatsapp'].some(k => ds.includes(k)))
      return { background: 'rgba(251,146,60,0.15)', color: '#fb923c' };
    if (['route', 'transit', 'ramassage', 'pickup', 'expédi', 'expedi', 'reporté', 'reporte'].some(k => ds.includes(k)))
      return { background: 'rgba(96,165,250,0.15)', color: '#60a5fa' };
    return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  }
  const S = {
    pending:         { background: 'rgba(250,204,21,0.15)',  color: '#facc15' },
    awaiting_pickup: { background: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    in_delivery:     { background: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
    delivered:       { background: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    cancelled:       { background: 'rgba(248,113,113,0.15)', color: '#f87171' },
  };
  return S[o.status] || { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orderCount, setOrderCount] = useState(0);
  const [returnCount, setReturnCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [products, setProducts] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // PDF upload states
  const [parsedOrders, setParsedOrders] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [orderExpenses, setOrderExpenses] = useState({});
  const [orderErrors, setOrderErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  // Returns states (PDF flow)
  const [returnOrders, setReturnOrders] = useState(null);
  const [returnChoices, setReturnChoices] = useState({});

  // Manual order creation
  const generateManualId = () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `MAN-${date}-${time}`;
  };
  const [showManualOrder, setShowManualOrder] = useState(false);
  const emptyManualOrder = () => ({ caleo_id: generateManualId(), customer_name: '', customer_phone: '', customer_address: '', city: '', total_amount: '' });
  const [manualOrder, setManualOrder] = useState(emptyManualOrder());
  const [manualItems, setManualItems] = useState([{ variant_id: '', quantity: 1 }]);
  const [manualExpenses, setManualExpenses] = useState({ sticker: 0, seal_bag: 0, packaging: 1 });

  // Manual return
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [manualReturnChoice, setManualReturnChoice] = useState({ seal_bag_returned: false, product_broken: false });

  // Tab
  const [activeTab, setActiveTab] = useState('orders');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Detail popup
  const [detailOrder, setDetailOrder] = useState(null);

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
  const [manualFieldErrors, setManualFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [sendingOliv,    setSendingOliv]    = useState(null);
  const [sendingForce,   setSendingForce]   = useState(null);
  const [refreshingForce, setRefreshingForce] = useState(null);

  // Ramassage
  const [showRamassage,    setShowRamassage]    = useState(false);
  const [ramassageResult,  setRamassageResult]  = useState(null);
  const [ramassageLoading, setRamassageLoading] = useState(false);

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

  const buildParams = (overrides = {}) => {
    const { p = page, f = filter, t = activeTab } = overrides;
    const params = { page: p, limit: 100, tab: t };
    if (t === 'orders' && f !== 'all') params.status = f;
    return params;
  };

  const load = (overrides = {}) => {
    setLoading(true);
    Promise.all([getOrders(buildParams(overrides)), getProducts(), getPacks()])
      .then(([o, p, pk]) => {
        setOrders(o.data.orders);
        setTotalPages(o.data.pages);
        setOrderCount(o.data.order_count);
        setReturnCount(o.data.return_count);
        setStatusCounts(o.data.status_counts || {});
        setProducts(p.data);
        setPacks(pk.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load({ p: page, f: filter, t: activeTab });
    // Silently sync delivery statuses in the background on page load
    Promise.allSettled([syncAllForcelog(), syncAllOlivraison()])
      .then(() => load({ p: page, f: filter, t: activeTab }))
      .catch(() => {});
  }, []);

  // Handle pickup PDF upload
  const handleManualOrder = async () => {
    setError('');
    const errs = {};
    if (!manualOrder.customer_name.trim()) errs.customer_name = 'Customer name is required';
    if (manualOrder.customer_phone) {
      const phoneErr = validatePhone(manualOrder.customer_phone);
      if (phoneErr) errs.customer_phone = phoneErr;
    }
    const amtErr = validateAmount(manualOrder.total_amount);
    if (amtErr) errs.total_amount = amtErr;
    if (Object.keys(errs).length) { setManualFieldErrors(errs); return; }
    setManualFieldErrors({});
    const flatItems = manualItems
      .filter(item => item.variant_id)
      .map(item => ({ variant_id: parseInt(item.variant_id), quantity: parseInt(item.quantity) || 1 }));
    if (flatItems.length === 0) { setManualFieldErrors(e => ({ ...e, products: 'Add at least one product' })); return; }
    try {
      await bulkCreateOrders([{ ...manualOrder, total_amount: parseFloat(manualOrder.total_amount), items: flatItems, expenses: manualExpenses }]);
      setSuccess('Order created successfully!');
      setShowManualOrder(false);
      setManualOrder(emptyManualOrder());
      setManualItems([{ variant_id: '', quantity: 1 }]);
      setManualExpenses({ sticker: 0, seal_bag: 0, packaging: 1 });
      load();
    } catch (e) { setError(errorMessage(e)); }
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
    } catch (e) { setError(errorMessage(e)); }
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
      setError(errorMessage(e));
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
      setError(errorMessage(e));
    }
    setUploading(false);
    returnRef.current.value = '';
  };

  const removeOrderFromParsed = (i) => {
    const newParsed = parsedOrders.filter((_, idx) => idx !== i);
    const newItems = {};
    const newExpenses = {};
    newParsed.forEach((_, newIdx) => {
      const oldIdx = newIdx >= i ? newIdx + 1 : newIdx;
      newItems[newIdx] = orderItems[oldIdx];
      newExpenses[newIdx] = orderExpenses[oldIdx];
    });
    setParsedOrders(newParsed);
    setOrderItems(newItems);
    setOrderExpenses(newExpenses);
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
      setOrderErrors({});
      load();
    } catch (e) {
      const detail = e.response?.data?.detail;
      // Parse "[CMD-xxx] message" to highlight the specific order card
      const idMatch = typeof detail === 'string' ? detail.match(/^\[([^\]]+)\]/) : null;
      if (idMatch) {
        const failedId = idMatch[1].trim();
        const msg = detail.replace(/^\[[^\]]+\]\s*/, '');
        // Find by index so whitespace in caleo_id never causes a mismatch
        const failedIdx = parsedOrders.findIndex(o => (o.caleo_id || '').trim() === failedId);
        setOrderErrors(failedIdx !== -1 ? { [failedIdx]: msg } : {});
        setError(`Order ${failedId}: ${msg}`);
      } else {
        setError(errorMessage(e));
      }
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
      setError(errorMessage(e));
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (newStatus === 'cancelled' && !confirm('Cancel this order?')) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    try {
      await updateOrderStatus(id, newStatus);
    } catch (e) {
      setError(errorMessage(e));
      load({ p: page, f: filter, t: activeTab });
    }
  };

  const handleConfirmPickup = async () => {
    try {
      const res = await confirmPickup();
      setSuccess(`${res.data.confirmed} orders confirmed as picked up — moved to In Delivery`);
      load({ p: page, f: filter, t: activeTab });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncAll = async () => {
    setSyncing(true);
    setError('');
    try {
      const [fl, ol] = await Promise.allSettled([syncAllForcelog(), syncAllOlivraison()]);
      const flCount = fl.status === 'fulfilled' ? fl.value.data.updated : 0;
      const olCount = ol.status === 'fulfilled' ? ol.value.data.updated : 0;
      setSuccess(`Synced: ${flCount} Forcelog + ${olCount} Olivraison orders updated`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
    setSyncing(false);
  };

  const handleRamassage = async () => {
    setRamassageLoading(true);
    setRamassageResult(null);
    const result = { oliv: null, force: null };
    const [oRes, fRes] = await Promise.allSettled([
      requestOlivRamassage(),
      requestForcelogRamassage(),
    ]);
    result.oliv  = oRes.status  === 'fulfilled' ? oRes.value.data  : { error: errorMessage(oRes.reason) };
    result.force = fRes.status  === 'fulfilled' ? fRes.value.data  : { error: errorMessage(fRes.reason) };
    setRamassageResult(result);
    setRamassageLoading(false);
    load({ p: page, f: filter, t: activeTab });
  };

  const handleSendForcelog = async (id) => {
    setSendingForce(id);
    try {
      const res = await sendToForcelog(id);
      setOrders(prev => prev.map(o => o.id === id
        ? { ...o, tracking_id: res.data.tracking_id, delivery_status: 'Envoyé', delivery_provider: 'forcelog' }
        : o
      ));
      setSuccess(`Sent to Forcelog — Tracking: ${res.data.tracking_id}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSendingForce(null);
    }
  };

  const handleRefreshForcelog = async (id) => {
    setRefreshingForce(id);
    try {
      const res = await getForcelogStatus(id);
      setOrders(prev => prev.map(o => o.id === id
        ? { ...o, delivery_status: res.data.delivery_status || res.data.status }
        : o
      ));
      if (detailOrder?.id === id) {
        setDetailOrder(prev => ({ ...prev, delivery_status: res.data.delivery_status || res.data.status }));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshingForce(null);
    }
  };

  const handleSendOlivraison = async (id) => {
    setSendingOliv(id);
    try {
      const res = await sendToOlivraison(id);
      setOrders(prev => prev.map(o => o.id === id
        ? { ...o, tracking_id: res.data.tracking_id, delivery_status: 'Envoyé' }
        : o
      ));
      setSuccess(`Sent to Olivraison — Tracking: ${res.data.tracking_id}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSendingOliv(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this order?')) return;
    try {
      await deleteOrder(id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleRevertReturn = async (id) => {
    if (!confirm('Revert this return back to Pending?')) return;
    await updateOrderStatus(id, 'pending');
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
      setError(errorMessage(e));
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
    const errs = {};
    if (!editForm.customer_name.trim()) errs.customer_name = 'Customer name is required';
    if (editForm.customer_phone) {
      const phoneErr = validatePhone(editForm.customer_phone);
      if (phoneErr) errs.customer_phone = phoneErr;
    }
    const amtErr = validateAmount(editForm.total_amount);
    if (amtErr) errs.total_amount = amtErr;
    if (Object.keys(errs).length) { setEditFieldErrors(errs); return; }
    setEditFieldErrors({});
    const flatItems = editItems
      .filter(i => i.variant_id)
      .map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 }));
    if (flatItems.length === 0) { setEditFieldErrors(e => ({ ...e, products: 'Add at least one product' })); return; }
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
      setError(errorMessage(e));
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
    setEditFieldErrors({});
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
      setError(errorMessage(e));
    }
  };

  const searchMatch = (o) =>
    !search ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.caleo_id?.includes(search) ||
    o.city?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_phone?.includes(search);

  // Orders are already filtered server-side; just apply local search
  const filtered = orders.filter(searchMatch);
  const filteredReturns = orders.filter(searchMatch);

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="file" ref={pickupRef} accept=".pdf" style={{ display: 'none' }} onChange={handlePickupUpload} />
          <input type="file" ref={returnRef} accept=".pdf" style={{ display: 'none' }} onChange={handleReturnUpload} />
          {activeTab === 'orders' ? <>
            <button className="btn btn-primary" onClick={() => { setError(''); setShowManualOrder(true); }}>+ New Order</button>
            <button className="btn btn-secondary" onClick={() => pickupRef.current.click()} disabled={uploading}>
              {uploading ? '⏳ Parsing...' : '📤 Upload Pickup PDF'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setRamassageResult(null); setShowRamassage(true); }} title="Request courier pickup">📦 Request Pickup</button>
            {filter === 'awaiting_pickup' && (
              <button className="btn btn-secondary" onClick={handleConfirmPickup} style={{ borderColor: '#60a5fa', color: '#60a5fa' }} title="Courier has arrived and collected packages">✓ Confirm Pickup</button>
            )}
            <button className="btn btn-secondary" onClick={exportCSV} title="Export visible orders to CSV">⬇ Export CSV</button>
            <button className="btn btn-secondary" onClick={handleSyncAll} disabled={syncing} title="Refresh delivery status from Forcelog & Olivraison" style={{ padding: '0 12px', fontSize: 18 }}>{syncing ? '⏳' : '⟳'}</button>
          </> : <>
            <button className="btn btn-secondary" style={{ borderColor: '#f87171', color: '#f87171' }} onClick={() => { setError(''); setShowManualReturn(true); }}>↩ Create Return</button>
            <button className="btn btn-secondary" onClick={() => returnRef.current.click()} disabled={uploading}>
              {uploading ? '⏳ Parsing...' : '📥 Upload Return PDF'}
            </button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[{ id: 'orders', label: `Orders (${orderCount})` },
          { id: 'returns', label: `Returns (${returnCount})` }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); setFilter('all'); setSelectedIds(new Set()); setPage(1); load({ p: 1, f: 'all', t: tab.id }); }}
            style={{
              background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--t2)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              transition: 'all .15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorExplain message={error} page="Orders" />}
      {success && <div className="alert alert-success">{success} <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {activeTab === 'orders' && [
          { value: 'all',             label: 'All',             countKey: null },
          { value: 'pending',         label: 'Pending',         countKey: 'pending' },
          { value: 'awaiting_pickup', label: 'Awaiting Pickup', countKey: 'awaiting_pickup' },
          { value: 'in_delivery',     label: 'In Delivery',     countKey: 'in_delivery' },
          { value: 'delivered',       label: 'Delivered',       countKey: 'delivered' },
        ].map(({ value, label, countKey }) => {
          const count = countKey ? (statusCounts[countKey] || 0) : orderCount;
          return (
            <button key={value}
              className={`btn ${filter === value ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setFilter(value); setPage(1); load({ p: 1, f: value, t: activeTab }); }}>
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                  background: filter === value ? 'rgba(255,255,255,0.25)' : 'rgba(0,212,143,0.15)',
                  color: filter === value ? '#fff' : 'var(--accent)',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div className="search-bar" style={{ marginLeft: activeTab === 'returns' ? 0 : 'auto' }}>
          <span>🔍</span>
          <input placeholder="Search by name, CMD, city, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Bulk action bar — orders tab only */}
      {activeTab === 'orders' && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1a2e', border: '1px solid #00d48f44', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#00d48f' }}>{selectedIds.size} selected</span>
          <span style={{ color: '#8892b0', fontSize: 13 }}>Update to:</span>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#4ade80', color: '#4ade80' }} onClick={() => handleBulkStatus('delivered')}>✓ Delivered</button>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => handleBulkStatus('pending')}>⏳ Pending</button>
          <button className="btn btn-sm btn-secondary" style={{ borderColor: '#f87171', color: '#f87171' }} onClick={() => handleBulkStatus('cancelled')}>✕ Cancelled</button>
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Returns Table */}
      {activeTab === 'returns' && (
        <div className="card">
          {filteredReturns.length === 0 ? (
            <div className="empty-state">
              <h3>No returns yet</h3>
              <p>Click "↩ Create Return" to register a returned order</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>CMD-ID</th><th>Customer</th><th>City</th><th>Amount</th><th>Items</th><th>Status</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map(o => (
                    <tr key={o.id} style={{ opacity: 0.55 }}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.caleo_id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                        {o.customer_phone
                          ? <div style={{ color: '#8892b0', fontSize: 11 }}>{o.customer_phone}</div>
                          : <div style={{ color: '#8892b0', fontSize: 11 }}>—</div>}
                      </td>
                      <td>{o.city}</td>
                      <td style={{ fontWeight: 600, color: '#60a5fa' }}>{o.total_amount} MAD</td>
                      <td>
                        {o.items?.length > 0
                          ? o.items.map(item => <div key={item.id} style={{ fontSize: 12 }}>{item.product_name} {item.size} {item.color} x{item.quantity}</div>)
                          : <span style={{ color: '#8892b0' }}>—</span>}
                      </td>
                      <td>
                        <span className="badge badge-red">Return</span>
                      </td>
                      <td style={{ color: '#8892b0', fontSize: 12 }}>
                        {o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" title="View details" onClick={() => setDetailOrder(o)}>👁</button>
                          <button className="btn btn-secondary btn-sm" title="Revert to Pending" onClick={() => handleRevertReturn(o.id)} style={{ color: '#facc15', borderColor: '#facc15' }}>↩ Modify</button>
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

      {/* Orders Table */}
      {activeTab === 'orders' && <div className="card">
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
                          ...statusStyle(o) }}>
                          {o.delivery_status || STATUS_LABEL[o.status] || o.status}
                        </span>
                        <select
                          style={{ fontSize: 10, padding: '2px 4px', background: 'transparent',
                            border: '1px solid var(--border)', borderRadius: 4, color: 'var(--t2)', cursor: 'pointer' }}
                          value={['awaiting_pickup','in_delivery'].includes(o.status) ? 'pending' : o.status}
                          onChange={e => handleStatusChange(o.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ color: '#8892b0', fontSize: 12 }}>
                      {o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="View order details"
                          onClick={() => setDetailOrder(o)}>
                          👁
                        </button>
                        {o.tracking_id ? (
                            <span
                              title={`${o.tracking_id} — click to copy`}
                              onClick={() => navigator.clipboard.writeText(o.tracking_id)}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                                background: 'rgba(100,116,139,0.12)', color: 'var(--t2)', border: '1px solid var(--border)',
                                whiteSpace: 'nowrap', display: 'inline-block' }}>
                              {o.delivery_provider === 'forcelog' ? '📦' : '🚚'} Sent to {o.delivery_provider === 'forcelog' ? 'Forcelog' : 'Olivraison'}
                            </span>
                        ) : !o.tracking_id ? (
                          <select
                            className="btn btn-secondary btn-sm"
                            style={{ cursor: 'pointer', fontSize: 12, paddingRight: 4 }}
                            disabled={sendingOliv === o.id || sendingForce === o.id}
                            value=""
                            onChange={e => {
                              const v = e.target.value;
                              if (v === 'olivraison') handleSendOlivraison(o.id);
                              if (v === 'forcelog')   handleSendForcelog(o.id);
                            }}>
                            <option value="" disabled>
                              {sendingOliv === o.id || sendingForce === o.id ? 'Sending…' : 'Send to…'}
                            </option>
                            <option value="olivraison">🚚 Olivraison</option>
                            <option value="forcelog">📦 Forcelog</option>
                          </select>
                        ) : null}
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
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Pagination */}
      {activeTab === 'orders' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); load({ p, f: filter, t: activeTab }); }}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--t2)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); load({ p, f: filter, t: activeTab }); }}>Next →</button>
        </div>
      )}
      {activeTab === 'returns' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); load({ p, f: filter, t: activeTab }); }}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--t2)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); load({ p, f: filter, t: activeTab }); }}>Next →</button>
        </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (() => {
        const o = detailOrder;
        const source = o.caleo_id?.startsWith('MAN-') ? 'Manual'
          : o.caleo_id?.startsWith('EXCH-') ? 'Exchange'
          : o.uploaded_by ? `PDF — ${o.uploaded_by}`
          : 'Website / Lead';
        return (
          <div className="modal-overlay" onClick={() => setDetailOrder(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <h2>Order Details</h2>
                <button className="btn-icon" onClick={() => setDetailOrder(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* CMD + Source */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--t2)' }}>{o.caleo_id}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: 'var(--accent)22', color: 'var(--accent)', border: '1px solid var(--accent)44' }}>
                    {source}
                  </span>
                </div>

                {/* Customer info */}
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{o.customer_name}</div>
                  {o.customer_phone && (
                    <a href={`https://wa.me/${o.customer_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#25D366', fontSize: 13, textDecoration: 'none' }}>
                      💬 {o.customer_phone}
                    </a>
                  )}
                  {o.city && <div style={{ fontSize: 13, color: 'var(--t2)' }}>📍 {o.city}</div>}
                  {o.customer_address && <div style={{ fontSize: 12, color: 'var(--t3)' }}>{o.customer_address}</div>}
                </div>

                {/* Amount + Status + Date */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>TOTAL</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#60a5fa' }}>{o.total_amount} MAD</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>STATUS</div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, ...statusStyle(o) }}>
                      {o.delivery_status || STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>DATE</div>
                    <div style={{ fontSize: 13, color: 'var(--t2)' }}>{o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</div>
                  </div>
                </div>

                {/* Products */}
                {o.items?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', marginBottom: 8 }}>PRODUCTS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {o.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: 'var(--bg)', borderRadius: 7, padding: '8px 12px', fontSize: 13 }}>
                          <span>{item.product_name}{item.size ? ` — ${item.size}` : ''}{item.color ? ` / ${item.color}` : ''}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tracking */}
                {o.tracking_id && (() => {
                  const isForce = o.delivery_provider === 'forcelog';
                  const color = isForce ? '#7c3aed' : '#00d48f';
                  return (
                    <div style={{ background: isForce ? 'rgba(124,58,237,0.08)' : 'rgba(0,212,143,0.08)', border: `1px solid ${isForce ? 'rgba(124,58,237,0.25)' : 'rgba(0,212,143,0.25)'}`, borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '.08em' }}>
                          {isForce ? 'FORCELOG' : 'OLIVRAISON'}
                        </div>
                        {isForce && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Refresh delivery status from Forcelog"
                            style={{ fontSize: 11, padding: '2px 8px', color }}
                            disabled={refreshingForce === o.id}
                            onClick={() => handleRefreshForcelog(o.id)}>
                            {refreshingForce === o.id ? '…' : '🔄 Refresh'}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--t1)', fontFamily: 'monospace' }}>{o.tracking_id}</div>
                      {o.delivery_status && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>{o.delivery_status}</div>}
                    </div>
                  );
                })()}

                {/* Notes */}
                {o.notes && (
                  <div style={{ fontSize: 13, color: 'var(--t2)', fontStyle: 'italic', background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                    📝 {o.notes}
                  </div>
                )}

                {/* Confirmed by */}
                {o.confirmed_by && (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Confirmed by: <span style={{ color: '#00d48f', fontWeight: 600 }}>{o.confirmed_by}</span></div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Order Modal */}
      {editOrder && (
        <div className="modal-overlay">
          <form className="modal modal-lg" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
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
                  {editFieldErrors.customer_name && <div style={fieldErrorStyle}>{editFieldErrors.customer_name}</div>}
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="0600000000" value={editForm.customer_phone}
                    onKeyDown={numericOnly}
                    onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })} />
                  {editFieldErrors.customer_phone && <div style={fieldErrorStyle}>{editFieldErrors.customer_phone}</div>}
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
                  {editFieldErrors.total_amount && <div style={fieldErrorStyle}>{editFieldErrors.total_amount}</div>}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Products</label>
                {editFieldErrors.products && <div style={fieldErrorStyle}>{editFieldErrors.products}</div>}
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
                        <option key={v.id} value={v.id} disabled={v.stock === 0}>
                          {v.stock === 0 ? `${v.label} — OUT OF STOCK` : v.stock <= 3 ? `${v.label} (⚠ ${v.stock} left)` : `${v.label} (${v.stock} in stock)`}
                        </option>
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
              <button type="button" className="btn btn-secondary" onClick={() => { setEditOrder(null); setError(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Parsed Orders Modal (after pickup PDF) */}
      {parsedOrders && (
        <div className="modal-overlay">
          <div className="modal modal-xl">
            <div className="modal-header">
              <h2>📦 Assign Products to Orders ({parsedOrders.length} remaining)</h2>
              <button className="btn-icon" onClick={() => { setParsedOrders(null); setOrderErrors({}); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              {parsedOrders.map((order, i) => {
                const orderErr = orderErrors[i];
                return (
                <div key={i} style={{ border: `1px solid ${orderErr ? '#f87171' : '#2d3248'}`, borderRadius: 10, padding: 16, marginBottom: 16, background: orderErr ? 'rgba(248,113,113,0.07)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace', color: orderErr ? '#f87171' : '#7c6ef5' }}>{order.caleo_id}</div>
                      <div style={{ marginTop: 4 }}>{order.customer_name} · {order.city} · <strong style={{ color: '#60a5fa' }}>{order.total_amount} MAD</strong></div>
                      <div style={{ color: '#8892b0', fontSize: 12 }}>{order.customer_phone} · {order.customer_address}</div>
                      {orderErr && <div style={{ marginTop: 6, color: '#f87171', fontSize: 12, fontWeight: 500 }}>⚠ {orderErr}</div>}
                    </div>
                    <button className="btn-icon" title="Skip this order" onClick={() => removeOrderFromParsed(i)} style={{ alignSelf: 'flex-start', color: 'var(--t2)' }}>✕</button>
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
                              <option key={v.id} value={v.id} disabled={v.stock === 0}>
                          {v.stock === 0 ? `${v.label} — OUT OF STOCK` : v.stock <= 3 ? `${v.label} (⚠ ${v.stock} left)` : `${v.label} (${v.stock} in stock)`}
                        </option>
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
                                        <option key={v.id} value={v.id} disabled={v.stock === 0}>
                          {v.stock === 0 ? `${v.label} — OUT OF STOCK` : v.stock <= 3 ? `${v.label} (⚠ ${v.stock} left)` : `${v.label} (${v.stock} in stock)`}
                        </option>
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
              ); })}
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
          <form className="modal modal-lg" onSubmit={e => { e.preventDefault(); handleManualOrder(); }}>
            <div className="modal-header">
              <h2>+ New Order</h2>
              <button className="btn-icon" onClick={() => { setShowManualOrder(false); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label">CMD ID <span style={{ color: 'var(--accent)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>auto</span></label>
                  <input className="form-input" value={manualOrder.caleo_id} readOnly
                    style={{ color: 'var(--accent)', fontFamily: 'monospace', opacity: 0.8, cursor: 'default' }} />
                </div>
                <div>
                  <label className="form-label">Customer Name *</label>
                  <input className="form-input" placeholder="Full name" value={manualOrder.customer_name}
                    onChange={e => setManualOrder({ ...manualOrder, customer_name: e.target.value })} />
                  {manualFieldErrors.customer_name && <div style={fieldErrorStyle}>{manualFieldErrors.customer_name}</div>}
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="0600000000" value={manualOrder.customer_phone}
                    onKeyDown={numericOnly}
                    onChange={e => setManualOrder({ ...manualOrder, customer_phone: e.target.value })} />
                  {manualFieldErrors.customer_phone && <div style={fieldErrorStyle}>{manualFieldErrors.customer_phone}</div>}
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
                  {manualFieldErrors.total_amount && <div style={fieldErrorStyle}>{manualFieldErrors.total_amount}</div>}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Products</label>
                {manualFieldErrors.products && <div style={fieldErrorStyle}>{manualFieldErrors.products}</div>}
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
                        <option key={v.id} value={v.id} disabled={v.stock === 0}>
                          {v.stock === 0 ? `${v.label} — OUT OF STOCK` : v.stock <= 3 ? `${v.label} (⚠ ${v.stock} left)` : `${v.label} (${v.stock} in stock)`}
                        </option>
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
              <button type="button" className="btn btn-secondary" onClick={() => { setShowManualOrder(false); setError(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Order</button>
            </div>
          </form>
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
                  .filter(o => ['pending','awaiting_pickup','in_delivery'].includes(o.status) && (!returnSearch || o.caleo_id.toLowerCase().includes(returnSearch.toLowerCase()) || o.customer_name?.toLowerCase().includes(returnSearch.toLowerCase())))
                  .slice(0, 50)
                  .map(o => (
                    <div key={o.id}
                      style={{ padding: '10px 14px', borderBottom: '1px solid #2d3248', cursor: 'pointer', background: selectedReturn?.id === o.id ? '#0d2a1e' : 'transparent', borderLeft: selectedReturn?.id === o.id ? '3px solid #00d48f' : '3px solid transparent' }}
                      onClick={() => setSelectedReturn(o)}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c6ef5' }}>{o.caleo_id}</div>
                      <div style={{ marginTop: 2 }}>{o.customer_name} · <span style={{ color: '#8892b0' }}>{o.city}</span> · <strong style={{ color: '#60a5fa' }}>{o.total_amount} MAD</strong></div>
                    </div>
                  ))}
                {orders.filter(o => ['pending','awaiting_pickup','in_delivery'].includes(o.status)).length === 0 && (
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
                            <option key={v.id} value={v.id} disabled={v.stock === 0}>
                          {v.stock === 0 ? `${v.label} — OUT OF STOCK` : v.stock <= 3 ? `${v.label} (⚠ ${v.stock} left)` : `${v.label} (${v.stock} in stock)`}
                        </option>
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

      {/* Ramassage Modal */}
      {showRamassage && (
        <div className="modal-overlay" onClick={() => setShowRamassage(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 Ramassage — Request Pickup</h2>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>
                Requests a courier pickup for all your in-delivery orders (orders with a tracking number).
              </p>

              {ramassageResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Olivraison result */}
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--card-2)', border: `1px solid ${ramassageResult.oliv?.error ? '#f87171' : '#00d48f44'}` }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Olivraison</div>
                    {ramassageResult.oliv?.error ? (
                      <span style={{ color: '#f87171', fontSize: 13 }}>{ramassageResult.oliv.error}</span>
                    ) : (
                      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: '#4ade80' }}>✓ {ramassageResult.oliv.count} orders requested</span>
                        {ramassageResult.oliv.sticker_url && (
                          <a href={ramassageResult.oliv.sticker_url} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                            ⬇ Download Sticker PDF
                          </a>
                        )}
                        {ramassageResult.oliv.slip_url && (
                          <a href={ramassageResult.oliv.slip_url} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                            ⬇ Download Slip PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Forcelog result */}
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--card-2)', border: `1px solid ${ramassageResult.force?.error ? '#f87171' : '#00d48f44'}` }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Forcelog</div>
                    {ramassageResult.force?.error ? (
                      <span style={{ color: '#f87171', fontSize: 13 }}>{ramassageResult.force.error}</span>
                    ) : (
                      <span style={{ color: '#4ade80', fontSize: 13 }}>✓ {ramassageResult.force.count} orders requested</span>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>
                  Click "Request Pickup" to notify Olivraison and Forcelog to come pick up your packages.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRamassage(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleRamassage} disabled={ramassageLoading}>
                {ramassageLoading ? '⏳ Requesting...' : '📦 Request Pickup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
