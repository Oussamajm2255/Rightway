import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import './StockPage.css';

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 6v8l8 4M18 6v8l-8 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconJournal() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6h6M7 10h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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
  const [adjustMode, setAdjustMode] = useState('single'); // 'single' | 'multiple'
  const [adjustForm, setAdjustForm] = useState({
    quantity_change: '', reason: '', password: '',
    movement_date: '', invoice_number: '', company_name: '',
  });
  const [multiItems, setMultiItems] = useState([{ product_id: '', quantity: '' }]);
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Tab navigation
  const [activeTab, setActiveTab] = useState('stock');

  // Journal des ajustements
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [journalDateFrom, setJournalDateFrom] = useState('');
  const [journalDateTo, setJournalDateTo] = useState('');
  const [journalOperation, setJournalOperation] = useState('');

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

  async function fetchMovements(filters = {}) {
    setMovementsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.operation) params.append('operation', filters.operation);
      const data = await apiGet(`/stock/movements?${params.toString()}`);
      setMovements(data.movements);
    } catch (err) {
      console.error('fetchMovements error:', err);
    } finally {
      setMovementsLoading(false);
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
    if (tab === 'journal') {
      fetchMovements({ dateFrom: journalDateFrom, dateTo: journalDateTo, operation: journalOperation });
    }
  }

  function handleAdjustClick(item) {
    setAdjustingItem(item);
    setAdjustDirection('add');
    setAdjustMode('single');
    setAdjustForm({
      quantity_change: '', reason: '', password: '',
      movement_date: '', invoice_number: '', company_name: '',
    });
    setMultiItems([{ product_id: '', quantity: '' }]);
    setAdjustError('');
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    setAdjustError('');

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
        reason: adjustForm.reason,
        password: adjustForm.password,
      };
      if (adjustDirection === 'add') {
        if (adjustForm.movement_date) body.movement_date = adjustForm.movement_date;
        if (adjustForm.invoice_number.trim()) body.invoice_number = adjustForm.invoice_number.trim();
        if (adjustForm.company_name.trim()) body.company_name = adjustForm.company_name.trim();
      }

      if (adjustMode === 'multiple') {
        // Validate multi items
        const validItems = [];
        for (let i = 0; i < multiItems.length; i++) {
          const item = multiItems[i];
          if (!item.product_id) {
            setAdjustError(`Ligne ${i + 1} : veuillez sélectionner un produit.`);
            setAdjusting(false);
            return;
          }
          const qty = parseInt(item.quantity, 10);
          if (isNaN(qty) || qty <= 0) {
            setAdjustError(`Ligne ${i + 1} : quantité invalide.`);
            setAdjusting(false);
            return;
          }
          const signedQty = adjustDirection === 'add' ? qty : -qty;
          validItems.push({ product_id: item.product_id, quantity_change: signedQty });
        }
        body.items = validItems;
      } else {
        const absQty = parseInt(adjustForm.quantity_change, 10);
        if (isNaN(absQty) || absQty <= 0) {
          setAdjustError('Veuillez saisir une quantité valide supérieure à 0.');
          setAdjusting(false);
          return;
        }
        const qty = adjustDirection === 'add' ? absQty : -absQty;
        body.product_id = adjustingItem.id;
        body.quantity_change = qty;
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

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'tab-btn-active' : ''}`}
          onClick={() => switchTab('stock')}
        >
          <IconBox />
          <span>Stock</span>
        </button>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            className={`tab-btn ${activeTab === 'journal' ? 'tab-btn-active' : ''}`}
            onClick={() => switchTab('journal')}
          >
            <IconJournal />
            <span>Journal des ajustements</span>
          </button>
        )}
      </nav>

      {activeTab === 'stock' && (
        <>

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
                    <IconPlus />
                    <span>Ajouter au stock</span>
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${adjustDirection === 'remove' ? 'toggle-btn-active toggle-btn-remove' : ''}`}
                    onClick={() => setAdjustDirection('remove')}
                  >
                    <IconMinus />
                    <span>Retirer du stock</span>
                  </button>
                </div>
              </div>

              {/* Mode toggle: single vs multiple */}
              {adjustDirection === 'add' && (
                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${adjustMode === 'single' ? 'toggle-btn-active' : ''}`}
                      onClick={() => setAdjustMode('single')}
                    >
                      <span>Produit unique</span>
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${adjustMode === 'multiple' ? 'toggle-btn-active' : ''}`}
                      onClick={() => setAdjustMode('multiple')}
                    >
                      <span>Ajout multiple</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Single mode: quantity input */}
              {adjustMode === 'single' && (
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
              )}

              {/* Multiple mode: dynamic product table */}
              {adjustMode === 'multiple' && (
                <div className="form-group">
                  <label className="form-label">Produits à ajouter</label>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', width: '40%' }}>Produit</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '30%' }}>Quantité</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', width: '30px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < multiItems.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <td style={{ padding: '4px 8px' }}>
                              <select
                                className="form-input"
                                style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                                value={item.product_id}
                                onChange={(e) => {
                                  const newItems = [...multiItems];
                                  newItems[idx] = { ...newItems[idx], product_id: e.target.value };
                                  setMultiItems(newItems);
                                }}
                              >
                                <option value="">— Sélectionner —</option>
                                {stock
                                  .filter(s => !multiItems.some((mi, i) => i !== idx && mi.product_id === s.id))
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      [{s.category}] {s.name} (stock: {s.quantity})
                                    </option>
                                  ))}
                              </select>
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px', textAlign: 'center' }}
                                placeholder="Qté"
                                value={item.quantity}
                                min="1"
                                onChange={(e) => {
                                  const newItems = [...multiItems];
                                  newItems[idx] = { ...newItems[idx], quantity: e.target.value };
                                  setMultiItems(newItems);
                                }}
                              />
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                              {multiItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setMultiItems(multiItems.filter((_, i) => i !== idx))}
                                  style={{
                                    background: 'none', border: 'none', color: 'var(--color-danger)',
                                    cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px',
                                  }}
                                  title="Supprimer cette ligne"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setMultiItems([...multiItems, { product_id: '', quantity: '' }])}
                    >
                      + Ajouter une ligne
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Total : {multiItems.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0)} unités
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional fields for Add */}
              {adjustDirection === 'add' && (
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

        </>
      )}

      {/* Journal des ajustements — Super Admin only */}
      {activeTab === 'journal' && user?.role === 'SUPER_ADMIN' && (
        <>
          <div className="journal-filters">
            <div className="journal-filter-group">
              <label>Du</label>
              <input
                type="date"
                className="form-input"
                value={journalDateFrom}
                onChange={(e) => setJournalDateFrom(e.target.value)}
              />
            </div>
            <div className="journal-filter-group">
              <label>Au</label>
              <input
                type="date"
                className="form-input"
                value={journalDateTo}
                onChange={(e) => setJournalDateTo(e.target.value)}
              />
            </div>
            <div className="journal-filter-group">
              <label>Opération</label>
              <select
                className="form-input"
                value={journalOperation}
                onChange={(e) => setJournalOperation(e.target.value)}
              >
                <option value="">Toutes</option>
                <option value="add">Ajouts</option>
                <option value="remove">Retraits</option>
              </select>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => fetchMovements({ dateFrom: journalDateFrom, dateTo: journalDateTo, operation: journalOperation })}
            >
              Appliquer
            </button>
          </div>

          {movements.length > 0 && (
            <div className="journal-summary">
              <span className="journal-summary-item journal-summary-add">
                +{movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)} unités ajoutées
              </span>
              <span className="journal-summary-item journal-summary-remove">
                −{Math.abs(movements.filter((m) => m.quantity < 0).reduce((s, m) => s + m.quantity, 0))} unités retirées
              </span>
              <span className={`journal-summary-item ${movements.reduce((s, m) => s + m.quantity, 0) >= 0 ? 'journal-summary-add' : 'journal-summary-remove'}`}>
                Net : {movements.reduce((s, m) => s + m.quantity, 0) > 0 ? '+' : ''}{movements.reduce((s, m) => s + m.quantity, 0)} unités
              </span>
            </div>
          )}

          <div className="table-container">
            {movementsLoading ? (
              <div className="loading-state">Chargement du journal...</div>
            ) : movements.length === 0 ? (
              <div className="empty-state"><p>Aucun ajustement manuel enregistré.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Produit</th>
                    <th>Catégorie</th>
                    <th>Opération</th>
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
                          ? formatDate(m.movement_date)
                          : formatDate(m.created_at)}
                      </td>
                      <td className="td-name">{m.product_name}</td>
                      <td>{m.product_category || '—'}</td>
                      <td>
                        <span className={`movement-badge ${m.quantity > 0 ? 'movement-add' : 'movement-remove'}`}>
                          {m.quantity > 0 ? 'Ajout' : 'Retrait'}
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
        </>
      )}
    </div>
  );
}

export default StockPage;
