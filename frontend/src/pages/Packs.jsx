import { useState, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import {
  getPacks, getProducts, createPack, updatePack, togglePack, deletePack, addPackPreset, deletePackPreset,
  getOffers, createOffer, updateOffer, toggleOffer, deleteOffer,
  getPromoCodes, createPromoCode, updatePromoCode, togglePromoCode, deletePromoCode,
} from '../api';

const EMPTY_PACK = { name: '', product_id: '', selling_price: '', packaging_cost: '', item_count: '', is_active: true };
const EMPTY_OFFER = { name: '', selling_price: '', packaging_cost: '', start_date: '', end_date: '', is_active: true, items: [{ variant_id: '', quantity: 1 }] };
const EMPTY_PROMO = { code: '', discount_type: 'percentage', discount_value: '', min_order_value: '', usage_limit: '', expiry_date: '', applies_to: 'all', target_ids: [], is_active: true };

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: checked ? '#1fd98a' : '#2d3248',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: 9,
        background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  );
}

function StatusBadge({ active, expired }) {
  if (expired) return <span style={{ background: '#3d1f1f', color: '#f87171', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Expired</span>;
  if (active) return <span style={{ background: '#1a3a2a', color: '#1fd98a', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Active</span>;
  return <span style={{ background: '#222733', color: '#8892b0', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>Inactive</span>;
}

function promoStatus(promo) {
  const now = new Date();
  if (promo.expiry_date && new Date(promo.expiry_date) < now) return 'expired';
  if (promo.usage_limit && promo.used_count >= promo.usage_limit) return 'expired';
  if (!promo.is_active) return 'inactive';
  return 'active';
}

export default function Packs({ readOnly = false }) {
  const [tab, setTab] = useState('packs');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Packs ──
  const [packs, setPacks] = useState([]);
  const [expandedPack, setExpandedPack] = useState(null);
  const [showPackForm, setShowPackForm] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  const [packForm, setPackForm] = useState(EMPTY_PACK);
  const [addingPresetTo, setAddingPresetTo] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [presetItems, setPresetItems] = useState([{ variant_id: '', quantity: 1 }]);

  // ── Offers ──
  const [offers, setOffers] = useState([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);

  // ── Promo Codes ──
  const [promoCodes, setPromoCodes] = useState([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO);
  const [copiedId, setCopiedId] = useState(null);

  const allVariants = products.flatMap(p =>
    p.variants.map(v => ({
      ...v,
      label: `${p.name}${v.size ? ' · ' + v.size : ''}${v.color ? ' · ' + v.color : ''}`,
      productName: p.name,
    }))
  );

  const load = async () => {
    setLoading(true);
    // Load products first — independently so dropdowns always populate
    try {
      const pr = await getProducts();
      setProducts(pr.data);
    } catch (_) {}
    // Load the rest, each failing silently if backend not yet updated
    const [pk, off, promo] = await Promise.all([
      getPacks().catch(() => ({ data: [] })),
      getOffers().catch(() => ({ data: [] })),
      getPromoCodes().catch(() => ({ data: [] })),
    ]);
    setPacks(pk.data);
    setOffers(off.data);
    setPromoCodes(promo.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  // ── Pack handlers ──
  const openCreatePack = () => { setEditingPack(null); setPackForm(EMPTY_PACK); setError(''); setShowPackForm(true); };
  const openEditPack = (e, pack) => {
    e.stopPropagation();
    setEditingPack(pack);
    setPackForm({
      name: pack.name, product_id: pack.product_id || '', selling_price: pack.selling_price,
      packaging_cost: pack.packaging_cost || 0, item_count: pack.item_count, is_active: pack.is_active,
    });
    setError(''); setShowPackForm(true);
  };
  const handleSavePack = async () => {
    if (!packForm.name.trim()) { setError('Pack name is required'); return; }
    if (!packForm.selling_price) { setError('Selling price is required'); return; }
    if (!packForm.item_count) { setError('Number of items is required'); return; }
    const data = {
      name: packForm.name, selling_price: parseFloat(packForm.selling_price),
      packaging_cost: parseFloat(packForm.packaging_cost) || 0,
      item_count: parseInt(packForm.item_count),
      product_id: packForm.product_id ? parseInt(packForm.product_id) : null,
      is_active: packForm.is_active,
    };
    try {
      if (editingPack) await updatePack(editingPack.id, data);
      else await createPack(data);
      setShowPackForm(false); setError(''); load();
      flash(editingPack ? 'Pack updated' : 'Pack created');
    } catch (e) { setError(e.response?.data?.detail || 'Error saving pack'); }
  };
  const handleTogglePack = async (e, id) => {
    e.stopPropagation();
    await togglePack(id); load();
  };
  const handleDeletePack = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this pack and all its presets?')) return;
    await deletePack(id); load();
  };
  const openAddPreset = (e, packId) => {
    e.stopPropagation();
    setAddingPresetTo(packId); setPresetName('');
    setPresetItems([{ variant_id: '', quantity: 1 }]); setError('');
  };
  const handleSavePreset = async () => {
    if (!presetName.trim()) { setError('Preset name is required'); return; }
    const validItems = presetItems.filter(i => i.variant_id);
    if (!validItems.length) { setError('Add at least one product'); return; }
    try {
      await addPackPreset(addingPresetTo, {
        name: presetName,
        items: validItems.map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 })),
      });
      setAddingPresetTo(null); setError(''); load();
    } catch (e) { setError(e.response?.data?.detail || 'Error saving preset'); }
  };
  const handleDeletePreset = async (e, presetId) => {
    e.stopPropagation();
    if (!confirm('Delete this preset?')) return;
    await deletePackPreset(presetId); load();
  };

  // ── Offer handlers ──
  const openCreateOffer = () => { setEditingOffer(null); setOfferForm(EMPTY_OFFER); setError(''); setShowOfferForm(true); };
  const openEditOffer = (offer) => {
    setEditingOffer(offer);
    setOfferForm({
      name: offer.name, selling_price: offer.selling_price, packaging_cost: offer.packaging_cost,
      start_date: offer.start_date || '', end_date: offer.end_date || '',
      is_active: offer.is_active,
      items: offer.items.length ? offer.items.map(i => ({ variant_id: String(i.variant_id), quantity: i.quantity })) : [{ variant_id: '', quantity: 1 }],
    });
    setError(''); setShowOfferForm(true);
  };
  const setOfferItem = (idx, field, val) => {
    const items = [...offerForm.items];
    items[idx] = { ...items[idx], [field]: val };
    setOfferForm({ ...offerForm, items });
  };
  const handleSaveOffer = async () => {
    if (!offerForm.name.trim()) { setError('Offer name is required'); return; }
    if (!offerForm.selling_price) { setError('Selling price is required'); return; }
    const validItems = offerForm.items.filter(i => i.variant_id);
    if (!validItems.length) { setError('Add at least one product'); return; }
    const data = {
      name: offerForm.name, selling_price: parseFloat(offerForm.selling_price),
      packaging_cost: parseFloat(offerForm.packaging_cost) || 0,
      start_date: offerForm.start_date || null, end_date: offerForm.end_date || null,
      is_active: offerForm.is_active,
      items: validItems.map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 })),
    };
    try {
      if (editingOffer) await updateOffer(editingOffer.id, data);
      else await createOffer(data);
      setShowOfferForm(false); setError(''); load();
      flash(editingOffer ? 'Offer updated' : 'Offer created');
    } catch (e) { setError(e.response?.data?.detail || 'Error saving offer'); }
  };
  const handleToggleOffer = async (id) => { await toggleOffer(id); load(); };
  const handleDeleteOffer = async (id) => {
    if (!confirm('Delete this offer?')) return;
    await deleteOffer(id); load();
  };

  // ── Promo handlers ──
  const genCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };
  const openCreatePromo = () => { setEditingPromo(null); setPromoForm(EMPTY_PROMO); setError(''); setShowPromoForm(true); };
  const openEditPromo = (promo) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code, discount_type: promo.discount_type, discount_value: promo.discount_value,
      min_order_value: promo.min_order_value || '', usage_limit: promo.usage_limit || '',
      expiry_date: promo.expiry_date || '', applies_to: promo.applies_to,
      target_ids: promo.target_ids || [], is_active: promo.is_active,
    });
    setError(''); setShowPromoForm(true);
  };
  const handleSavePromo = async () => {
    if (!promoForm.code.trim()) { setError('Code is required'); return; }
    if (!promoForm.discount_value) { setError('Discount value is required'); return; }
    const data = {
      code: promoForm.code.toUpperCase().trim(),
      discount_type: promoForm.discount_type,
      discount_value: parseFloat(promoForm.discount_value),
      min_order_value: promoForm.min_order_value ? parseFloat(promoForm.min_order_value) : null,
      usage_limit: promoForm.usage_limit ? parseInt(promoForm.usage_limit) : null,
      expiry_date: promoForm.expiry_date || null,
      applies_to: promoForm.applies_to,
      target_ids: promoForm.target_ids,
      is_active: promoForm.is_active,
    };
    try {
      if (editingPromo) await updatePromoCode(editingPromo.id, data);
      else await createPromoCode(data);
      setShowPromoForm(false); setError(''); load();
      flash(editingPromo ? 'Promo code updated' : 'Promo code created');
    } catch (e) { setError(e.response?.data?.detail || 'Error saving promo code'); }
  };
  const handleTogglePromo = async (id) => { await togglePromoCode(id); load(); };
  const handleDeletePromo = async (id) => {
    if (!confirm('Delete this promo code?')) return;
    await deletePromoCode(id); load();
  };
  const copyCode = (id, code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  const tabStyle = (active) => ({
    padding: '9px 22px', border: 'none', borderBottom: active ? '2px solid #1fd98a' : '2px solid transparent',
    background: 'none', color: active ? '#1fd98a' : '#8892b0', cursor: 'pointer',
    fontWeight: active ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
  });

  const onNew = () => {
    if (tab === 'packs') openCreatePack();
    else if (tab === 'offers') openCreateOffer();
    else openCreatePromo();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Packs & Promos</h1>
        {!readOnly && (
          <button className="btn btn-primary" onClick={onNew}>
            {tab === 'packs' ? '+ New Pack' : tab === 'offers' ? '+ New Offer' : '+ New Promo Code'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222733', marginBottom: 24 }}>
        <button style={tabStyle(tab === 'packs')} onClick={() => setTab('packs')}>📦 Packs</button>
        <button style={tabStyle(tab === 'offers')} onClick={() => setTab('offers')}>🎁 Offers</button>
        <button style={tabStyle(tab === 'promo')} onClick={() => setTab('promo')}>🏷️ Promo Codes</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* ── PACKS TAB ── */}
      {tab === 'packs' && (
        <>
          {packs.length === 0 ? (
            <div className="empty-state">
              <h3>No packs yet</h3>
              <p>Create a pack to group items together with a custom price and packaging</p>
            </div>
          ) : (
            packs.map(pack => (
              <div
                key={pack.id}
                className="card"
                style={{ marginBottom: 12, cursor: 'pointer', opacity: pack.is_active ? 1 : 0.7 }}
                onClick={() => setExpandedPack(expandedPack === pack.id ? null : pack.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#8892b0', fontSize: 12 }}>
                      {expandedPack === pack.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📦 {pack.name}
                        <StatusBadge active={pack.is_active} />
                      </div>
                      <div style={{ color: '#8892b0', fontSize: 12, marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {pack.product_name && <span style={{ color: '#a5b4fc' }}>{pack.product_name}</span>}
                        <span>{pack.item_count} item{pack.item_count !== 1 ? 's' : ''}</span>
                        <span style={{ color: '#1fd98a' }}>{pack.selling_price} MAD</span>
                        {pack.packaging_cost > 0 && <span>Box: {pack.packaging_cost} MAD</span>}
                        <span>{pack.presets.length} preset{pack.presets.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={e => handleTogglePack(e, pack.id)}>
                        {pack.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={e => openEditPack(e, pack)}>Edit</button>
                      <button className="btn btn-secondary btn-sm" onClick={e => openAddPreset(e, pack.id)}>+ Preset</button>
                      <button className="btn btn-danger btn-sm" onClick={e => handleDeletePack(e, pack.id)}>Delete</button>
                    </div>
                  )}
                </div>

                {expandedPack === pack.id && (
                  <div style={{ marginTop: 16 }} onClick={e => e.stopPropagation()}>
                    {pack.presets.length === 0 ? (
                      <div style={{ color: '#8892b0', fontSize: 13, padding: '8px 0' }}>
                        No presets yet — click "+ Preset" to add a saved composition.
                      </div>
                    ) : (
                      pack.presets.map(preset => (
                        <div key={preset.id} style={{ border: '1px solid #2d3248', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 500 }}>{preset.name}</div>
                            {!readOnly && <button className="btn btn-danger btn-sm" onClick={e => handleDeletePreset(e, preset.id)}>✕</button>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {preset.items.map(item => (
                              <span key={item.id} style={{ background: '#1e2235', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#a5b4fc' }}>
                                {item.label} × {item.quantity}
                                <span style={{ color: '#8892b0', marginLeft: 6 }}>(stock: {item.stock})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* ── OFFERS TAB ── */}
      {tab === 'offers' && (
        <>
          {offers.length === 0 ? (
            <div className="empty-state">
              <h3>No offers yet</h3>
              <p>Create bundle offers that combine multiple products at a special price</p>
            </div>
          ) : (
            offers.map(offer => (
              <div key={offer.id} className="card" style={{ marginBottom: 12, opacity: offer.is_active ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      🎁 {offer.name}
                      <StatusBadge active={offer.is_active} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {offer.items.map(item => (
                        <span key={item.id} style={{ background: '#1e2235', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#a5b4fc' }}>
                          {item.label} × {item.quantity}
                        </span>
                      ))}
                    </div>
                    <div style={{ color: '#8892b0', fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ color: '#1fd98a' }}>{offer.selling_price} MAD</span>
                      {offer.packaging_cost > 0 && <span>Box: {offer.packaging_cost} MAD</span>}
                      {(offer.start_date || offer.end_date) && (
                        <span>
                          {offer.start_date ? offer.start_date : '…'} → {offer.end_date ? offer.end_date : '∞'}
                        </span>
                      )}
                    </div>
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggleOffer(offer.id)}>
                        {offer.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditOffer(offer)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOffer(offer.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── PROMO CODES TAB ── */}
      {tab === 'promo' && (
        <>
          {promoCodes.length === 0 ? (
            <div className="empty-state">
              <h3>No promo codes yet</h3>
              <p>Create discount codes to share with customers</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222733' }}>
                    {['Code', 'Discount', 'Usage', 'Expiry', 'Applies to', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#8892b0', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map(promo => {
                    const status = promoStatus(promo);
                    return (
                      <tr key={promo.id} style={{ borderBottom: '1px solid #1a1d27', opacity: status === 'inactive' ? 0.6 : 1 }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#eef0f8', fontSize: 14 }}>{promo.code}</span>
                            <button
                              className="btn-icon"
                              style={{ padding: 4 }}
                              onClick={() => copyCode(promo.id, promo.code)}
                              title="Copy code"
                            >
                              {copiedId === promo.id ? <Check size={14} color="#1fd98a" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1fd98a', fontWeight: 600 }}>
                          {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value} MAD`}
                          {promo.min_order_value && <div style={{ color: '#8892b0', fontSize: 11, fontWeight: 400 }}>Min {promo.min_order_value} MAD</div>}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#8892b0', fontSize: 13 }}>
                          {promo.used_count} used{promo.usage_limit ? ` / ${promo.usage_limit}` : ''}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#8892b0', fontSize: 13 }}>
                          {promo.expiry_date || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#8892b0', fontSize: 13 }}>
                          {promo.applies_to === 'all' ? 'All products' : promo.applies_to === 'products' ? 'Specific products' : 'Specific packs'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge active={status === 'active'} expired={status === 'expired'} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {!readOnly && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleTogglePromo(promo.id)}>
                                {promo.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditPromo(promo)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeletePromo(promo.id)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── PACK FORM MODAL ── */}
      {showPackForm && (
        <div className="modal-overlay" onClick={() => setShowPackForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPack ? 'Edit Pack' : 'New Pack'}</h2>
              <button className="btn-icon" onClick={() => setShowPackForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Pack Name</label>
                <input className="form-input" placeholder="e.g. Pack 3 Caps" value={packForm.name} onChange={e => setPackForm({ ...packForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Product (optional)</label>
                <select className="form-input" value={packForm.product_id} onChange={e => setPackForm({ ...packForm, product_id: e.target.value })}>
                  <option value="">— No specific product —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Selling Price (MAD)</label>
                  <input className="form-input" type="number" min="0" placeholder="e.g. 250" value={packForm.selling_price} onChange={e => setPackForm({ ...packForm, selling_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Items</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 3" value={packForm.item_count} onChange={e => setPackForm({ ...packForm, item_count: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Packaging Cost (MAD)</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 5" value={packForm.packaging_cost} onChange={e => setPackForm({ ...packForm, packaging_cost: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <Toggle checked={packForm.is_active} onChange={v => setPackForm({ ...packForm, is_active: v })} />
                <span style={{ fontSize: 14, color: '#eef0f8' }}>{packForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPackForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePack}>{editingPack ? 'Save Changes' : 'Create Pack'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRESET MODAL ── */}
      {addingPresetTo && (
        <div className="modal-overlay" onClick={() => setAddingPresetTo(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Preset Composition</h2>
              <button className="btn-icon" onClick={() => setAddingPresetTo(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Preset Name</label>
                <input className="form-input" placeholder="e.g. 3 Black NY" value={presetName} onChange={e => setPresetName(e.target.value)} />
              </div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Products</label>
              {presetItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <select
                    className="form-input" style={{ flex: 1 }}
                    value={item.variant_id}
                    onChange={e => { const u = [...presetItems]; u[i] = { ...u[i], variant_id: e.target.value }; setPresetItems(u); }}
                  >
                    <option value="">— Select variant —</option>
                    {products.map(p => p.variants.length > 0 && (
                      <optgroup key={p.id} label={p.name}>
                        {p.variants.map(v => {
                          const detail = [v.size, v.color].filter(Boolean).join(' · ') || 'Default';
                          return <option key={v.id} value={v.id}>{detail} — stock: {v.stock}</option>;
                        })}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    className="form-input" type="number" min="1" style={{ width: 70 }}
                    value={item.quantity}
                    onChange={e => { const u = [...presetItems]; u[i] = { ...u[i], quantity: parseInt(e.target.value) || 1 }; setPresetItems(u); }}
                  />
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    const u = presetItems.filter((_, idx) => idx !== i);
                    setPresetItems(u.length ? u : [{ variant_id: '', quantity: 1 }]);
                  }}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => setPresetItems([...presetItems, { variant_id: '', quantity: 1 }])}>+ Add Product</button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddingPresetTo(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePreset}>Save Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OFFER FORM MODAL ── */}
      {showOfferForm && (
        <div className="modal-overlay" onClick={() => setShowOfferForm(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingOffer ? 'Edit Offer' : 'New Offer'}</h2>
              <button className="btn-icon" onClick={() => setShowOfferForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Offer Name</label>
                <input className="form-input" placeholder="e.g. Ramadan Bundle" value={offerForm.name} onChange={e => setOfferForm({ ...offerForm, name: e.target.value })} />
              </div>

              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Products</label>
              {offerForm.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <select
                    className="form-input" style={{ flex: 1 }}
                    value={item.variant_id}
                    onChange={e => setOfferItem(i, 'variant_id', e.target.value)}
                  >
                    <option value="">— Select variant —</option>
                    {products.map(p => p.variants.length > 0 && (
                      <optgroup key={p.id} label={p.name}>
                        {p.variants.map(v => {
                          const detail = [v.size, v.color].filter(Boolean).join(' · ') || 'Default';
                          return <option key={v.id} value={v.id}>{detail} — stock: {v.stock}</option>;
                        })}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    className="form-input" type="number" min="1" style={{ width: 70 }}
                    value={item.quantity}
                    onChange={e => setOfferItem(i, 'quantity', parseInt(e.target.value) || 1)}
                  />
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    const u = offerForm.items.filter((_, idx) => idx !== i);
                    setOfferForm({ ...offerForm, items: u.length ? u : [{ variant_id: '', quantity: 1 }] });
                  }}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => setOfferForm({ ...offerForm, items: [...offerForm.items, { variant_id: '', quantity: 1 }] })}>+ Add Product</button>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Selling Price (MAD)</label>
                  <input className="form-input" type="number" min="0" placeholder="e.g. 350" value={offerForm.selling_price} onChange={e => setOfferForm({ ...offerForm, selling_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Packaging Cost (MAD)</label>
                  <input className="form-input" type="number" min="0" placeholder="e.g. 8" value={offerForm.packaging_cost} onChange={e => setOfferForm({ ...offerForm, packaging_cost: e.target.value })} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date (optional)</label>
                  <input className="form-input" type="date" value={offerForm.start_date} onChange={e => setOfferForm({ ...offerForm, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date (optional)</label>
                  <input className="form-input" type="date" value={offerForm.end_date} onChange={e => setOfferForm({ ...offerForm, end_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <Toggle checked={offerForm.is_active} onChange={v => setOfferForm({ ...offerForm, is_active: v })} />
                <span style={{ fontSize: 14, color: '#eef0f8' }}>{offerForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowOfferForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveOffer}>{editingOffer ? 'Save Changes' : 'Create Offer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMO CODE FORM MODAL ── */}
      {showPromoForm && (
        <div className="modal-overlay" onClick={() => setShowPromoForm(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPromo ? 'Edit Promo Code' : 'New Promo Code'}</h2>
              <button className="btn-icon" onClick={() => setShowPromoForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {/* Code + auto-generate */}
              <div className="form-group">
                <label className="form-label">Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}
                    placeholder="e.g. SUMMER20"
                    value={promoForm.code}
                    onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  />
                  <button className="btn btn-secondary" onClick={() => setPromoForm({ ...promoForm, code: genCode() })} title="Auto-generate">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Discount type toggle */}
              <div className="form-group">
                <label className="form-label">Discount Type</label>
                <div style={{ display: 'flex', background: '#0f1117', borderRadius: 8, padding: 4, gap: 4, border: '1px solid #222733' }}>
                  {[{ key: 'percentage', label: '% Percentage' }, { key: 'fixed', label: '＄ Fixed (MAD)' }].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPromoForm({ ...promoForm, discount_type: opt.key })}
                      style={{
                        flex: 1, padding: '7px 0', border: 'none', borderRadius: 6,
                        background: promoForm.discount_type === opt.key ? '#1a1d27' : 'none',
                        color: promoForm.discount_type === opt.key ? '#1fd98a' : '#8892b0',
                        fontWeight: promoForm.discount_type === opt.key ? 600 : 400,
                        cursor: 'pointer', fontSize: 13,
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Discount Value {promoForm.discount_type === 'percentage' ? '(%)' : '(MAD)'}
                  </label>
                  <input className="form-input" type="number" min="0" placeholder={promoForm.discount_type === 'percentage' ? '20' : '50'} value={promoForm.discount_value} onChange={e => setPromoForm({ ...promoForm, discount_value: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Minimum Order (MAD, optional)</label>
                  <input className="form-input" type="number" min="0" placeholder="e.g. 200" value={promoForm.min_order_value} onChange={e => setPromoForm({ ...promoForm, min_order_value: e.target.value })} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Usage Limit (optional, blank = unlimited)</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 100" value={promoForm.usage_limit} onChange={e => setPromoForm({ ...promoForm, usage_limit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date (optional)</label>
                  <input className="form-input" type="date" value={promoForm.expiry_date} onChange={e => setPromoForm({ ...promoForm, expiry_date: e.target.value })} />
                </div>
              </div>

              {/* Applies to */}
              <div className="form-group">
                <label className="form-label">Applies To</label>
                <select className="form-input" value={promoForm.applies_to} onChange={e => setPromoForm({ ...promoForm, applies_to: e.target.value, target_ids: [] })}>
                  <option value="all">All products</option>
                  <option value="products">Specific products</option>
                  <option value="packs">Specific packs</option>
                </select>
              </div>

              {promoForm.applies_to === 'products' && (
                <div className="form-group">
                  <label className="form-label">Select Products</label>
                  <div style={{ border: '1px solid #222733', borderRadius: 8, maxHeight: 180, overflowY: 'auto', padding: 8 }}>
                    {products.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={promoForm.target_ids.includes(p.id)}
                          onChange={e => {
                            const ids = e.target.checked
                              ? [...promoForm.target_ids, p.id]
                              : promoForm.target_ids.filter(id => id !== p.id);
                            setPromoForm({ ...promoForm, target_ids: ids });
                          }}
                        />
                        <span style={{ fontSize: 14 }}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {promoForm.applies_to === 'packs' && (
                <div className="form-group">
                  <label className="form-label">Select Packs</label>
                  <div style={{ border: '1px solid #222733', borderRadius: 8, maxHeight: 180, overflowY: 'auto', padding: 8 }}>
                    {packs.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={promoForm.target_ids.includes(p.id)}
                          onChange={e => {
                            const ids = e.target.checked
                              ? [...promoForm.target_ids, p.id]
                              : promoForm.target_ids.filter(id => id !== p.id);
                            setPromoForm({ ...promoForm, target_ids: ids });
                          }}
                        />
                        <span style={{ fontSize: 14 }}>📦 {p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <Toggle checked={promoForm.is_active} onChange={v => setPromoForm({ ...promoForm, is_active: v })} />
                <span style={{ fontSize: 14, color: '#eef0f8' }}>{promoForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPromoForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePromo}>{editingPromo ? 'Save Changes' : 'Create Code'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
