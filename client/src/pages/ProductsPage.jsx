import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '../lib/api';
import { catColors } from '../lib/categoryPalette';
import './ProductsPage.css';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (search) params.append('search', search);
      if (!showArchived) params.append('is_active', 'true');
      const data = await apiGet(`/products?${params.toString()}`);
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, showArchived]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet('/products/categories');
      setCategories(data.categories);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function handleCreate() {
    setEditingProduct(null);
    setShowForm(true);
  }

  function handleEdit(product) {
    setEditingProduct(product);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingProduct(null);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditingProduct(null);
    fetchProducts();
  }

  async function handleArchive(product) {
    if (!window.confirm(`Archiver le produit "${product.name}" (${product.id}) ?`)) return;
    try {
      await apiDelete(`/products/${product.id}`);
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Produits</h1>
          <p className="page-subtitle">Gérez le catalogue des produits</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Nouveau produit
        </button>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Rechercher par nom, code-barres..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Afficher les produits archivés
        </label>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state">Chargement des produits...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <p>Aucun produit trouvé.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Code-barres</th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix d'achat</th>
                <th>Prix vente TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const catCol = catColors(product.category || 'Sans catégorie');
                return (
                <tr key={product.id} className={!product.is_active ? 'row-inactive' : ''} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                  <td className="td-code">{product.id}</td>
                  <td>{product.barcode}</td>
                  <td className="td-name">{product.name}</td>
                  <td>
                    <span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{product.category || 'Sans catégorie'}</span>
                  </td>
                  <td className="td-price">{formatDT(product.purchase_price)}</td>
                  <td className="td-price">{formatDT(product.selling_price_ttc)}</td>
                  <td>
                    <span className={`status-dot ${product.is_active ? 'active' : 'inactive'}`} />
                    {product.is_active ? 'Actif' : 'Archivé'}
                  </td>
                  <td className="td-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEdit(product)}
                    >
                      Modifier
                    </button>
                    {product.is_active && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleArchive(product)}
                      >
                        Archiver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}

/* ===== Product Form Modal ===== */
function ProductFormModal({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [formData, setFormData] = useState({
    barcode: product?.barcode || '',
    name: product?.name || '',
    category: product?.category || '',
    purchase_price: product?.purchase_price ?? '',
    selling_price_ttc: product?.selling_price_ttc ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!formData.barcode.trim() || !formData.name.trim()) {
      setError('Le code-barres et le nom sont obligatoires.');
      return;
    }
    if (!formData.purchase_price || !formData.selling_price_ttc) {
      setError('Les prix sont obligatoires.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPut(`/products/${product.id}`, formData);
      } else {
        await apiPost('/products', formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-form" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">
          {isEdit ? `Modifier ${product.id}` : 'Nouveau produit'}
        </h3>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Code-barres *</label>
              <input name="barcode" className="form-input" value={formData.barcode} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Catégorie</label>
              <input
                name="category"
                className="form-input"
                value={formData.category}
                onChange={handleChange}
                list="category-list"
                placeholder="Ex: Biscuits"
              />
              <datalist id="category-list">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nom du produit *</label>
            <input name="name" className="form-input" value={formData.name} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prix d'achat (DT) *</label>
              <input
                name="purchase_price"
                type="number"
                step="0.001"
                min="0.001"
                className="form-input"
                value={formData.purchase_price}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Prix de vente TTC (DT) *</label>
              <input
                name="selling_price_ttc"
                type="number"
                step="0.001"
                min="0.001"
                className="form-input"
                value={formData.selling_price_ttc}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Enregistrement...' : (isEdit ? 'Enregistrer' : 'Créer le produit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductsPage;
