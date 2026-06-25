import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  const [showArchive, setShowArchive] = useState(false);
  const [showAnnulerDemande, setShowAnnulerDemande] = useState(false);
  const [showConfirmerAnnulation, setShowConfirmerAnnulation] = useState(false);
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Avances
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceAmount, setAvanceAmount] = useState('');
  const [avanceImage, setAvanceImage] = useState(null);
  const [avancePreview, setAvancePreview] = useState('');
  const [avanceError, setAvanceError] = useState('');
  const [refuseAvanceNote, setRefuseAvanceNote] = useState('');
  const [refusingAvanceId, setRefusingAvanceId] = useState(null);

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
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowConfirmSortie(false);
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
      setLivraison(data.livraison);
      setTerminerSummary(data);
      setShowTerminer(false);
      setSuccess(data.message);
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
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowConfirmerRetour(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  function handlePrintBonSortie() {
    const token = localStorage.getItem('rightway_token');
    window.open(`${API_BASE}/livraisons/${id}/bon-sortie/pdf?token=${encodeURIComponent(token)}`, '_blank');
  }

  async function handleArchive(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/archive`, { password });
      setSuccess(data.message);
      setShowArchive(false);
      setTimeout(() => navigate('/livraisons'), 800);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  async function handleDemanderAnnulation(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/demander-annulation`, { password });
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowAnnulerDemande(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  async function handleConfirmerAnnulation(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/confirmer-annulation`, { password });
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowConfirmerAnnulation(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  // Avances handlers
  function handleAvanceFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAvanceError('Image trop volumineuse (max 5 Mo).'); return; }
    setAvanceImage(file);
    const reader = new FileReader();
    reader.onload = () => setAvancePreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleDeclarerAvance(e) {
    e.preventDefault();
    setAvanceError('');
    const amount = parseFloat(avanceAmount);
    if (!amount || amount <= 0) { setAvanceError('Veuillez entrer un montant valide.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/avances`, {
        amount,
        image_base64: avancePreview || null,
      });
      setLivraison(prev => ({
        ...prev,
        avances: [data.avance, ...(prev.avances || [])],
      }));
      setSuccess(data.message);
      setShowAvanceModal(false);
      setAvanceAmount('');
      setAvanceImage(null);
      setAvancePreview('');
    } catch (err) {
      setAvanceError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccepterAvance(avanceId) {
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/avances/${avanceId}/accepter`, {});
      setLivraison(prev => ({
        ...prev,
        avances: prev.avances.map(a => a.id === avanceId ? data.avance : a),
      }));
      setSuccess(data.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefuserAvance(avanceId) {
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/avances/${avanceId}/refuser`, { note: refuseAvanceNote });
      setLivraison(prev => ({
        ...prev,
        avances: prev.avances.map(a => a.id === avanceId ? data.avance : a),
      }));
      setRefuseAvanceNote('');
      setRefusingAvanceId(null);
      setSuccess(data.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }


  if (error) return <div className="page-container"><div className="error-banner">{error}</div></div>;
  if (!loading && !livraison) return <div className="page-container"><div className="empty-state">Livraison introuvable.</div></div>;

  const isEnCours = livraison?.status === 'EN_COURS';
  const isEnAttente = livraison?.status === 'EN_ATTENTE_COMMERCIAL';
  const isEnRetour = livraison?.status === 'EN_RETOUR';
  const isEnAttenteAnnulation = livraison?.status === 'EN_ATTENTE_ANNULATION';
  const isAnnule = livraison?.status === 'ANNULE';
  const isCloture = livraison?.status === 'CLOTURE';
  const isCommercial = user?.role === 'COMMERCIAL';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAssignedCommercial = isCommercial && livraison?.commercial_id === user?.id;
  const ca = computeCA();
  const commission = Number((ca * 0.10).toFixed(3));
  const net_a_reverser = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison?.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net_a_reverser - totalAvances).toFixed(3));
  const adminConfirmed = livraison?.retour_confirmed_by_admin_at;
  const commercialConfirmed = livraison?.retour_confirmed_by_commercial_at;

  return (
    <div className="livraison-detail">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/livraisons')} style={{ marginBottom: 'var(--space-4)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
          <path d="M9 2.5L4.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Retour aux livraisons
      </button>

      {!loading && isAdmin && livraison?.confirmed_by_commercial_at && (
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={handlePrintBonSortie}
          style={{ marginBottom: 'var(--space-4)', marginLeft: 'var(--space-2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
            <path d="M4 1.5h6a1 1 0 011 1V5h1a1 1 0 011 1v4a1 1 0 01-1 1h-1v2.5H3V11H2a1 1 0 01-1-1V6a1 1 0 011-1h1V2.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 5.5h4M5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Bon de Sortie
        </button>
      )}

      {!loading && user?.role === 'SUPER_ADMIN' && (
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => setShowArchive(true)}
          style={{ marginBottom: 'var(--space-4)', marginLeft: 'var(--space-2)' }}
        >
          Archiver
        </button>
      )}

      {loading ? (
        <>
          <div className="page-header">
            <div><h1 className="page-title skeleton skeleton-heading" /></div>
          </div>
          <div className="detail-grid">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        </>
      ) : livraison ? (
        <>
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
          { label: 'En cours', date: null, done: isEnCours || isEnRetour || isEnAttenteAnnulation || isAnnule || isCloture },
          { label: 'Retour', date: livraison.end_declared_at, done: isEnRetour || isAnnule || isCloture },
          { label: isAnnule ? 'Annulé' : 'Clôturé', date: livraison.closed_at, done: isAnnule || isCloture },
        ].map((s, i, arr) => (
          <span key={s.label} className={`timeline-step ${s.done ? 'current' : ''}`}>
            <span className={`timeline-dot ${s.done ? ((isCloture || isAnnule) || (i < arr.length - 1 && arr[i+1].done) ? 'done' : 'active') : ''}`} />
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

      {/* Commercial: En cours → Demander annulation */}
      {isEnCours && isAssignedCommercial && (
        <div className="alert-card" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)' }}>
          <div className="alert-icon" style={{ background: 'var(--color-danger)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="alert-body">
            <strong>Annuler la livraison</strong>
            <p>Demandez l'annulation. Un admin devra confirmer. Le stock sera restauré.</p>
          </div>
          <button className="btn btn-danger" onClick={() => setShowAnnulerDemande(true)}>
            Annuler la livraison
          </button>
        </div>
      )}

      {/* EN_ATTENTE_ANNULATION — Admin must confirm */}
      {isEnAttenteAnnulation && (
        <div className="detail-section">
          <div className="yellow-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-2)'}}>
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Demande d'annulation en attente de confirmation par l'Admin.
            {isAssignedCommercial && ' Vous serez notifié après confirmation.'}
          </div>
          {isAdmin && (
            <button className="btn btn-danger" onClick={() => setShowConfirmerAnnulation(true)} style={{ marginTop: 'var(--space-3)' }}>
              Confirmer l'annulation (Admin)
            </button>
          )}
        </div>
      )}

      {/* ANNULE */}
      {isAnnule && (
        <div className="detail-section">
          <div className="success-banner" style={{ marginBottom: 'var(--space-4)', background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-2)'}}>
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
            </svg>
            Livraison annulée le {new Date(livraison.closed_at).toLocaleString('fr-FR')}. Le stock a été restauré.
          </div>
        </div>
      )}

      {/* Avances section */}
      {livraison.avances && livraison.avances.length > 0 && (
        <div className="detail-section">
          <h2>Avances</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Preuve</th>
                  {(isAdmin) && <th style={{ textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {livraison.avances.map((av) => {
                  const isPending = av.status === 'EN_ATTENTE';
                  const isAccepted = av.status === 'ACCEPTE';
                  const isRefused = av.status === 'REFUSE';
                  return (
                    <tr key={av.id}>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(av.created_at).toLocaleString('fr-FR')}</td>
                      <td className="td-price">{formatDT(av.amount)}</td>
                      <td>
                        <span className={`badge ${isAccepted ? 'badge-ok' : isRefused ? 'badge-danger' : 'badge-status-pending'}`}>
                          {isAccepted ? 'Acceptée' : isRefused ? 'Refusée' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        {av.image_base64 ? (
                          <img
                            src={av.image_base64}
                            alt="Preuve de paiement"
                            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                            onClick={() => window.open(av.image_base64, '_blank')}
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      {(isAdmin) && (
                        <td style={{ textAlign: 'center' }}>
                          {isPending && refusingAvanceId !== av.id && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleAccepterAvance(av.id)} disabled={submitting}>
                                Accepter
                              </button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => { setRefusingAvanceId(av.id); setRefuseAvanceNote(''); }}>
                                Refuser
                              </button>
                            </div>
                          )}
                          {isPending && refusingAvanceId === av.id && (
                            <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Motif (optionnel)"
                                value={refuseAvanceNote}
                                onChange={(e) => setRefuseAvanceNote(e.target.value)}
                                style={{ width: 120, fontSize: '0.8rem', padding: 'var(--space-1) var(--space-2)' }}
                              />
                              <button className="btn btn-danger btn-sm" onClick={() => handleRefuserAvance(av.id)} disabled={submitting}>
                                Confirmer
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setRefusingAvanceId(null)}>Annuler</button>
                            </div>
                          )}
                          {isRefused && av.admin_note && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{av.admin_note}</span>
                          )}
                          {isAccepted && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commercial: En cours → Déclarer une avance */}
      {isEnCours && isAssignedCommercial && (
        <div className="detail-section">
          <button className="btn btn-outline-primary btn-sm" onClick={() => { setShowAvanceModal(true); setAvanceError(''); setAvanceAmount(''); setAvanceImage(null); setAvancePreview(''); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Déclarer une avance
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
                {totalAvances > 0 && (
                  <>
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'right', color: 'var(--color-primary)' }}>Avances acceptées</td>
                      <td className="td-price" style={{ color: 'var(--color-primary)' }}>{formatDT(totalAvances)}</td>
                    </tr>
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'right' }}><strong>Reste à payer</strong></td>
                      <td className="td-price"><strong>{formatDT(resteAPayer)}</strong></td>
                    </tr>
                  </>
                )}
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
            {totalAvances > 0 && (
              <>
                <div className="detail-card"><h3>Avances acceptées</h3><p className="detail-value" style={{ color: 'var(--color-primary)' }}>{formatDT(totalAvances)}</p></div>
                <div className="detail-card"><h3>Reste à payer</h3><p className="detail-value">{formatDT(resteAPayer)}</p></div>
              </>
            )}
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

      {/* Demander annulation modal */}
      {showAnnulerDemande && (
        <div className="modal-overlay" onClick={() => setShowAnnulerDemande(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Demander l'annulation</h3>
            <div className="modal-summary">
              <p><strong>{livraison?.reference}</strong></p>
              <p>L'annulation doit être confirmée par un Admin. Le stock sera restauré.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleDemanderAnnulation}>
              <div className="form-group">
                <label className="form-label" htmlFor="annuler-password">Votre mot de passe</label>
                <input id="annuler-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAnnulerDemande(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>{submitting ? '...' : 'Confirmer la demande'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmer annulation modal (Admin) */}
      {showConfirmerAnnulation && (
        <div className="modal-overlay" onClick={() => setShowConfirmerAnnulation(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirmer l'annulation</h3>
            <div className="modal-summary">
              <p><strong>{livraison?.reference}</strong></p>
              <p>Le stock sera restauré et la livraison sera définitivement annulée.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleConfirmerAnnulation}>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmer-annulation-password">Votre mot de passe</label>
                <input id="confirmer-annulation-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmerAnnulation(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>{submitting ? '...' : 'Confirmer l\'annulation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {showArchive && (
        <div className="modal-overlay" onClick={() => setShowArchive(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Archiver la livraison</h3>
            <div className="modal-summary">
              <p><strong>{livraison?.reference}</strong></p>
              <p>Cette action masquera la livraison des listes sans supprimer les données.</p>
            </div>
            <div className="modal-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
                <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Cette action est réversible uniquement par un Super Admin.
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleArchive}>
              <div className="form-group">
                <label className="form-label" htmlFor="archive-password">Votre mot de passe</label>
                <input id="archive-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowArchive(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>{submitting ? '...' : 'Confirmer l\'archivage'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Déclarer une avance modal */}
      {showAvanceModal && (
        <div className="modal-overlay" onClick={() => setShowAvanceModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Déclarer une avance</h3>
            <div className="modal-summary">
              <p>Déclarez un montant envoyé à l'administration comme avance sur cette livraison.</p>
            </div>
            {avanceError && <div className="login-error">{avanceError}</div>}
            <form onSubmit={handleDeclarerAvance}>
              <div className="form-group">
                <label className="form-label" htmlFor="avance-amount">Montant (DT)</label>
                <input
                  id="avance-amount"
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="form-input"
                  placeholder="Ex: 150.000"
                  value={avanceAmount}
                  onChange={(e) => setAvanceAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preuve de paiement (image)</label>
                <div
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 8,
                    padding: avancePreview ? 'var(--space-2)' : 'var(--space-6)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--color-bg-secondary)',
                  }}
                  onClick={() => document.getElementById('avance-file').click()}
                >
                  {avancePreview ? (
                    <img
                      src={avancePreview}
                      alt="Aperçu"
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
                    />
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 'var(--space-2)' }}>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p style={{ fontSize: '0.85rem' }}>Cliquez pour sélectionner une image</p>
                      <p style={{ fontSize: '0.75rem' }}>PNG, JPG — Max 5 Mo</p>
                    </div>
                  )}
                </div>
                <input
                  id="avance-file"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvanceFileChange}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAvanceModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '...' : 'Déclarer l\'avance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = { EN_ATTENTE_COMMERCIAL: 'En attente commercial', CONFIRME: 'Confirmé', EN_COURS: 'En cours', EN_RETOUR: 'En retour', EN_ATTENTE_ANNULATION: 'Annulation demandée', ANNULE: 'Annulé', CLOTURE: 'Clôturé' };
  const cls = { EN_ATTENTE_COMMERCIAL: 'badge-status-pending', EN_COURS: 'badge-status-active', EN_RETOUR: 'badge-status-warning', EN_ATTENTE_ANNULATION: 'badge-status-warning', ANNULE: 'badge-status-closed', CLOTURE: 'badge-status-closed' }[status] || 'badge-status-info';
  return <span className={`badge ${cls}`}>{labels[status] || status}</span>;
}

export default LivraisonDetailPage;
