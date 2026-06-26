import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './StockPage.css';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function StockPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(20);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustDirection, setAdjustDirection] = useState('add');
  const [adjustForm, setAdjustForm] = useState({
    quantity_change: '', reason: '', password: '',
    movement_date: '', invoice_number: '', company_name: '',
  });
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Stock history
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

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

  async function fetchMovements() {
    setMovementsLoading(true);
    try {
      const data = await apiGet('/stock/movements');
      setMovements(data.movements);
    } catch (err) {
      console.error('fetchMovements error:', err);
    } finally {
      setMovementsLoading(false);
    }
  }

  function handleToggleHistory() {
    if (!showHistory) {
      fetchMovements();
    }
    setShowHistory(!showHistory);
  }

  function handleAdjustClick(item) {
    setAdjustingItem(item);
    setAdjustDirection('add');
    setAdjustForm({
      quantity_change: '', reason: '', password: '',
      movement_date: '', invoice_number: '', company_name: '',
    });
    setAdjustError('');
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    setAdjustError('');

    const absQty = parseInt(adjustForm.quantity_change, 10);
    if (isNaN(absQty) || absQty <= 0) {
      setAdjustError('Veuillez saisir une quantité valide supérieure à 0.');
      return;
    }
    const qty = adjustDirection === 'remove' ? -absQty : absQty;

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
      const body = {
        product_id: adjustingItem.id,
        quantity_change: qty,
        reason: adjustForm.reason,
        password: adjustForm.password,
      };
      if (adjustDirection === 'remove') {
        if (adjustForm.movement_date) body.movement_date = adjustForm.movement_date;
        if (adjustForm.invoice_number.trim()) body.invoice_number = adjustForm.invoice_number.trim();
        if (adjustForm.company_name.trim()) body.company_name = adjustForm.company_name.trim();
      }
      const data = await apiPut('/stock/adjust', body);
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
                      {user?.role === 'SUPER_ADMIN' && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleAdjustClick(item)}
                        >
                          Ajuster
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

      {/* Adjust Modal */}
      {adjustingItem && (
        <div className="modal-overlay" onClick={() => setAdjustingItem(null)}>
          <div className="modal-card modal-form modal-adjust" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Ajuster le stock</h3>

            <div className="modal-summary">
              <p><strong>{adjustingItem.id}</strong> — {adjustingItem.name}</p>
              <p>Stock actuel : <strong>{adjustingItem.quantity} unités</strong></p>
              <p>Prix vente TTC : {formatDT(adjustingItem.selling_price_ttc)}</p>
            </div>

            {adjustError && <div className="login-error">{adjustError}</div>}

            <form onSubmit={handleAdjustSubmit}>
              {/* Add / Remove toggle */}
              <div className="form-group">
                <label className="form-label">Type d'opération</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${adjustDirection === 'add' ? 'toggle-btn-active toggle-btn-add' : ''}`}
                    onClick={() => setAdjustDirection('add')}
                  >
                    ➕ Ajouter au stock
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${adjustDirection === 'remove' ? 'toggle-btn-active toggle-btn-remove' : ''}`}
                    onClick={() => setAdjustDirection('remove')}
                  >
                    ➖ Retirer du stock
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantité</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={adjustDirection === 'add' ? 'Ex: 50' : 'Ex: 10'}
                  value={adjustForm.quantity_change}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, quantity_change: e.target.value }))}
                  min="1"
                />
              </div>

              {/* Conditional fields for Remove */}
              {adjustDirection === 'remove' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Date du mouvement</label>
                    <input
                      type="date"
                      className="form-input"
                      value={adjustForm.movement_date}
                      onChange={(e) => setAdjustForm((p) => ({ ...p, movement_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">N° de facture</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Numéro de facture"
                      value={adjustForm.invoice_number}
                      onChange={(e) => setAdjustForm((p) => ({ ...p, invoice_number: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Société / Client</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nom de la société ou du client"
                      value={adjustForm.company_name}
                      onChange={(e) => setAdjustForm((p) => ({ ...p, company_name: e.target.value }))}
                    />
                  </div>
                </>
              )}

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

      {/* Stock History — Super Admin only */}
      {user?.role === 'SUPER_ADMIN' && (
        <section className="stock-history-section">
          <button
            className="btn btn-outline history-toggle-btn"
            onClick={handleToggleHistory}
          >
            {showHistory ? 'Masquer l\'historique' : '📋 Historique des mouvements'}
          </button>

          {showHistory && (
            <div className="table-container" style={{ marginTop: 'var(--space-4)' }}>
              {movementsLoading ? (
                <div className="loading-state">Chargement de l'historique...</div>
              ) : movements.length === 0 ? (
                <div className="empty-state"><p>Aucun mouvement de stock enregistré.</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Produit</th>
                      <th>Catégorie</th>
                      <th>Type</th>
                      <th>Qté</th>
                      <th>N° Facture</th>
                      <th>Société</th>
                      <th>Motif</th>
                      <th>Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="td-date">
                          {m.movement_date
                            ? new Date(m.movement_date).toLocaleDateString('fr-FR')
                            : new Date(m.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="td-name">{m.product_name}</td>
                        <td>{m.product_category || '—'}</td>
                        <td>
                          <span className={`movement-badge movement-${m.type.toLowerCase()}`}>
                            {m.type === 'AJUSTEMENT' ? (m.quantity > 0 ? 'Ajout' : 'Retrait')
                              : m.type === 'SORTIE' ? 'Sortie'
                              : m.type === 'RETOUR' ? 'Retour'
                              : m.type}
                          </span>
                        </td>
                        <td className={`td-qty ${m.quantity < 0 ? 'qty-low' : ''}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </td>
                        <td>{m.invoice_number || '—'}</td>
                        <td>{m.company_name || '—'}</td>
                        <td className="movement-reason">{m.reason || '—'}</td>
                        <td>{m.created_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default StockPage;
