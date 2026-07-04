import { useState, useEffect, useCallback, Fragment } from 'react';
import { apiGet, apiPut } from '../lib/api';
import { formatDate } from '../lib/utils';
import { catColors } from '../lib/categoryPalette';
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
  const [multiItemsMap, setMultiItemsMap] = useState({});
  const [multiSearchTerm, setMultiSearchTerm] = useState('');
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
    setMultiItemsMap({});
    setMultiSearchTerm('');
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
        for (const [productId, qtyStr] of Object.entries(multiItemsMap)) {
          const qty = parseInt(qtyStr, 10);
          if (qty > 0) {
            const signedQty = adjustDirection === 'add' ? qty : -qty;
            validItems.push({ product_id: productId, quantity_change: signedQty });
          }
        }
        if (validItems.length === 0) {
          setAdjustError('Veuillez saisir une quantité pour au moins un produit.');
          setAdjusting(false);
          return;
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
              {Object.entries(
                stock.reduce((acc, item) => {
                  const cat = item.category || 'Sans catégorie';
                  (acc[cat] = acc[cat] || []).push(item);
                  return acc;
                }, {})
              ).map(([cat, catItems]) => {
                const catCol = catColors(cat);
                return (
                  <Fragment key={cat}>
                    {catItems.map((item) => {
                      const low = isLowStock(item.quantity);
                      return (
                        <tr key={item.id} className={low ? 'row-alert' : ''} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                          <td className="td-code">{item.id}</td>
                          <td>{item.barcode}</td>
                          <td className="td-name">{item.name}</td>
                          <td><span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{cat}</span></td>
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
                    <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                      <td colSpan="5" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>
                        Sous-total {cat}
                      </td>
                      <td className="td-qty" style={{ fontWeight: 700 }}>
                        {catItems.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </Fragment>
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
                      onClick={() => {
                                              setAdjustMode('multiple');
                                              if (adjustingItem) {
                                                setMultiItems([{ product_id: adjustingItem.id, quantity: adjustForm.quantity_change || '' }]);
                                              }
                                            }}
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

              {/* Multiple mode: dynamic product table replaced by searchable grouped grid */}
              {adjustMode === 'multiple' && (
                <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                  <label className="form-label">Sélectionnez et ajustez les produits</label>
                  
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Rechercher un produit par nom ou code-barres..."
                    value={multiSearchTerm}
                    onChange={(e) => setMultiSearchTerm(e.target.value)}
                    style={{ marginBottom: 'var(--space-3)' }}
                  />

                  <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)' }}>
                    {(() => {
                      const lowerSearch = multiSearchTerm.toLowerCase();
                      const filteredStock = stock.filter(s => 
                        s.name.toLowerCase().includes(lowerSearch) || 
                        (s.barcode && s.barcode.toLowerCase().includes(lowerSearch)) ||
                        s.id.toLowerCase().includes(lowerSearch)
                      );

                      if (filteredStock.length === 0) {
                        return <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucun produit trouvé.</p>;
                      }

                      const grouped = filteredStock.reduce((acc, p) => {
                        const cat = p.category || 'Sans catégorie';
                        (acc[cat] = acc[cat] || []).push(p);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([category, products]) => (
                        <div key={category} className="category-section" style={{ marginBottom: 'var(--space-4)' }}>
                          <div className="category-header" style={{ marginBottom: 'var(--space-2)' }}>
                            <span className="category-header-icon"><IconBox /></span>
                            <span className="category-header-name">{category}</span>
                            <span className="category-header-count">{products.length} produit{products.length > 1 ? 's' : ''}</span>
                          </div>
                          
                          <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                            {products.map((product) => {
                              const qtyVal = multiItemsMap[product.id] || '';
                              const isSelected = qtyVal > 0;
                              return (
                                <div key={product.id} className={`product-select-card ${isSelected ? 'selected' : ''}`} style={{ background: '#fff', border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
                                  <div className="ps-info" style={{ marginBottom: 'var(--space-2)' }}>
                                    <div className="ps-name" style={{ fontWeight: 600 }}>{product.name}</div>
                                    <div className="ps-details" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                      <span>{product.id}</span>
                                      <span className={product.quantity < 20 ? 'qty-low' : ''} style={{ fontWeight: 600 }}>
                                        Stock: {product.quantity}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ps-qty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => {
                                        const current = parseInt(multiItemsMap[product.id] || '0', 10);
                                        if (current > 0) {
                                          setMultiItemsMap(prev => ({ ...prev, [product.id]: current - 1 }));
                                        }
                                      }}
                                      disabled={!multiItemsMap[product.id] || parseInt(multiItemsMap[product.id]) <= 0}
                                      style={{ padding: '4px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }}
                                    >−</button>
                                    <input
                                      type="number"
                                      className="qty-input form-input"
                                      value={multiItemsMap[product.id] || ''}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value, 10);
                                        if (isNaN(val) || val < 0) val = '';
                                        if (adjustDirection === 'remove' && val > product.quantity) {
                                          val = product.quantity;
                                        }
                                        setMultiItemsMap(prev => ({ ...prev, [product.id]: val }));
                                      }}
                                      placeholder="0"
                                      min="0"
                                      max={adjustDirection === 'remove' ? product.quantity : undefined}
                                      style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                                    />
                                    <button
                                      type="button"
                                      className="qty-btn"
                                      onClick={() => {
                                        const current = parseInt(multiItemsMap[product.id] || '0', 10);
                                        if (adjustDirection === 'remove' && current >= product.quantity) return;
                                        setMultiItemsMap(prev => ({ ...prev, [product.id]: current + 1 }));
                                      }}
                                      disabled={adjustDirection === 'remove' && parseInt(multiItemsMap[product.id] || '0', 10) >= product.quantity}
                                      style={{ padding: '4px 10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }}
                                    >+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={{ marginTop: 'var(--space-2)', textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {Object.values(multiItemsMap).filter(v => parseInt(v, 10) > 0).length} produit(s) sélectionné(s)
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
                    <tr key={m.id} style={{ background: catColors(m.product_category || 'Sans catégorie').bg, borderLeftColor: catColors(m.product_category || 'Sans catégorie').bar }}>
                      <td className="td-date">
                        {m.movement_date
                          ? formatDate(m.movement_date)
                          : formatDate(m.created_at)}
                      </td>
                      <td className="td-name">{m.product_name}</td>
                      <td><span className="cat-pill" style={{ background: catColors(m.product_category || 'Sans catégorie').bg, color: catColors(m.product_category || 'Sans catégorie').text }}>{m.product_category || 'Sans catégorie'}</span></td>
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
