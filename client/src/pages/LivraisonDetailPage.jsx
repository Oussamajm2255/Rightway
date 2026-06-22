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

  if (loading) {
    return (
      <div className="livraison-detail">
        <div className="page-header">
          <div><h1 className="page-title skeleton skeleton-heading" /></div>
        </div>
        <div className="detail-grid">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }
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
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/livraisons')} style={{ marginBottom: 'var(--space-4)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <path d="M9 2.5L4.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour aux livraisons
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{livraison.reference}</h1>
          <p className="page-subtitle">Créée le {new Date(livraison.created_at).toLocaleString('fr-FR')}</p>
        </div>
        <StatusBadge status={livraison.status} />
      </div>

      {success && <div className="success-banner">{success}</div>}

      {/* Status Timeline */}
      <div className="status-timeline">
        {[
          { label: 'Créé', date: livraison.created_at, done: true },
          { label: 'Confirmé', date: livraison.confirmed_by_commercial_at, done: !!livraison.confirmed_by_commercial_at },
          { label: 'En cours', date: null, done: isEnCours || isEnRetour || isCloture },
          { label: 'Retour', date: livraison.end_declared_at, done: isEnRetour || isCloture },
          { label: 'Clôturé', date: livraison.closed_at, done: isCloture },
        ].map((s, i, arr) => (
          <span key={s.label} className={`timeline-step ${s.done ? 'current' : ''}`}>
            <span className={`timeline-dot ${s.done ? (isCloture || (i < arr.length - 1 && arr[i+1].done) ? 'done' : 'active') : ''}`} />
            <span className="timeline-label">{s.label}</span>
            {i < arr.length - 1 && <span className={`timeline-line ${arr[i+1].done ? 'done' : ''}`} />}
          </span>
        ))}
      </div>

      {/* Commercial: En attente → Confirm sortie */}
      {isEnAttente && isAssignedCommercial && (
        <div className="alert-card">
          <div className="alert-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
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
          <div className="alert-icon" style={{ background: 'var(--color-primary)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M2 17h16M6 17V6l4-4h8v15" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="7" cy="20" r="2" />
              <circle cx="17" cy="20" r="2" />
            </svg>
          </div>
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
        <div className="alert-card" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)' }}>
          <div className="alert-icon" style={{ background: 'var(--color-success)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
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
                  <th style={{ textAlign: 'center' }}>Qté Sortie</th>
                  <th style={{ textAlign: 'center' }}>Qté Vendue</th>
                  <th style={{ textAlign: 'center' }}>Qté Retour</th>
                  <th>PU TTC</th>
                  <th style={{ textAlign: 'right' }}>Montant Vendu</th>
                </tr>
              </thead>
              <tbody>
                {livraison.items.map((item) => {
                  const qte_retour = item.qte_chargee - item.qte_vendue;
                  return (
                    <tr key={item.id}>
                      <td className="td-code">{item.product_id}</td>
                      <td>{item.product_name}</td>
                      <td className="td-qty">{item.qte_chargee}</td>
                      <td className="td-qty">{item.qte_vendue}</td>
                      <td className={`td-qty ${qte_retour > 0 ? '' : ''}`}>{qte_retour}</td>
                      <td className="td-price">{formatDT(item.prix_ttc)}</td>
                      <td className="td-price">{formatDT(item.qte_vendue * Number(item.prix_ttc))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: 'right' }}><strong>Total CA</strong></td>
                  <td className="td-price"><strong>{formatDT(ca)}</strong></td>
                </tr>
                <tr>
                  <td colSpan="6" style={{ textAlign: 'right' }}>Commission Commerciale (10%)</td>
                  <td className="td-price">{formatDT(commission)}</td>
                </tr>
                <tr>
                  <td colSpan="6" style={{ textAlign: 'right' }}><strong>Net à reverser au dépôt</strong></td>
                  <td className="td-price"><strong>{formatDT(net_a_reverser)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
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

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
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
          <div className="success-banner" style={{ marginBottom: 'var(--space-4)' }}>
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
        <div className="detail-card">
          <h3>Commercial</h3>
          <p className="detail-value">{livraison.commercial_name}</p>
          <p className="detail-sub">{livraison.vehicle_name} — {livraison.vehicle_plate}</p>
        </div>
        <div className="detail-card">
          <h3>Créé par</h3>
          <p className="detail-value">{livraison.admin_name}</p>
        </div>
        {livraison.confirmed_by_commercial_at && (
          <div className="detail-card">
            <h3>Confirmé le</h3>
            <p className="detail-sub">{new Date(livraison.confirmed_by_commercial_at).toLocaleString('fr-FR')}</p>
          </div>
        )}
        {livraison.end_declared_at && (
          <div className="detail-card">
            <h3>Terminé le</h3>
            <p className="detail-sub">{new Date(livraison.end_declared_at).toLocaleString('fr-FR')}</p>
          </div>
        )}
      </div>

      {/* Original items table */}
      <div className="detail-section">
        <h2>Produits chargés</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Produit</th>
                <th>PU TTC</th>
                <th style={{ textAlign: 'center' }}>Qté</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                {(isEnCours || isEnRetour || isCloture) && <th style={{ textAlign: 'center' }}>Vendu</th>}
              </tr>
            </thead>
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
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right' }}><strong>Total</strong></td>
                <td className="td-price"><strong>{formatDT(computeTotal())}</strong></td>
                {(isEnCours || isEnRetour || isCloture) && <td></td>}
              </tr>
            </tfoot>
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
              <div className="form-group">
                <label className="form-label" htmlFor="sortie-password">Mot de passe</label>
                <input id="sortie-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
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
              <div className="form-group">
                <label className="form-label" htmlFor="terminer-password">Mot de passe</label>
                <input id="terminer-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
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
              <div className="form-group">
                <label className="form-label" htmlFor="retour-password">Mot de passe</label>
                <input id="retour-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
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
            <div className="table-container" style={{ marginBottom: 'var(--space-4)' }}>
              <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style={{ textAlign: 'center' }}>Chargé</th>
                    <th style={{ textAlign: 'center' }}>Vendu</th>
                    <th style={{ textAlign: 'center' }}>Retour</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {terminerSummary.summary.map((s) => (
                    <tr key={s.product_id}>
                      <td>{s.product_name}</td>
                      <td className="td-qty">{s.qte_chargee}</td>
                      <td className="td-qty">{s.qte_vendue}</td>
                      <td className="td-qty">{s.qte_retour}</td>
                      <td className="td-price">{formatDT(s.montant_vendu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p><strong>CA Total:</strong> {formatDT(terminerSummary.ca_total)}</p>
            <p><strong>Commission (10%):</strong> {formatDT(terminerSummary.commission)}</p>
            <p><strong>Net à reverser:</strong> {formatDT(terminerSummary.net_a_reverser)}</p>
            <div className="modal-actions" style={{ marginTop: 'var(--space-4)' }}>
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
