import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';
import './StockPage.css';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function StockPage() {
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(20);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ quantity_change: '', reason: '', password: '' });
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (showOnlyAlerts) params.append('below_threshold', String(alertThreshold));
      else params.append('below_threshold', '999999'); // all items

      const data = await apiGet(`/stock?${params.toString()}`);
      setStock(data.stock);

      // Extract categories from results
      const cats = [...new Set(data.stock.map((s) => s.category).filter(Boolean))];
      setCategories(cats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, showOnlyAlerts, alertThreshold]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  function handleAdjustClick(item) {
    setAdjustingItem(item);
    setAdjustForm({ quantity_change: '', reason: '', password: '' });
    setAdjustError('');
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    setAdjustError('');

    const qty = parseInt(adjustForm.quantity_change, 10);
    if (isNaN(qty) || qty === 0) {
      setAdjustError('Veuillez saisir une quantité valide (positive pour ajouter, négative pour retirer).');
      return;
    }
    if (!adjustForm.reason.trim()) {
      setAdjustError('Veuillez indiquer un motif d\'ajustement.');
      return;
    }
    if (!adjustForm.password) {
      setAdjustError('Votre mot de passe est requis.');
      return;
    }

    setAdjusting(true);
    try {
      const data = await apiPut('/stock/adjust', {
        product_id: adjustingItem.id,
        quantity_change: qty,
        reason: adjustForm.reason,
        password: adjustForm.password,
      });
      setSuccessMsg(data.message);
      setAdjustingItem(null);
      fetchStock();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setAdjusting(false);
    }
  }

  function isLowStock(qty) {
    return qty < alertThreshold;
  }

  return (
    <div className="stock-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock du Dépôt</h1>
          <p className="page-subtitle">Gérez et surveillez les niveaux de stock</p>
        </div>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}

      <div className="filters-bar">
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
            checked={showOnlyAlerts}
            onChange={(e) => setShowOnlyAlerts(e.target.checked)}
          />
          Stock faible uniquement (&lt; {alertThreshold})
        </label>

        <div className="threshold-group">
          <label className="threshold-label">Seuil d'alerte:</label>
          <input
            type="number"
            className="form-input threshold-input"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10) || 20)}
            min="1"
          />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stock-summary">
        <span>{stock.length} produits</span>
        <span className="summary-alert">
          {stock.filter((s) => isLowStock(s.quantity)).length} en alerte (&lt; {alertThreshold})
        </span>
      </div>

      {loading ? (
        <div className="loading-state">Chargement du stock...</div>
      ) : stock.length === 0 ? (
        <div className="empty-state"><p>Aucun produit en stock.</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Code-barres</th>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix vente TTC</th>
                <th>Quantité</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((item) => {
                const low = isLowStock(item.quantity);
                return (
                  <tr key={item.id} className={low ? 'row-alert' : ''}>
                    <td className="td-code">{item.id}</td>
                    <td>{item.barcode}</td>
                    <td className="td-name">{item.name}</td>
                    <td><span className="category-tag">{item.category || '—'}</span></td>
                    <td className="td-price">{formatDT(item.selling_price_ttc)}</td>
                    <td className={`td-qty ${low ? 'qty-low' : ''}`}>
                      {item.quantity}
                    </td>
                    <td>
                      {low ? (
                        <span className="badge badge-alert">Stock faible</span>
                      ) : item.quantity === 0 ? (
                        <span className="badge badge-empty">Épuisé</span>
                      ) : (
                        <span className="badge badge-ok">OK</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleAdjustClick(item)}
                      >
                        Ajuster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustingItem && (
        <div className="modal-overlay" onClick={() => setAdjustingItem(null)}>
          <div className="modal-card modal-form" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Ajuster le stock</h3>

            <div className="modal-summary">
              <p><strong>{adjustingItem.id}</strong> — {adjustingItem.name}</p>
              <p>Stock actuel : <strong>{adjustingItem.quantity} unités</strong></p>
              <p>Prix vente TTC : {formatDT(adjustingItem.selling_price_ttc)}</p>
            </div>

            {adjustError && <div className="login-error">{adjustError}</div>}

            <form onSubmit={handleAdjustSubmit}>
              <div className="form-group">
                <label className="form-label">Ajustement de stock</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: +50 pour ajouter, -10 pour retirer"
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, quantity_change: e.target.value }))}
                />
                <span className="form-hint">Valeur positive = ajout, négative = retrait</span>
              </div>

              <div className="form-group">
                <label className="form-label">Motif de l'ajustement *</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Ex: Inventaire physique, correction, produit endommagé..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Votre mot de passe *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mot de passe pour confirmer"
                  value={adjustForm.password}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustingItem(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjusting}>
                  {adjusting ? 'Ajustement...' : 'Confirmer l\'ajustement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockPage;
