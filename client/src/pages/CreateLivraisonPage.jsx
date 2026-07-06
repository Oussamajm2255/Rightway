import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import { useCategoryPalette } from '../context/CategoryPaletteContext';
import './CreateLivraisonPage.css';

function IconCarton() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 6v8l8 4M18 6v8l-8 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10v8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8l4-2 4 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function CreateLivraisonPage() {
  const navigate = useNavigate();
  const { getColor } = useCategoryPalette();
  const [step, setStep] = useState(1);
  const [commercials, setCommercials] = useState([]);
  const [stock, setStock] = useState([]);
  const [selectedCommercial, setSelectedCommercial] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [comData, stockData] = await Promise.all([
          apiGet('/users/commercials'),
          apiGet('/stock?below_threshold=999999'),
        ]);
        setCommercials(comData.users);
        setStock(stockData.stock.filter((s) => s.quantity > 0));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  function handleSelectCommercial(com) {
    setSelectedCommercial(com);
    setError('');
    setStep(2);
  }

  function handleQtyChange(productId, qty) {
    const val = parseInt(qty, 10);
    if (isNaN(val) || val < 0) {
      const next = { ...selectedItems };
      delete next[productId];
      setSelectedItems(next);
      return;
    }
    const stockItem = stock.find((s) => s.id === productId);
    const max = stockItem ? stockItem.quantity : 0;
    const clamped = Math.min(val, max);
    setSelectedItems((prev) => ({ ...prev, [productId]: clamped }));
  }

  function groupByCategory(products) {
    const groups = {};
    for (const p of products) {
      const cat = p.category || 'Sans catégorie';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return Object.entries(groups);
  }

  function getSelectedProducts() {
    return stock.filter((s) => selectedItems[s.id] && selectedItems[s.id] > 0);
  }

  function getTotal() {
    return getSelectedProducts().reduce(
      (sum, p) => sum + selectedItems[p.id] * Number(p.selling_price_ttc), 0
    );
  }

  function handleGoToPreview() {
    const selected = getSelectedProducts();
    if (selected.length === 0) {
      setError('Veuillez sélectionner au moins un produit avec une quantité positive.');
      return;
    }
    setError('');
    setStep(3);
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Votre mot de passe est requis pour confirmer.');
      return;
    }
    const items = getSelectedProducts().map((p) => ({
      product_id: p.id,
      qte_chargee: selectedItems[p.id],
    }));
    setSubmitting(true);
    try {
      const data = await apiPost('/livraisons', {
        commercial_id: selectedCommercial.id,
        items,
      });
      navigate(`/livraisons/${data.livraison.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  const STEP_LABELS = ['Commercial', 'Produits', 'Aperçu', 'Confirmation'];

  if (loadingData) {
    return (
      <div className="create-livraison">
        <div className="page-header">
          <div>
            <h1 className="page-title">Nouvelle livraison</h1>
            <p className="page-subtitle">Créez un bon de sortie pour un commercial</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="create-livraison">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle livraison</h1>
          <p className="page-subtitle">Créez un bon de sortie pour un commercial</p>
        </div>
      </div>

      {/* Wizard Stepper */}
      <div className="wizard-stepper">
        {STEP_LABELS.map((label, idx) => {
          const s = idx + 1;
          const isActive = step === s;
          const isDone = step > s;
          return (
            <span key={s} className={`stepper-step ${isActive ? 'current' : ''} ${isDone ? 'done' : ''}`}>
              <span className={`stepper-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : s}
              </span>
              <span className="stepper-label">{label}</span>
              {s < 4 && <span className={`stepper-line ${isDone ? 'done' : ''}`} />}
            </span>
          );
        })}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* STEP 1: Select Commercial */}
      {step === 1 && (
        <div className="step-panel">
          <h2 className="step-title">Sélectionnez le commercial</h2>
          <p className="step-hint">Choisissez le commercial qui effectuera la livraison.</p>
          {commercials.length === 0 ? (
            <div className="empty-state"><p>Aucun commercial actif trouvé.</p></div>
          ) : (
            <div className="commercial-grid">
              {commercials.map((com) => (
                <button
                  key={com.id}
                  className={`commercial-card ${selectedCommercial?.id === com.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCommercial(com)}
                >
                  <div className="com-avatar">{getInitials(com.full_name)}</div>
                  <div className="com-name">{com.full_name}</div>
                  <div className="com-vehicle">
                    {com.vehicle_name && <span>{com.vehicle_name}</span>}
                    {com.vehicle_plate && <span className="com-plate">{com.vehicle_plate}</span>}
                  </div>
                  {com.phone && <div className="com-phone">{com.phone}</div>}
                </button>
              ))}
            </div>
          )}
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/livraisons')}>Annuler</button>
          </div>
        </div>
      )}

      {/* STEP 2: Select Products */}
      {step === 2 && selectedCommercial && (
        <div className="step-panel">
          <h2 className="step-title">Sélectionnez les produits</h2>
          <p className="step-hint">Pour {selectedCommercial.full_name}. Seuls les produits avec stock disponible sont affichés.</p>

          <div className="products-grid">
            {groupByCategory(stock).map(([category, products]) => (
              <div key={category} className="category-section">
                <div className="category-header">
                  <span className="category-header-icon"><IconCarton /></span>
                  <span className="category-header-name">{category}</span>
                  <span className="category-header-count">{products.length} produit{products.length > 1 ? 's' : ''}</span>
                </div>
                {products.map((product) => (
                  <div key={product.id} className={`product-select-card ${selectedItems[product.id] > 0 ? 'selected' : ''}`}>
                    <div className="ps-info">
                      <div className="ps-name">{product.name}</div>
                      <div className="ps-details">
                        <span className="td-code">{product.id}</span>
                        <span>{formatDT(product.selling_price_ttc)}</span>
                        <span className={`ps-stock ${product.quantity < 21 ? 'low' : ''}`}>
                          Stock: {product.quantity}
                        </span>
                      </div>
                    </div>
                    <div className="ps-qty">
                      <button
                        className="qty-btn"
                        onClick={() => handleQtyChange(product.id, (selectedItems[product.id] || 0) - 1)}
                        disabled={!selectedItems[product.id]}
                      >−</button>
                      <input
                        type="number"
                        className="qty-input"
                        value={selectedItems[product.id] || ''}
                        onChange={(e) => handleQtyChange(product.id, e.target.value)}
                        placeholder="0"
                        min="0"
                        max={product.quantity}
                      />
                      <button
                        className="qty-btn"
                        onClick={() => handleQtyChange(product.id, (selectedItems[product.id] || 0) + 1)}
                        disabled={(selectedItems[product.id] || 0) >= product.quantity}
                      >+</button>
                    </div>
                    <div className="ps-total">
                      {selectedItems[product.id] > 0 && (
                        <span>{formatDT(selectedItems[product.id] * Number(product.selling_price_ttc))}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="preview-total-bar">
            <span>{getSelectedProducts().length} produit(s) sélectionné(s)</span>
            <strong>Total: {formatDT(getTotal())}</strong>
          </div>

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Retour</button>
            <button className="btn btn-primary" onClick={handleGoToPreview}>
              Aperçu du Bon de Sortie
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview */}
      {step === 3 && (
        <div className="step-panel">
          <h2 className="step-title">Aperçu du Bon de Sortie</h2>
          <p className="step-hint">Vérifiez les informations avant de confirmer.</p>

          <div className="preview-card">
            <div className="preview-header">
              <strong>Right Way</strong>
              <span>STE RIGHT WAY FOR TRADING</span>
            </div>
            <div className="preview-meta">
              <div><span>Commercial:</span> {selectedCommercial.full_name}</div>
              <div><span>Véhicule:</span> {selectedCommercial.vehicle_name} — {selectedCommercial.vehicle_plate}</div>
            </div>

            <table className="preview-table">
              <thead>
                <tr>
                  <th>Code-barres</th>
                  <th>Catégorie</th>
                  <th>Produit</th>
                  <th>PU TTC</th>
                  <th>Qté</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  getSelectedProducts().reduce((acc, p) => {
                    const cat = p.category || 'Sans catégorie';
                    (acc[cat] = acc[cat] || []).push(p);
                    return acc;
                  }, {})
                ).map(([cat, catItems]) => {
                  const catCol = getColor(cat);
                  return (
                    <Fragment key={cat}>
                      {catItems.map((p) => (
                        <tr key={p.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                          <td className="td-code">{p.barcode || p.id}</td>
                          <td><span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{cat}</span></td>
                          <td>{p.name}</td>
                          <td className="td-price">{formatDT(p.selling_price_ttc)}</td>
                          <td className="td-qty">{selectedItems[p.id]}</td>
                          <td className="td-price">{formatDT(selectedItems[p.id] * Number(p.selling_price_ttc))}</td>
                        </tr>
                      ))}
                      <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                        <td colSpan="4" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>
                          Sous-total {cat}
                        </td>
                        <td className="td-qty">{catItems.reduce((s, p) => s + selectedItems[p.id], 0)}</td>
                        <td className="td-price">{formatDT(catItems.reduce((s, p) => s + (selectedItems[p.id] * Number(p.selling_price_ttc)), 0))}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5" style={{ textAlign: 'right', fontWeight: '600' }}>Total</td>
                  <td className="td-price" style={{ fontWeight: '700' }}>{formatDT(getTotal())}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Modifier</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>
              Confirmer la charge
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Password Confirmation */}
      {step === 4 && (
        <div className="step-panel step-confirm">
          <h2 className="step-title">Confirmer la charge</h2>
          <p className="step-hint">Saisissez votre mot de passe pour valider la création.</p>

          <div className="confirm-summary">
            <p>Vous allez créer un bon de sortie pour :</p>
            <p className="summary-highlight">{selectedCommercial.full_name} — {selectedCommercial.vehicle_name} ({selectedCommercial.vehicle_plate})</p>
            <p>{getSelectedProducts().length} produit(s) — Total: <strong>{formatDT(getTotal())}</strong></p>
            <p className="confirm-note">Le stock ne sera déduit qu'après confirmation par le commercial.</p>
          </div>

          <form onSubmit={handleConfirm}>
            <div className="form-group">
              <label className="form-label" htmlFor="create-password">Votre mot de passe</label>
              <input
                id="create-password"
                type="password"
                className="form-input"
                placeholder="Mot de passe pour confirmer"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="step-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>Retour</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? 'Création...' : 'Confirmer la charge'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default CreateLivraisonPage;
