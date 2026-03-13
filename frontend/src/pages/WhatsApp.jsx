import { useState, useEffect } from 'react';
import { getProducts, bulkCreateOrders } from '../api';

export default function WhatsApp() {
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [products, setProducts]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', city: '', address: '', variantId: '', quantity: 1,
  });

  useEffect(() => {
    getProducts().then(r => setProducts(r.data)).catch(() => {});
  }, []);

  const variants = products.flatMap(p =>
    p.variants.map(v => ({
      id: v.id,
      label: [p.name, v.size, v.color].filter(Boolean).join(' — '),
      price: v.selling_price || 0,
    }))
  );

  const selected = variants.find(v => v.id === Number(form.variantId));
  const total    = selected ? selected.price * Number(form.quantity) : 0;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const resetForm = () => {
    setForm({ name: '', phone: '', city: '', address: '', variantId: '', quantity: 1 });
    setError('');
    setSuccess(false);
  };

  const closeSheet = () => { setSheetOpen(false); resetForm(); };

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.variantId) return;
    setSubmitting(true);
    setError('');
    try {
      await bulkCreateOrders([{
        caleo_id:         `WA-${Date.now()}`,
        customer_name:    form.name,
        customer_phone:   form.phone,
        customer_address: form.address,
        city:             form.city,
        total_amount:     total,
        order_date:       new Date().toISOString(),
        items:            [{ variant_id: Number(form.variantId), quantity: Number(form.quantity) }],
        expenses:         { sticker: 0, seal_bag: 0, packaging: 0 },
      }]);
      setSuccess(true);
      setTimeout(closeSheet, 1400);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create order. Check stock and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = form.name && form.phone && form.variantId && !submitting && !success;

  return (
    <>
      <style>{`
        .wa-container {
          position: fixed;
          top: 0;
          left: var(--sidebar-w);
          right: 0;
          bottom: 0;
          z-index: 201;
          display: flex;
          flex-direction: column;
          background: #0f1117;
        }
        @media (max-width: 900px) {
          .wa-container {
            left: 0;
            top: var(--topbar-h);
          }
        }
        .wa-sheet-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.65);
          z-index: 400;
          opacity: 0; transition: opacity 0.25s;
          pointer-events: none;
        }
        .wa-sheet-overlay.open {
          opacity: 1; pointer-events: all;
        }
        .wa-sheet {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: #1a1d27;
          border-radius: 18px 18px 0 0;
          border-top: 1px solid #2c2f3e;
          z-index: 401;
          max-height: 88vh;
          overflow-y: auto;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding-bottom: max(20px, env(safe-area-inset-bottom));
        }
        .wa-sheet.open {
          transform: translateY(0);
        }
        .wa-field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: var(--t2);
          margin-bottom: 6px;
        }
        .wa-total {
          padding: 12px 16px;
          border-radius: 10px;
          background: #0f1117;
          border: 1px solid #1fd98a40;
          font-size: 22px;
          font-weight: 800;
          color: #1fd98a;
          letter-spacing: .02em;
        }
      `}</style>

      <div className="wa-container">
        {/* WhatsApp Web iframe */}
        <iframe
          src="https://web.whatsapp.com"
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="WhatsApp Web"
          allow="camera; microphone"
        />

        {/* Bottom action bar */}
        <div style={{
          flexShrink: 0,
          background: '#1a1d27',
          borderTop: '1px solid #222733',
          padding: '10px 16px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}>
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 10, border: 'none',
              background: '#1fd98a', color: '#071a0e',
              fontWeight: 700, fontSize: 15,
              cursor: 'pointer', letterSpacing: '.01em',
            }}
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`wa-sheet-overlay${sheetOpen ? ' open' : ''}`}
        onClick={closeSheet}
      />

      {/* Bottom Sheet */}
      <div className={`wa-sheet${sheetOpen ? ' open' : ''}`}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#2c2f3e' }} />
        </div>

        <div style={{ padding: '6px 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#eef0f8' }}>New Order</div>
            <button
              onClick={closeSheet}
              style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4 }}
            >×</button>
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: 14 }}>
            <label className="wa-field-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="Customer name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label className="wa-field-label">Phone</label>
            <input
              type="tel"
              className="form-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              placeholder="06XXXXXXXX"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>

          {/* City + Address side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="wa-field-label">City</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="Casablanca"
                value={form.city}
                onChange={e => set('city', e.target.value)}
              />
            </div>
            <div>
              <label className="wa-field-label">Address</label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="Street, area…"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>
          </div>

          {/* Product */}
          <div style={{ marginBottom: 14 }}>
            <label className="wa-field-label">Product</label>
            <select
              className="form-input"
              style={{ width: '100%' }}
              value={form.variantId}
              onChange={e => set('variantId', e.target.value)}
            >
              <option value="">Select a product…</option>
              {variants.map(v => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.price} MAD
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: 18 }}>
            <label className="wa-field-label">Quantity</label>
            <input
              type="number"
              min="1"
              className="form-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={form.quantity}
              onChange={e => set('quantity', Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          {/* Total */}
          <div style={{ marginBottom: 22 }}>
            <label className="wa-field-label">Total</label>
            <div className="wa-total">
              {total > 0 ? `${total.toLocaleString()} MAD` : '— MAD'}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 8,
              background: '#f8717122', border: '1px solid #f8717150',
              color: '#f87171', fontSize: 13, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '15px', borderRadius: 10, border: 'none',
              background: success ? '#4ade80' : '#1fd98a',
              color: success ? '#071a0e' : '#071a0e',
              fontWeight: 700, fontSize: 16,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: !canSubmit && !success ? 0.55 : 1,
              transition: 'background 0.2s, opacity 0.2s',
            }}
          >
            {success ? '✓ Order Created!' : submitting ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </div>
    </>
  );
}
