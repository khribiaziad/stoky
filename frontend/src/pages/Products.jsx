import { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, addVariant, updateVariant, deleteVariant } from '../api';

export default function Products({ readOnly = false }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddVariant, setShowAddVariant] = useState(null);
  const [editingVariant, setEditingVariant] = useState(null); // { variant, product }
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [search, setSearch] = useState('');

  const [newProduct, setNewProduct] = useState({ name: '', category: 'caps', has_sizes: true, has_colors: true, under_1kg: false });
  const [newVariant, setNewVariant] = useState({ size: '', color: '', buying_price: '', selling_price: '', stock: 0, low_stock_threshold: 5 });
  const [editForm, setEditForm] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    getProducts().then(r => setProducts(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) { setError('Product name is required'); return; }
    try {
      await createProduct({ ...newProduct, is_pack: false });
      setShowAddProduct(false);
      setNewProduct({ name: '', category: 'caps', has_sizes: true, has_colors: true, under_1kg: false });
      setError('');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error creating product'); }
  };

  const handleAddVariant = async () => {
    if (!newVariant.buying_price) { setError('Buying price is required'); return; }
    try {
      await addVariant(showAddVariant, {
        ...newVariant,
        buying_price: parseFloat(newVariant.buying_price),
        selling_price: parseFloat(newVariant.selling_price) || null,
      });
      setShowAddVariant(null);
      setNewVariant({ size: '', color: '', buying_price: '', selling_price: '', stock: 0, low_stock_threshold: 5 });
      setError('');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error adding variant'); }
  };

  const openEditVariant = (variant, product) => {
    setEditForm({
      size: variant.size || '',
      color: variant.color || '',
      buying_price: variant.buying_price,
      selling_price: variant.selling_price || '',
      low_stock_threshold: variant.low_stock_threshold,
    });
    setEditingVariant({ variant, product });
    setError('');
  };

  const handleEditVariant = async () => {
    if (!editForm.buying_price) { setError('Buying price is required'); return; }
    try {
      await updateVariant(editingVariant.variant.id, {
        ...editForm,
        buying_price: parseFloat(editForm.buying_price),
        selling_price: parseFloat(editForm.selling_price) || null,
        low_stock_threshold: parseInt(editForm.low_stock_threshold) || 5,
      });
      setEditingVariant(null);
      setError('');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error updating variant'); }
  };

  const openEditProduct = (e, product) => {
    e.stopPropagation();
    setEditingProduct({ ...product });
    setError('');
  };

  const handleEditProduct = async () => {
    if (!editingProduct.name.trim()) { setError('Product name is required'); return; }
    try {
      await updateProduct(editingProduct.id, {
        name: editingProduct.name,
        category: editingProduct.category,
        has_sizes: editingProduct.has_sizes,
        has_colors: editingProduct.has_colors,
        under_1kg: editingProduct.under_1kg,
        variants: [],
      });
      setEditingProduct(null);
      setError('');
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error updating product'); }
  };

  const handleDeleteProduct = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this product and all its variants?')) return;
    await deleteProduct(id);
    load();
  };

  const handleDeleteVariant = async (id) => {
    if (!confirm('Delete this variant?')) return;
    await deleteVariant(id);
    load();
  };

  const toggleExpand = (productId) => {
    setExpandedProduct(expandedProduct === productId ? null : productId);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="search-bar">
            <span>🔍</span>
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {!readOnly && <button className="btn btn-primary" onClick={() => setShowAddProduct(true)}>+ Add Product</button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No products yet</h3>
          <p>Add your first product to get started</p>
        </div>
      ) : (
        filtered.map(product => (
          <div
            key={product.id}
            className="card"
            style={{ marginBottom: 12, cursor: 'pointer' }}
            onClick={() => toggleExpand(product.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expandedProduct === product.id ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#8892b0', fontSize: 12 }}>
                  {expandedProduct === product.id ? '▼' : '▶'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{product.name}</div>
                  <div style={{ color: '#8892b0', fontSize: 12, marginTop: 2 }}>
                    {product.category} ·{' '}
                    {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''} ·{' '}
                    <span style={{ color: '#4ade80' }}>
                      {product.variants.reduce((s, v) => s + v.stock, 0)} available
                    </span>
                    {product.variants.some(v => v.stock <= v.low_stock_threshold && v.stock > 0) && (
                      <span style={{ color: '#fbbf24', marginLeft: 8 }}>⚠ Low stock</span>
                    )}
                    {product.variants.some(v => v.stock === 0) && (
                      <span style={{ color: '#f87171', marginLeft: 8 }}>● Out of stock</span>
                    )}
                  </div>
                </div>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={e => openEditProduct(e, product)}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setShowAddVariant(product.id); }}>+ Variant</button>
                  <button className="btn btn-danger btn-sm" onClick={e => handleDeleteProduct(e, product.id)}>Delete</button>
                </div>
              )}
            </div>

            {expandedProduct === product.id && (
              <div className="table-wrapper" onClick={e => e.stopPropagation()}>
                <table>
                  <thead>
                    <tr>
                      {product.has_sizes && <th>Size</th>}
                      {product.has_colors && <th>Color</th>}
                      <th>Buy Price</th>
                      <th>Sell Price</th>
                      <th>Stock</th>
                      <th>Broken</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map(v => (
                      <tr key={v.id}>
                        {product.has_sizes && <td>{v.size || '—'}</td>}
                        {product.has_colors && <td>{v.color || '—'}</td>}
                        <td>{v.buying_price} MAD</td>
                        <td>{v.selling_price ? `${v.selling_price} MAD` : '—'}</td>
                        <td style={{ fontWeight: 600, color: v.stock === 0 ? '#f87171' : v.stock <= v.low_stock_threshold ? '#fbbf24' : '#4ade80' }}>
                          {v.stock}
                        </td>
                        <td style={{ color: v.broken_stock > 0 ? '#f87171' : '#8892b0' }}>
                          {v.broken_stock > 0 ? `${v.broken_stock} (${v.returnable_broken} ret.)` : '0'}
                        </td>
                        <td>
                          {v.stock === 0
                            ? <span className="badge badge-red">Out of Stock</span>
                            : v.stock <= v.low_stock_threshold
                              ? <span className="badge badge-yellow">Low Stock</span>
                              : <span className="badge badge-green">OK</span>
                          }
                        </td>
                        {!readOnly && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); openEditVariant(v, product); }}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteVariant(v.id); }}>✕</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Product</h2>
              <button className="btn-icon" onClick={() => setEditingProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input className="form-input" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editingProduct.has_sizes} onChange={e => setEditingProduct({...editingProduct, has_sizes: e.target.checked})} />
                  Has Sizes
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editingProduct.has_colors} onChange={e => setEditingProduct({...editingProduct, has_colors: e.target.checked})} />
                  Has Colors
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={editingProduct.under_1kg || false} onChange={e => setEditingProduct({...editingProduct, under_1kg: e.target.checked})} />
                  Under 1 KG <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>(sell bag required)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditProduct}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="modal-overlay" onClick={() => setShowAddProduct(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Product</h2>
              <button className="btn-icon" onClick={() => setShowAddProduct(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input className="form-input" placeholder="e.g. NY Cap" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={newProduct.has_sizes} onChange={e => setNewProduct({...newProduct, has_sizes: e.target.checked})} />
                  Has Sizes
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={newProduct.has_colors} onChange={e => setNewProduct({...newProduct, has_colors: e.target.checked})} />
                  Has Colors
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={newProduct.under_1kg} onChange={e => setNewProduct({...newProduct, under_1kg: e.target.checked})} />
                  Under 1 KG <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>(sell bag required)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddProduct(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateProduct}>Create Product</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      {showAddVariant && (() => {
        const product = products.find(p => p.id === showAddVariant);
        return (
          <div className="modal-overlay" onClick={() => setShowAddVariant(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Variant — {product?.name}</h2>
                <button className="btn-icon" onClick={() => setShowAddVariant(null)}>✕</button>
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-grid-2">
                  {product?.has_sizes && (
                    <div className="form-group">
                      <label className="form-label">Size</label>
                      <input className="form-input" placeholder="e.g. M, L, XL" value={newVariant.size} onChange={e => setNewVariant({...newVariant, size: e.target.value})} />
                    </div>
                  )}
                  {product?.has_colors && (
                    <div className="form-group">
                      <label className="form-label">Color</label>
                      <input className="form-input" placeholder="e.g. Black, White" value={newVariant.color} onChange={e => setNewVariant({...newVariant, color: e.target.value})} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Buying Price (MAD) *</label>
                    <input className="form-input" type="number" value={newVariant.buying_price} onChange={e => setNewVariant({...newVariant, buying_price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (MAD)</label>
                    <input className="form-input" type="number" value={newVariant.selling_price} onChange={e => setNewVariant({...newVariant, selling_price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Stock</label>
                    <input className="form-input" type="number" value={newVariant.stock} onChange={e => setNewVariant({...newVariant, stock: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Alert</label>
                    <input className="form-input" type="number" value={newVariant.low_stock_threshold} onChange={e => setNewVariant({...newVariant, low_stock_threshold: parseInt(e.target.value) || 5})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddVariant(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddVariant}>Add Variant</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Variant Modal */}
      {editingVariant && (
        <div className="modal-overlay" onClick={() => setEditingVariant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Variant — {editingVariant.product.name}</h2>
              <button className="btn-icon" onClick={() => setEditingVariant(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid-2">
                {editingVariant.product.has_sizes && (
                  <div className="form-group">
                    <label className="form-label">Size</label>
                    <input className="form-input" value={editForm.size} onChange={e => setEditForm({...editForm, size: e.target.value})} />
                  </div>
                )}
                {editingVariant.product.has_colors && (
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <input className="form-input" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Buying Price (MAD) *</label>
                  <input className="form-input" type="number" value={editForm.buying_price} onChange={e => setEditForm({...editForm, buying_price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (MAD)</label>
                  <input className="form-input" type="number" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Alert</label>
                  <input className="form-input" type="number" value={editForm.low_stock_threshold} onChange={e => setEditForm({...editForm, low_stock_threshold: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingVariant(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditVariant}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
