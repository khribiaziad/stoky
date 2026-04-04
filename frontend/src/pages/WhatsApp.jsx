import { useState, useEffect, useRef } from 'react';
import { getProducts, bulkCreateOrders } from '../api';

export default function WhatsApp() {
  const [products, setProducts]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', city: '', address: '', variantId: '', quantity: 1,
  });
  const nameRef = useRef(null);

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
    setTimeout(() => nameRef.current?.focus(), 50);
  };

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
        expenses:         { packaging: 0 },
      }]);
      setSuccess(true);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create order. Check stock and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = form.name && form.phone && form.variantId && !submitting && !success;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>WhatsApp Orders</h1>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>Create an order from a WhatsApp conversation</div>
        </div>
        <a
          href="https://web.whatsapp.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10,
            background: '#1fd98a22', border: '1px solid #1fd98a55',
            color: '#1fd98a', fontWeight: 600, fontSize: 13,
            textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Open WhatsApp ↗
        </a>
      </div>

      {/* Success state */}
      {success ? (
        <div style={{
          background: '#1fd98a18', border: '1px solid #1fd98a55',
          borderRadius: 14, padding: '36px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1fd98a', marginBottom: 6 }}>Order Created!</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>
            {form.name} — {total.toLocaleString()} MAD
          </div>
          <button
            onClick={resetForm}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: '#1fd98a', color: '#071a0e',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            + New Order
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>

          {/* Row 1: Name + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Full Name *</label>
              <input
                ref={nameRef}
                type="text"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="Customer name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Phone *</label>
              <input
                type="tel"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="06XXXXXXXX"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: City + Address */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>City</label>
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
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Address</label>
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
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Product *</label>
            <select
              className="form-input"
              style={{ width: '100%' }}
              value={form.variantId}
              onChange={e => set('variantId', e.target.value)}
            >
              <option value="">Select a product…</option>
              {variants.map(v => (
                <option key={v.id} value={v.id}>{v.label} — {v.price} MAD</option>
              ))}
            </select>
          </div>

          {/* Quantity + Total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Quantity</label>
              <input
                type="number"
                min="1"
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.quantity}
                onChange={e => set('quantity', Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>Total</label>
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg)', border: '1px solid #1fd98a40',
                fontSize: 18, fontWeight: 800, color: '#1fd98a',
                height: 42, boxSizing: 'border-box', display: 'flex', alignItems: 'center',
              }}>
                {total > 0 ? `${total.toLocaleString()} MAD` : '— MAD'}
              </div>
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
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: '#1fd98a', color: '#071a0e',
              fontWeight: 700, fontSize: 16,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: !canSubmit ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {submitting ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      )}
    </div>
  );
}
