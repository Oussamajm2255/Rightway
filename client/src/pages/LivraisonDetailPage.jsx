import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../lib/api';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function LivraisonDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [livraison, setLivraison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTerminer, setShowTerminer] = useState(searchParams.get('action') === 'terminer');
  const [terminerSummary, setTerminerSummary] = useState(null);
  const [showConfirmerRetour, setShowConfirmerRetour] = useState(false);
  const [showConfirmSortie, setShowConfirmSortie] = useState(false);
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLivraison = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/livraisons/${id}`);
      setLivraison(data.livraison);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchLivraison(); }, [fetchLivraison]);

  function computeTotal() {
    if (!livraison?.items) return 0;
    return livraison.items.reduce((sum, i) => sum + i.qte_chargee * Number(i.prix_ttc), 0);
  }

  function computeCA() {
    if (!livraison?.items) return 0;
    return livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
  }

  async function handleConfirmSortie(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/confirm-sortie`, { password });
      setSuccess(data.message);
      setShowConfirmSortie(false);
      fetchLivraison();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  async function handleTerminer(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/terminer`, { password });
      setTerminerSummary(data);
      setShowTerminer(false);
      setSuccess(data.message);
      fetchLivraison();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  async function handleConfirmerRetour(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/confirmer-retour`, { password });
      setSuccess(data.message);
      setShowConfirmerRetour(false);
      fetchLivraison();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  if (loading) return <div className="page-container"><div className="loading-state">Chargement...</div></div>;
  if (error) return <div className="page-container"><div className="error-banner">{error}</div></div>;
  if (!livraison) return <div className="page-container"><div className="empty-state">Livraison introuvable.</div></div>;

  const isEnCours = livraison.status === 'EN_COURS';
  const isEnAttente = livraison.status === 'EN_ATTENTE_COMMERCIAL';
  const isEnRetour = livraison.status === 'EN_RETOUR';
  const isCloture = livraison.status === 'CLOTURE';
  const isCommercial = user?.role === 'COMMERCIAL';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAssignedCommercial = isCommercial && livraison.commercial_id === user?.id;
  const ca = computeCA();
  const commission = Number((ca * 0.10).toFixed(3));
  const net_a_reverser = Number((ca - commission).toFixed(3));
  const adminConfirmed = livraison.retour_confirmed_by_admin_at;
  const commercialConfirmed = livraison.retour_confirmed_by_commercial_at;

  return (
    <div className="livraison-detail">
      <button className="btn btn-sm btn-outline" onClick={() => navigate('/livraisons')} style={{ marginBottom: '1rem' }}>
        ← Retour
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{livraison.reference}</h1>
          <p className="page-subtitle">Créée le {new Date(livraison.created_at).toLocaleString('fr-FR')}</p>
        </div>
        <StatusBadge status={livraison.status} />
      </div>

      {success && <div className="success-banner">{success}</div>}

      {/* Commercial: En attente → Confirm sortie */}
      {isEnAttente && isAssignedCommercial && (
        <div className="alert-card">
          <div className="alert-icon">📋</div>
          <div className="alert-body">
            <strong>Bon de sortie en attente</strong>
            <p>Ce bon de sortie nécessite votre confirmation. Vérifiez les produits et les quantités, puis confirmez.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowConfirmSortie(true)}>
            Confirmer le bon de sortie
          </button>
        </div>
      )}

      {/* Commercial: En cours → Terminer button */}
      {isEnCours && isAssignedCommercial && !showTerminer && (
        <div className="alert-card">
          <div className="alert-icon">🚚</div>
          <div className="alert-body">
            <strong>Livraison en cours</strong>
            <p>Déclarez la fin de la livraison lorsque vous avez terminé votre tournée.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowTerminer(true)}>
            Terminer la livraison
          </button>
        </div>
      )}

      {/* Commercial: En cours → access sales page */}
      {isEnCours && isAssignedCommercial && (
        <div className="alert-card" style={{ borderColor: 'var(--color-primary)', background: '#f0fdf4' }}>
          <div className="alert-icon">💰</div>
          <div className="alert-body">
            <strong>Déclarer les ventes</strong>
            <p>Accédez à l'écran de déclaration des ventes en temps réel.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(`/ventes/${id}`)}>
            Ventes
          </button>
        </div>
      )}

      {/* Bon de Retour view for EN_RETOUR */}
      {isEnRetour && (
        <div className="detail-section">
          <h2>Bon de Retour</h2>

          {/* Yellow banner for pending */}
          {!adminConfirmed && isAdmin && (
            <div className="yellow-banner">En attente de votre confirmation.</div>
          )}
          {!commercialConfirmed && isAssignedCommercial && (
            <div className="yellow-banner">En attente de votre confirmation.</div>
          )}
          {adminConfirmed && !commercialConfirmed && isAdmin && (
            <div className="yellow-banner">En attente de confirmation du Commercial.</div>
          )}
          {commercialConfirmed && !adminConfirmed && isAssignedCommercial && (
            <div className="yellow-banner">En attente de confirmation de l'Admin.</div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Article</th>
                  <th>Qté Sortie</th>
                  <th>Qté Vendue</th>
                  <th>Qté Retour</th>
                  <th>PU TTC</th>
                  <th>Montant Vendu</th>
                </tr>
              </thead>
              <tbody>
                {livraison.items.map((item) => {
                  const qte_retour = item.qte_chargee - item.qte_vendue;
                  return (
                    <tr key={item.id}>
                      <td className="td-code">{item.product_id}</td>
                      <td>{item.product_name}</td>
                      <td>{item.qte_chargee}</td>
                      <td>{item.qte_vendue}</td>
                      <td className={qte_retour > 0 ? 'td-qty' : ''}>{qte_retour}</td>
                      <td>{formatDT(item.prix_ttc)}</td>
                      <td className="td-price">{formatDT(item.qte_vendue * Number(item.prix_ttc))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6"><strong>Total CA</strong></td>
                  <td className="td-price"><strong>{formatDT(ca)}</strong></td>
                </tr>
                <tr>
                  <td colSpan="6">Commission Commerciale (10%)</td>
                  <td className="td-price">{formatDT(commission)}</td>
                </tr>
                <tr>
                  <td colSpan="6"><strong>Net à reverser au dépôt</strong></td>
                  <td className="td-price"><strong>{formatDT(net_a_reverser)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Confirmations */}
          <div className="detail-grid" style={{ marginTop: '1rem' }}>
            <div className="detail-card">
              <h3>Confirmation Admin</h3>
              {adminConfirmed ? (
                <span className="badge badge-ok">Confirmé le {new Date(adminConfirmed).toLocaleString('fr-FR')}</span>
              ) : (
                <span className="badge badge-status-pending">En attente</span>
              )}
            </div>
            <div className="detail-card">
              <h3>Confirmation Commercial</h3>
              {commercialConfirmed ? (
                <span className="badge badge-ok">Confirmé le {new Date(commercialConfirmed).toLocaleString('fr-FR')}</span>
              ) : (
                <span className="badge badge-status-pending">En attente</span>
              )}
            </div>
          </div>

          {/* Confirm button for each role */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            {isAdmin && !adminConfirmed && (
              <button className="btn btn-primary" onClick={() => setShowConfirmerRetour(true)}>
                Confirmer le Bon de Retour (Admin)
              </button>
            )}
            {isAssignedCommercial && !commercialConfirmed && (
              <button className="btn btn-primary" onClick={() => setShowConfirmerRetour(true)}>
                Confirmer le Bon de Retour (Commercial)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clôture summary */}
      {isCloture && (
        <div className="detail-section">
          <div className="success-banner" style={{ marginBottom: '1rem' }}>
            Livraison clôturée le {new Date(livraison.closed_at).toLocaleString('fr-FR')}
          </div>
          <div className="detail-grid">
            <div className="detail-card"><h3>CA Total</h3><p className="detail-value">{formatDT(ca)}</p></div>
            <div className="detail-card"><h3>Commission (10%)</h3><p className="detail-value">{formatDT(commission)}</p></div>
            <div className="detail-card"><h3>Net à reverser</h3><p className="detail-value">{formatDT(net_a_reverser)}</p></div>
          </div>
        </div>
      )}

      {/* Meta cards */}
      <div className="detail-grid">
        <div className="detail-card"><h3>Commercial</h3><p className="detail-value">{livraison.commercial_name}</p><p className="detail-sub">{livraison.vehicle_name} — {livraison.vehicle_plate}</p></div>
        <div className="detail-card"><h3>Créé par</h3><p className="detail-value">{livraison.admin_name}</p></div>
        {livraison.confirmed_by_commercial_at && <div className="detail-card"><h3>Confirmé le</h3><p className="detail-sub">{new Date(livraison.confirmed_by_commercial_at).toLocaleString('fr-FR')}</p></div>}
        {livraison.end_declared_at && <div className="detail-card"><h3>Terminé le</h3><p className="detail-sub">{new Date(livraison.end_declared_at).toLocaleString('fr-FR')}</p></div>}
      </div>

      {/* Original items table */}
      <div className="detail-section">
        <h2>Produits chargés</h2>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Produit</th><th>PU TTC</th><th>Qté</th><th>Total</th>{isEnCours || isEnRetour || isCloture ? <th>Vendu</th> : null}</tr></thead>
            <tbody>
              {livraison.items.map((item) => (
                <tr key={item.id}>
                  <td className="td-code">{item.product_id}</td>
                  <td>{item.product_name}</td>
                  <td className="td-price">{formatDT(item.prix_ttc)}</td>
                  <td className="td-qty">{item.qte_chargee}</td>
                  <td className="td-price">{formatDT(item.qte_chargee * Number(item.prix_ttc))}</td>
                  {(isEnCours || isEnRetour || isCloture) && <td className="td-qty">{item.qte_vendue}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="4"><strong>Total</strong></td><td className="td-price"><strong>{formatDT(computeTotal())}</strong></td>{(isEnCours || isEnRetour || isCloture) && <td></td>}</tr></tfoot>
          </table>
        </div>
      </div>

      {/* Confirm Sortie modal */}
      {showConfirmSortie && (
        <div className="modal-overlay" onClick={() => setShowConfirmSortie(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirmer le Bon de Sortie</h3>
            <div className="modal-summary">
              <p>Vous allez confirmer le bon de sortie :</p>
              <p className="summary-highlight">{livraison.reference}</p>
              <p>{livraison.items.length} produit(s) — Total: <strong>{formatDT(computeTotal())}</strong></p>
              <p className="confirm-note">Le stock sera déduit du dépôt après confirmation.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleConfirmSortie}>
              <div className="form-group"><label className="form-label">Mot de passe</label><input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmSortie(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : 'Confirmer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminer confirmation modal */}
      {showTerminer && (
        <div className="modal-overlay" onClick={() => setShowTerminer(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <h3 className="modal-title">Terminer la livraison</h3>
            <div className="modal-summary">
              <p>Vous allez terminer : <strong>{livraison.reference}</strong></p>
              <p>{livraison.items.length} produit(s) — CA estimé: <strong>{formatDT(ca)}</strong></p>
              <p>Commission (10%): {formatDT(commission)} | Net à reverser: {formatDT(net_a_reverser)}</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleTerminer}>
              <div className="form-group"><label className="form-label">Mot de passe</label><input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTerminer(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : 'Confirmer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmer Retour modal */}
      {showConfirmerRetour && (
        <div className="modal-overlay" onClick={() => setShowConfirmerRetour(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirmer le Bon de Retour</h3>
            <div className="modal-summary">
              <p><strong>{livraison.reference}</strong></p>
              <p>CA: {formatDT(ca)} | Commission: {formatDT(commission)} | Net: {formatDT(net_a_reverser)}</p>
              {isCloture && <p>Cette action clôturera définitivement la livraison.</p>}
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleConfirmerRetour}>
              <div className="form-group"><label className="form-label">Mot de passe</label><input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmerRetour(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : 'Confirmer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminer summary modal (after success) */}
      {terminerSummary && (
        <div className="modal-overlay" onClick={() => setTerminerSummary(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="modal-title">Résumé de la livraison</h3>
            <div className="table-container" style={{ marginBottom: '1rem' }}>
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead><tr><th>Produit</th><th>Chargé</th><th>Vendu</th><th>Retour</th><th>Montant</th></tr></thead>
                <tbody>
                  {terminerSummary.summary.map((s) => (
                    <tr key={s.product_id}>
                      <td>{s.product_name}</td><td>{s.qte_chargee}</td><td>{s.qte_vendue}</td><td>{s.qte_retour}</td><td className="td-price">{formatDT(s.montant_vendu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p><strong>CA Total:</strong> {formatDT(terminerSummary.ca_total)}</p>
            <p><strong>Commission (10%):</strong> {formatDT(terminerSummary.commission)}</p>
            <p><strong>Net à reverser:</strong> {formatDT(terminerSummary.net_a_reverser)}</p>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setTerminerSummary(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = { EN_ATTENTE_COMMERCIAL: 'En attente commercial', CONFIRME: 'Confirmé', EN_COURS: 'En cours', EN_RETOUR: 'En retour', CLOTURE: 'Clôturé' };
  const cls = { EN_ATTENTE_COMMERCIAL: 'badge-status-pending', EN_COURS: 'badge-status-active', EN_RETOUR: 'badge-status-warning', CLOTURE: 'badge-status-closed' }[status] || 'badge-status-info';
  return <span className={`badge ${cls}`}>{labels[status] || status}</span>;
}

export default LivraisonDetailPage;
