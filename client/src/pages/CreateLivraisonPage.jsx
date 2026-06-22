import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import './CreateLivraisonPage.css';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function CreateLivraisonPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=select commercial, 2=select products, 3=preview, 4=confirm
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
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: clamped,
    }));
  }

  function getSelectedProducts() {
    return stock.filter((s) => selectedItems[s.id] && selectedItems[s.id] > 0);
  }

  function getTotal() {
    return getSelectedProducts().reduce(
      (sum, p) => sum + selectedItems[p.id] * Number(p.selling_price_ttc),
      0
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

  if (loadingData) {
    return <div className="page-container"><div className="loading-state">Chargement...</div></div>;
  }

  return (
    <div className="create-livraison">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle livraison</h1>
          <p className="page-subtitle">Créez un bon de sortie pour un commercial</p>
        </div>
        <div className="step-indicator">
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* STEP 1: Select Commercial */}
      {step === 1 && (
        <div className="step-panel">
          <h2 className="step-title">1. Sélectionnez le commercial</h2>
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
          <h2 className="step-title">2. Sélectionnez les produits pour {selectedCommercial.full_name}</h2>
          <p className="step-hint">Seuls les produits avec stock disponible sont affichés.</p>

          <div className="products-grid">
            {stock.map((product) => (
              <div key={product.id} className={`product-select-card ${selectedItems[product.id] > 0 ? 'selected' : ''}`}>
                <div className="ps-info">
                  <div className="ps-name">{product.name}</div>
                  <div className="ps-details">
                    <span>{product.id}</span>
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
          <h2 className="step-title">3. Aperçu du Bon de Sortie</h2>

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
                  <th>Code</th>
                  <th>Produit</th>
                  <th>PU TTC</th>
                  <th>Qté</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {getSelectedProducts().map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{formatDT(p.selling_price_ttc)}</td>
                    <td>{selectedItems[p.id]}</td>
                    <td className="td-price">{formatDT(selectedItems[p.id] * Number(p.selling_price_ttc))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4"><strong>Total</strong></td>
                  <td className="td-price"><strong>{formatDT(getTotal())}</strong></td>
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
          <h2 className="step-title">4. Confirmer la charge</h2>

          <div className="confirm-summary">
            <p>Vous allez créer un bon de sortie pour :</p>
            <p className="summary-highlight">{selectedCommercial.full_name} — {selectedCommercial.vehicle_name} ({selectedCommercial.vehicle_plate})</p>
            <p>{getSelectedProducts().length} produit(s) — Total: <strong>{formatDT(getTotal())}</strong></p>
            <p className="confirm-note">Le stock ne sera déduit qu'après confirmation par le commercial.</p>
          </div>

          <form onSubmit={handleConfirm}>
            <div className="form-group">
              <label className="form-label">Votre mot de passe</label>
              <input
                type="password"
                className="form-input"
                placeholder="Mot de passe pour confirmer"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="step-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>Retour</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
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
