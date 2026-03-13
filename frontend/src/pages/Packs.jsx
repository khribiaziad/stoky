import { useState, useEffect } from 'react';
import { getPacks, getProducts, createPack, updatePack, deletePack, addPackPreset, deletePackPreset, errorMessage } from '../api';

export default function Packs({ readOnly = false }) {
  const [packs, setPacks] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPack, setExpandedPack] = useState(null);
  const [error, setError] = useState('');

  // Add/Edit pack modal
  const [showPackForm, setShowPackForm] = useState(false);
  const [editingPack, setEditingPack] = useState(null); // null = create, object = edit
  const [packForm, setPackForm] = useState({ name: '', selling_price: '', item_count: '' });

  // Add preset modal
  const [addingPresetTo, setAddingPresetTo] = useState(null); // pack id
  const [presetName, setPresetName] = useState('');
  const [presetItems, setPresetItems] = useState([{ variant_id: '', quantity: 1 }]);

  const allVariants = products.flatMap(p =>
    p.variants.map(v => ({
      ...v,
      label: `${p.name}${v.size ? ' · ' + v.size : ''}${v.color ? ' · ' + v.color : ''}`,
    }))
  );

  const load = () => {
    Promise.all([getPacks(), getProducts()])
      .then(([pk, pr]) => { setPacks(pk.data); setProducts(pr.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreatePack = () => {
    setEditingPack(null);
    setPackForm({ name: '', selling_price: '', item_count: '' });
    setError('');
    setShowPackForm(true);
  };

  const openEditPack = (e, pack) => {
    e.stopPropagation();
    setEditingPack(pack);
    setPackForm({ name: pack.name, selling_price: pack.selling_price, item_count: pack.item_count });
    setError('');
    setShowPackForm(true);
  };

  const handleSavePack = async () => {
    if (!packForm.name.trim()) { setError('Name is required'); return; }
    if (!packForm.selling_price) { setError('Selling price is required'); return; }
    if (!packForm.item_count) { setError('Item count is required'); return; }
    const data = {
      name: packForm.name,
      selling_price: parseFloat(packForm.selling_price),
      item_count: parseInt(packForm.item_count),
    };
    try {
      if (editingPack) {
        await updatePack(editingPack.id, data);
      } else {
        await createPack(data);
      }
      setShowPackForm(false);
      setError('');
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleDeletePack = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this pack and all its presets?')) return;
    await deletePack(id);
    load();
  };

  const openAddPreset = (e, packId) => {
    e.stopPropagation();
    setAddingPresetTo(packId);
    setPresetName('');
    setPresetItems([{ variant_id: '', quantity: 1 }]);
    setError('');
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) { setError('Preset name is required'); return; }
    const validItems = presetItems.filter(i => i.variant_id);
    if (validItems.length === 0) { setError('Add at least one product'); return; }
    try {
      await addPackPreset(addingPresetTo, {
        name: presetName,
        items: validItems.map(i => ({ variant_id: parseInt(i.variant_id), quantity: parseInt(i.quantity) || 1 })),
      });
      setAddingPresetTo(null);
      setError('');
      load();
    } catch (e) { setError(errorMessage(e)); }
  };

  const handleDeletePreset = async (e, presetId) => {
    e.stopPropagation();
    if (!confirm('Delete this preset?')) return;
    await deletePackPreset(presetId);
    load();
  };

  if (loading) return <div className="loading">Loading packs...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Packs</h1>
        {!readOnly && <button className="btn btn-primary" onClick={openCreatePack}>+ New Pack</button>}
      </div>

      {packs.length === 0 ? (
        <div className="empty-state">
          <h3>No packs yet</h3>
          <p>Create a pack to group products together with a single price</p>
        </div>
      ) : (
        packs.map(pack => (
          <div
            key={pack.id}
            className="card"
            style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => setExpandedPack(expandedPack === pack.id ? null : pack.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--t2)', fontSize: 12 }}>
                  {expandedPack === pack.id ? '▼' : '▶'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>📦 {pack.name}</div>
                  <div style={{ color: 'var(--t2)', fontSize: 12, marginTop: 2 }}>
                    {pack.item_count} item{pack.item_count !== 1 ? 's' : ''} ·{' '}
                    <span style={{ color: '#60a5fa' }}>{pack.selling_price} MAD</span> ·{' '}
                    {pack.presets.length} preset{pack.presets.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={e => openEditPack(e, pack)}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={e => openAddPreset(e, pack.id)}>+ Preset</button>
                  <button className="btn btn-danger btn-sm" onClick={e => handleDeletePack(e, pack.id)}>Delete</button>
                </div>
              )}
            </div>

            {expandedPack === pack.id && (
              <div style={{ marginTop: 16 }} onClick={e => e.stopPropagation()}>
                {pack.presets.length === 0 ? (
                  <div style={{ color: 'var(--t2)', fontSize: 13, padding: '8px 0' }}>
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
                            <span style={{ color: 'var(--t2)', marginLeft: 6 }}>(stock: {item.stock})</span>
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

      {/* Create/Edit Pack Modal */}
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
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Selling Price (MAD)</label>
                  <input className="form-input" type="number" placeholder="e.g. 250" value={packForm.selling_price} onChange={e => setPackForm({ ...packForm, selling_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Items in Pack</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 3" value={packForm.item_count} onChange={e => setPackForm({ ...packForm, item_count: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPackForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePack}>{editingPack ? 'Save Changes' : 'Create Pack'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Preset Modal */}
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
                    className="form-input"
                    style={{ flex: 1 }}
                    value={item.variant_id}
                    onChange={e => {
                      const updated = [...presetItems];
                      updated[i] = { ...updated[i], variant_id: e.target.value };
                      setPresetItems(updated);
                    }}
                  >
                    <option value="">— Select product —</option>
                    {allVariants.map(v => (
                      <option key={v.id} value={v.id}>{v.label} (stock: {v.stock})</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="number" min="1"
                    style={{ width: 70 }}
                    value={item.quantity}
                    onChange={e => {
                      const updated = [...presetItems];
                      updated[i] = { ...updated[i], quantity: parseInt(e.target.value) || 1 };
                      setPresetItems(updated);
                    }}
                  />
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    const updated = presetItems.filter((_, idx) => idx !== i);
                    setPresetItems(updated.length ? updated : [{ variant_id: '', quantity: 1 }]);
                  }}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => setPresetItems([...presetItems, { variant_id: '', quantity: 1 }])}>
                + Add Product
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddingPresetTo(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePreset}>Save Preset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
