import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, openPdf } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/utils';
import { useCategoryPalette } from '../context/CategoryPaletteContext';
import StatusTimeline from '../components/StatusTimeline';
import './LivraisonsPage.css';

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
  const { getColor } = useCategoryPalette();
  const [livraison, setLivraison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTerminer, setShowTerminer] = useState(searchParams.get('action') === 'terminer');
  const [showTerminerPassword, setShowTerminerPassword] = useState(false);

  // Clean the ?action=terminer query param from the URL.
  // Called when the user explicitly dismisses the modal (cancel/backdrop)
  // or when the flow completes — never eagerly, or it races showTerminer.
  function cleanTerminerUrl() {
    if (searchParams.get('action')) {
      navigate(`/livraisons/${id}`, { replace: true });
    }
  }
  const [terminerSummary, setTerminerSummary] = useState(null);
  const [showConfirmerRetour, setShowConfirmerRetour] = useState(false);
  const [showConfirmSortie, setShowConfirmSortie] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showAnnulerDemande, setShowAnnulerDemande] = useState(false);
  const [showConfirmerAnnulation, setShowConfirmerAnnulation] = useState(false);
  const [showReouverture, setShowReouverture] = useState(false);
  const [showConfirmerReouverture, setShowConfirmerReouverture] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  // Retour création
  const [showRetourCreation, setShowRetourCreation] = useState(false);
  const [showConfirmerRetourCreation, setShowConfirmerRetourCreation] = useState(false);
  const [retourCreationReason, setRetourCreationReason] = useState('');
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Avances
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceAmount, setAvanceAmount] = useState('');
  const [avancePaymentMethod, setAvancePaymentMethod] = useState('ESPECES');
  const [avanceImage, setAvanceImage] = useState(null);
  const [avancePreview, setAvancePreview] = useState('');
  const [avanceError, setAvanceError] = useState('');
  const [refuseAvanceNote, setRefuseAvanceNote] = useState('');
  const [refusingAvanceId, setRefusingAvanceId] = useState(null);
  const [editingAvanceId, setEditingAvanceId] = useState(null);
  // Écarts
  const [showEcartModal, setShowEcartModal] = useState(false);
  const [ecartAmount, setEcartAmount] = useState('');
  const [ecartJustification, setEcartJustification] = useState('');
  const [ecartError, setEcartError] = useState('');
  const [confirmingEcartId, setConfirmingEcartId] = useState(null);

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
      setShowTerminerPassword(false);
      cleanTerminerUrl();
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
    openPdf(`/livraisons/${id}/bon-sortie/pdf`, id);
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

  // Reopen handlers
  async function handleDemanderReouverture(e) {
    e.preventDefault();
    setActionError('');
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/demander-reouverture`, { reason: reopenReason });
      setSuccess(data.message);
      setShowReouverture(false);
      setReopenReason('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmerReouverture(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/confirmer-reouverture`, { password });
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowConfirmerReouverture(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
      setPassword('');
    }
  }

  // Retour creation handlers

  async function handleDemanderRetourCreation(e) {
    e.preventDefault();
    setActionError('');
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/demander-retour-creation`, { reason: retourCreationReason });
      setSuccess(data.message);
      setShowRetourCreation(false);
      setRetourCreationReason('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmerRetourCreation(e) {
    e.preventDefault();
    setActionError('');
    if (!password) { setActionError('Mot de passe requis.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPut(`/livraisons/${id}/confirmer-retour-creation`, { password });
      setLivraison(data.livraison);
      setSuccess(data.message);
      setShowConfirmerRetourCreation(false);
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
        payment_method: avancePaymentMethod,
        image_base64: avancePreview || null,
      });
      setLivraison(prev => ({
        ...prev,
        avances: [data.avance, ...(prev.avances || [])],
      }));
      setSuccess(data.message);
      setShowAvanceModal(false);
      setAvanceAmount('');
      setAvancePaymentMethod('ESPECES');
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

  async function handleUpdateAvancePaymentMethod(avanceId, paymentMethod) {
    if (!paymentMethod) return;
    const prevAvance = (livraison?.avances || []).find(a => a.id === avanceId);
    // Optimistic update
    setLivraison(prev => ({
      ...prev,
      avances: prev.avances.map(a => a.id === avanceId ? { ...a, payment_method: paymentMethod } : a),
    }));
    setEditingAvanceId(null);
    try {
      await apiPut(`/livraisons/${id}/avances/${avanceId}/mode-paiement`, {
        payment_method: paymentMethod,
      });
    } catch (err) {
      // Revert on failure
      setLivraison(prev => ({
        ...prev,
        avances: prev.avances.map(a => a.id === avanceId ? { ...a, payment_method: prevAvance.payment_method } : a),
      }));
      setActionError(err.message);
    }
  }

  // Écarts handlers
  async function handleDeclarerEcart(e) {
    e.preventDefault();
    setEcartError('');
    const amount = parseFloat(ecartAmount);
    if (!amount || amount <= 0) { setEcartError('Montant invalide.'); return; }
    if (!ecartJustification.trim()) { setEcartError('La justification est obligatoire.'); return; }
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/ecarts`, {
        amount,
        justification: ecartJustification.trim(),
      });
      setLivraison(prev => ({ ...prev, ecarts: [data.ecart, ...(prev.ecarts || [])] }));
      setSuccess(data.message);
      setShowEcartModal(false);
      setEcartAmount('');
      setEcartJustification('');
    } catch (err) { setEcartError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleConfirmerEcart(ecartId, password) {
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/ecarts/${ecartId}/confirm`, { password });
      setLivraison(prev => ({
        ...prev,
        ecarts: prev.ecarts.map(e => e.id === ecartId ? data.ecart : e),
      }));
      setConfirmingEcartId(null);
      setPassword('');
      setSuccess(data.message);
    } catch (err) { setActionError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleRequestPaymentEcart(ecartId) {
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/ecarts/${ecartId}/request-payment`, {});
      setLivraison(prev => ({
        ...prev,
        ecarts: prev.ecarts.map(e => e.id === ecartId ? data.ecart : e),
      }));
      setSuccess(data.message);
    } catch (err) { setActionError(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleConfirmPaymentEcart(ecartId) {
    setSubmitting(true);
    try {
      const data = await apiPost(`/livraisons/${id}/ecarts/${ecartId}/confirm-payment`, {});
      setLivraison(prev => ({
        ...prev,
        ecarts: prev.ecarts.map(e => e.id === ecartId ? data.ecart : e),
      }));
      setSuccess(data.message);
    } catch (err) { setActionError(err.message); }
    finally { setSubmitting(false); }
  }


  if (error) return <div className="page-container"><div className="error-banner">{error}</div></div>;
  if (!loading && !livraison) return <div className="page-container"><div className="empty-state">Livraison introuvable.</div></div>;

  const isConfirme = livraison?.status === 'CONFIRME';
  const isEnCours = livraison?.status === 'EN_COURS';
  const isEnAttente = livraison?.status === 'EN_ATTENTE_COMMERCIAL';
  const isEnRetour = livraison?.status === 'EN_RETOUR';
  const isEnAttenteAnnulation = livraison?.status === 'EN_ATTENTE_ANNULATION';
  const isAnnule = livraison?.status === 'ANNULE';
  const isCloture = livraison?.status === 'CLOTURE';
  const isCommercial = user?.role === 'COMMERCIAL';
  const isAdmin = user?.role === 'DIRECTEUR_COMMERCIAL' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAssignedCommercial = isCommercial && livraison?.commercial_id === user?.id;
  const isSalaire = livraison?.commercial_remuneration_type === 'SALAIRE';
  const ca = computeCA();
  const commission = isSalaire ? 0 : Number((ca * 0.10).toFixed(3));
  const net_a_reverser = Number((ca - commission).toFixed(3));
  const totalAvances = (livraison?.avances || [])
    .filter(a => a.status === 'ACCEPTE')
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const resteAPayer = Number((net_a_reverser - totalAvances).toFixed(3));
  const adminConfirmed = livraison?.retour_confirmed_by_admin_at;
  const commercialConfirmed = livraison?.retour_confirmed_by_commercial_at;

  return (
    <div className="livraison-detail">
      {/* Brand Masthead with back link */}
      <div className="brand-masthead brand-masthead-compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/livraisons')}
            aria-label="Retour aux livraisons"
            style={{ color: '#9A9AA2', padding: 0, minWidth: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
              <path d="M9 2.5L4.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {!loading && livraison && (
            <>
              <h1 className="page-title" style={{ margin: 0 }}>{livraison.reference}</h1>
              <StatusBadge status={livraison.status} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!loading && isAdmin && (isEnCours || isEnRetour) && livraison?.confirmed_by_commercial_at && (
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/livraisons/${id}/realtime`)}>
              Suivre en temps réel
            </button>
          )}
          {!loading && isAdmin && livraison?.confirmed_by_commercial_at && (
            <button className="btn btn-outline btn-sm" onClick={handlePrintBonSortie}>
              Bon de Sortie
            </button>
          )}
          {!loading && user?.role === 'SUPER_ADMIN' && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowArchive(true)}>
              Archiver
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <>
          <div className="detail-grid">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        </>
      ) : livraison ? (
        <>
          {success && <div className="success-banner">{success}</div>}

      {/* Status Timeline */}
      <StatusTimeline livraison={livraison} />

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
          <button className="btn btn-primary" onClick={() => { setShowTerminer(true); setShowTerminerPassword(false); }}>
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

      {/* Commercial: En cours → Demander retour à la création */}
      {isEnCours && isAssignedCommercial && (
        <div className="alert-card" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning-border)' }}>
          <div className="alert-icon" style={{ background: 'var(--color-warning)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="alert-body">
            <strong>Retour à la création</strong>
            <p>Demandez le retour de la livraison à l'état "Création" (confirmé). Un admin devra confirmer. Les ventes déclarées seront conservées.</p>
          </div>
          <button className="btn btn-warning" onClick={() => { setShowRetourCreation(true); setRetourCreationReason(''); setActionError(''); }}>
            Retour à la création
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

      {/* Admin: En cours → Confirmer retour à la création */}
      {isEnCours && isAdmin && (
        <div className="detail-section">
          <button
            className="btn btn-warning btn-sm"
            onClick={() => { setShowConfirmerRetourCreation(true); setPassword(''); setActionError(''); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Confirmer le retour à la création (Admin)
          </button>
          {livraison?.return_reason && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              Motif du commercial : {livraison.return_reason}
            </p>
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
            Livraison annulée le {formatDateTime(livraison.closed_at)}. Le stock a été restauré.
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
                  <th>Mode</th>
                  <th>Statut</th>
                  <th>Preuve</th>
                  {(isSuperAdmin) && <th style={{ textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {livraison.avances.filter(a => a.status !== 'REFUSE').map((av) => {
                  const isPending = av.status === 'EN_ATTENTE';
                  const isAccepted = av.status === 'ACCEPTE';
                  return (
                    <tr key={av.id}>
                      <td style={{ fontSize: '0.85rem' }}>{formatDateTime(av.created_at)}</td>
                      <td className="td-price">{formatDT(av.amount)}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {isSuperAdmin ? (
                          editingAvanceId === av.id ? (
                            <select
                              className="form-input"
                              value={av.payment_method}
                              onChange={(e) => handleUpdateAvancePaymentMethod(av.id, e.target.value)}
                              onBlur={() => setEditingAvanceId(null)}
                              autoFocus
                              style={{ fontSize: '0.75rem', padding: '2px 6px', minWidth: '110px' }}
                            >
                              <option value="WAFA_CASH">Wafa Cash</option>
                              <option value="IZI_CASH">Izi Cash</option>
                              <option value="VERSEMENT">Versement</option>
                              <option value="ESPECES">Espèces</option>
                            </select>
                          ) : (
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '2px 0' }}
                              onClick={() => setEditingAvanceId(av.id)}
                              title="Modifier le mode de paiement"
                            >
                              {av.payment_method === 'WAFA_CASH' ? 'Wafa Cash' :
                               av.payment_method === 'IZI_CASH' ? 'Izi Cash' :
                               av.payment_method === 'VERSEMENT' ? 'Versement' :
                               av.payment_method === 'ESPECES' ? 'Espèces' : '—'}
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                                <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </span>
                          )
                        ) : (
                          <>{av.payment_method === 'WAFA_CASH' ? 'Wafa Cash' :
                             av.payment_method === 'IZI_CASH' ? 'Izi Cash' :
                             av.payment_method === 'VERSEMENT' ? 'Versement' :
                             av.payment_method === 'ESPECES' ? 'Espèces' : '—'}</>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isAccepted ? 'badge-ok' : 'badge-status-pending'}`}>
                          {isAccepted ? 'Acceptée' : 'En attente'}
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
                      {(isSuperAdmin) && (
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

      {/* Commercial: Déclarer une avance (CONFIRME → CLOTURE) */}
      {(isConfirme || isEnCours || isEnRetour || isCloture) && isAssignedCommercial && (
        <div className="detail-section">
          <button className="btn btn-outline-primary btn-sm" onClick={() => { setShowAvanceModal(true); setAvanceError(''); setAvanceAmount(''); setAvancePaymentMethod('ESPECES'); setAvanceImage(null); setAvancePreview(''); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Déclarer une avance
          </button>
        </div>
      )}

      {/* Écarts section */}
      {(isSuperAdmin || isAssignedCommercial) && (() => {
        const activeEcarts = (livraison.ecarts || []).filter(ec => ec.status !== 'PAID');
        const resolvedEcarts = (livraison.ecarts || []).filter(ec => ec.status === 'PAID');
        const hasAnyEcarts = (livraison.ecarts || []).length > 0;
        return (
        <div className="detail-section">
          <h2>Écarts{activeEcarts.length > 0 ? ` (${activeEcarts.length} actif${activeEcarts.length > 1 ? 's' : ''})` : ''}</h2>

          {hasAnyEcarts ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Justification</th>
                    <th>Déclaré par</th>
                    <th>Statut</th>
                    {(isAssignedCommercial || isSuperAdmin) && <th style={{textAlign:'center'}}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...activeEcarts, ...resolvedEcarts].map((ec, idx) => {
                    const isPending = ec.status === 'PENDING';
                    const isConfirmed = ec.status === 'CONFIRMED';
                    const isPaymentRequested = ec.status === 'PAYMENT_REQUESTED';
                    const isPaid = ec.status === 'PAID';
                    const isResolvedRow = isPaid;
                    // Show separator before first resolved écart
                    const showSeparator = isPaid && idx === activeEcarts.length;
                    return (
                    <>
                      {showSeparator && (
                        <tr className="ecart-separator-row">
                          <td colSpan={isAssignedCommercial || isSuperAdmin ? 6 : 5} style={{padding:'4px 0', border:'none'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 12px', background:'var(--color-success-bg)', borderRadius:4, fontSize:'0.8rem', color:'var(--color-success)', fontWeight:500}}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                              Résolu{resolvedEcarts.length > 1 ? `s (${resolvedEcarts.length})` : ''}
                            </div>
                          </td>
                        </tr>
                      )}
                    <tr key={ec.id} className={isResolvedRow ? 'row-ecart-resolved' : ''}>
                      <td style={{fontSize:'0.85rem'}}>{formatDateTime(ec.declared_at)}</td>
                      <td className="td-price" style={{color: isResolvedRow ? 'var(--color-text-muted)' : 'var(--color-danger)'}}>{formatDT(ec.amount)}</td>
                      <td style={{maxWidth:200, whiteSpace:'normal', fontSize:'0.85rem', color: isResolvedRow ? 'var(--color-text-muted)' : undefined}}>{ec.justification}</td>
                      <td style={{fontSize:'0.85rem', color: isResolvedRow ? 'var(--color-text-muted)' : undefined}}>{ec.declared_by_name}</td>
                      <td>
                        {isPending && <span className="badge badge-status-pending">En attente</span>}
                        {isConfirmed && <span className="badge badge-ok">Confirmé{ec.confirmed_at ? ` le ${formatDate(ec.confirmed_at)}` : ''}</span>}
                        {isPaymentRequested && <span className="badge badge-status-warning">Paiement en attente</span>}
                        {isPaid && <span className="badge badge-success-subtle">Payé{ec.payment_confirmed_at ? ` le ${formatDate(ec.payment_confirmed_at)}` : ''}</span>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {isAssignedCommercial && isPending && (
                          <button className="btn btn-primary btn-sm" onClick={() => setConfirmingEcartId(ec.id)}>
                            Confirmer
                          </button>
                        )}
                        {isAssignedCommercial && isConfirmed && (
                          <button className="btn btn-warning btn-sm" onClick={() => handleRequestPaymentEcart(ec.id)}
                            title="Marquer comme payé — l'admin devra confirmer la réception"
                            disabled={submitting}>
                            Payer
                          </button>
                        )}
                        {isSuperAdmin && isPaymentRequested && (
                          <button className="btn btn-success btn-sm" onClick={() => handleConfirmPaymentEcart(ec.id)}
                            disabled={submitting}>
                            Confirmer paiement
                          </button>
                        )}
                        {isAssignedCommercial && (isPaymentRequested || isPaid) && (
                          <span style={{fontSize:'0.8rem', color:'var(--color-text-muted)'}}>—</span>
                        )}
                        {isSuperAdmin && (isPending || isConfirmed) && (
                          <span style={{fontSize:'0.8rem', color:'var(--color-text-muted)'}}>—</span>
                        )}
                        {isSuperAdmin && isPaid && (
                          <span style={{fontSize:'0.8rem', color:'var(--color-text-muted)'}}>—</span>
                        )}
                      </td>
                    </tr>
                    </>
                  );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{color:'var(--color-text-muted)', fontSize:'0.9rem'}}>Aucun écart déclaré.</p>
          )}

          {/* SUPER_ADMIN: Declare button */}
          {isSuperAdmin && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => { setShowEcartModal(true); setEcartError(''); setEcartAmount(''); setEcartJustification(''); }}
              style={{marginTop:'var(--space-3)'}}
            >
              Déclarer un écart
            </button>
          )}
        </div>
      );})()}

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

          {(() => {
            const groupedItems = Object.entries(
              livraison.items.reduce((acc, item) => {
                const cat = item.category || 'Sans catégorie';
                (acc[cat] = acc[cat] || []).push(item);
                return acc;
              }, {})
            );

            return (
              <>
                {/* Desktop: full table */}
                <div className="table-container retour-table-view">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Catégorie</th>
                        <th>Article</th>
                        <th style={{ textAlign: 'center' }}>Qté Sortie</th>
                        <th style={{ textAlign: 'center' }}>Qté Vendue</th>
                        <th style={{ textAlign: 'center' }}>Qté Retour</th>
                        <th>PU TTC</th>
                        <th style={{ textAlign: 'right' }}>Montant Vendu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedItems.map(([cat, catItems]) => {
                        const catCol = getColor(cat);
                        return (
                        <Fragment key={cat}>
                          {catItems.map((item) => {
                            const qte_retour = item.qte_chargee - item.qte_vendue;
                            return (
                            <tr key={item.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                              <td className="td-code">{item.product_id}</td>
                              <td><span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{item.category || 'Sans catégorie'}</span></td>
                              <td>{item.product_name}</td>
                              <td className="td-qty">{item.qte_chargee}</td>
                              <td className="td-qty">{item.qte_vendue}</td>
                              <td className="td-qty">{qte_retour}</td>
                              <td className="td-price">{formatDT(item.prix_ttc)}</td>
                              <td className="td-price">{formatDT(item.qte_vendue * Number(item.prix_ttc))}</td>
                            </tr>
                            );
                          })}
                          <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                            <td colSpan="3" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>
                              Sous-total {cat}
                            </td>
                            <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_chargee, 0)}</td>
                            <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_vendue, 0)}</td>
                            <td className="td-qty">{catItems.reduce((s,i) => s + (i.qte_chargee - i.qte_vendue), 0)}</td>
                            <td></td>
                            <td className="td-price">{formatDT(catItems.reduce((s,i) => s + i.qte_vendue * Number(i.prix_ttc), 0))}</td>
                          </tr>
                        </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                {/* Commercial sees only the gross CA — never commission,
                    Net à reverser, or Reste à payer (net − avances would
                    reveal the commission by simple subtraction). */}
                <tr>
                  <td colSpan="7" style={{ textAlign: 'right' }}><strong>Total CA</strong></td>
                  <td className="td-price"><strong>{formatDT(ca)}</strong></td>
                </tr>
                {!isCommercial && !isSalaire && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'right' }}>Commission Commerciale (10%)</td>
                  <td className="td-price">{formatDT(commission)}</td>
                </tr>
                )}
                {isSalaire && !isCommercial && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'right', fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>Salaire mensuel — pas de commission</td>
                  <td className="td-price" style={{ color: 'var(--color-text-tertiary)' }}>—</td>
                </tr>
                )}
                {!isCommercial && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'right' }}><strong>Net à reverser au dépôt</strong></td>
                  <td className="td-price"><strong>{formatDT(net_a_reverser)}</strong></td>
                </tr>
                )}
                {totalAvances > 0 && (
                  <>
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'right', color: 'var(--color-primary)' }}>Avances acceptées</td>
                      <td className="td-price" style={{ color: 'var(--color-primary)' }}>{formatDT(totalAvances)}</td>
                    </tr>
                    {!isCommercial && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'right' }}><strong>Reste à payer</strong></td>
                      <td className="td-price"><strong>{formatDT(resteAPayer)}</strong></td>
                    </tr>
                    )}
                  </>
                )}
              </tfoot>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="retour-cards-view">
            {groupedItems.map(([cat, catItems]) => {
              const catCol = getColor(cat);
              return (
                <section className="load-cat-group" key={cat}>
                  <header className="load-cat-head">
                    <span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{cat}</span>
                    <span className="load-cat-count">{catItems.length} produit{catItems.length > 1 ? 's' : ''}</span>
                  </header>

                  {catItems.map((item) => {
                    const qte_retour = item.qte_chargee - item.qte_vendue;
                    return (
                    <article key={item.id} className="load-card" style={{ borderLeftColor: catCol.bar }}>
                      <div className="load-card-top">
                        <span className="load-card-name">{item.product_name}</span>
                        <span className="load-card-code">{item.product_id}</span>
                      </div>
                      <div className="load-card-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <div>
                          <span>Sortie</span>
                          <b>{item.qte_chargee}</b>
                        </div>
                        <div>
                          <span>Vendu</span>
                          <b>{item.qte_vendue}</b>
                        </div>
                        <div>
                          <span>Retour</span>
                          <b>{qte_retour}</b>
                        </div>
                        <div>
                          <span>Montant</span>
                          <b>{formatDT(item.qte_vendue * Number(item.prix_ttc))}</b>
                        </div>
                      </div>
                    </article>
                    );
                  })}

                  <div className="load-cat-subtotal" style={{ borderLeftColor: catCol.bar, background: catCol.bg }}>
                    <span style={{ color: catCol.text }}>Sous-total</span>
                    Sortie <b>{catItems.reduce((s, i) => s + i.qte_chargee, 0)}</b>
                    · Vendu <b>{catItems.reduce((s, i) => s + i.qte_vendue, 0)}</b>
                    · Retour <b>{catItems.reduce((s, i) => s + (i.qte_chargee - i.qte_vendue), 0)}</b>
                    · Montant <b>{formatDT(catItems.reduce((s, i) => s + i.qte_vendue * Number(i.prix_ttc), 0))}</b>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      );
    })()}

          <div className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="detail-card">
              <h3>Confirmation Admin</h3>
              {adminConfirmed ? (
                <span className="badge badge-ok">Confirmé le {formatDateTime(adminConfirmed)}</span>
              ) : (
                <span className="badge badge-status-pending">En attente</span>
              )}
            </div>
            <div className="detail-card">
              <h3>Confirmation Commercial</h3>
              {commercialConfirmed ? (
                <span className="badge badge-ok">Confirmé le {formatDateTime(commercialConfirmed)}</span>
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
            Livraison clôturée le {formatDateTime(livraison.closed_at)}
            {livraison.reopened_at && <> — Réouverte le {formatDateTime(livraison.reopened_at)}</>}
          </div>
          {isAssignedCommercial && (
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => { setShowReouverture(true); setReopenReason(''); setActionError(''); }}
              style={{ marginBottom: 'var(--space-4)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Demander la réouverture
            </button>
          )}
          {isAdmin && (
            <button
              className="btn btn-warning btn-sm"
              onClick={() => { setShowConfirmerReouverture(true); setPassword(''); setActionError(''); }}
              style={{ marginBottom: 'var(--space-4)', marginLeft: isAssignedCommercial ? 'var(--space-2)' : 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0, marginRight:'var(--space-1)'}}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Confirmer la réouverture (Admin)
            </button>
          )}
          <div className="detail-grid">
            <div className="detail-card"><h3>CA Total</h3><p className="detail-value">{formatDT(ca)}</p></div>
            {!isCommercial && !isSalaire && <div className="detail-card"><h3>Commission (10%)</h3><p className="detail-value">{formatDT(commission)}</p></div>}
            {isSalaire && !isCommercial && <div className="detail-card"><h3>Salaire</h3><p className="detail-value" style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: '0.85rem' }}>Mensuel fixe</p></div>}
            {!isCommercial && <div className="detail-card"><h3>Net à reverser</h3><p className="detail-value">{formatDT(net_a_reverser)}</p></div>}
            {totalAvances > 0 && (
              <>
                <div className="detail-card"><h3>Avances acceptées</h3><p className="detail-value" style={{ color: 'var(--color-primary)' }}>{formatDT(totalAvances)}</p></div>
                {!isCommercial && <div className="detail-card"><h3>Reste à payer</h3><p className="detail-value">{formatDT(resteAPayer)}</p></div>}
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
            <p className="detail-sub">{formatDateTime(livraison.confirmed_by_commercial_at)}</p>
          </div>
        )}
        {livraison.end_declared_at && (
          <div className="detail-card">
            <h3>Terminé le</h3>
            <p className="detail-sub">{formatDateTime(livraison.end_declared_at)}</p>
          </div>
        )}
      </div>

      {/* Original items table */}
      <div className="detail-section">
        <h2>Produits chargés</h2>
        {(() => {
          const showVendu = isEnCours || isEnRetour || isCloture;
          const groupedItems = Object.entries(
            livraison.items.reduce((acc, item) => {
              const cat = item.category || 'Sans catégorie';
              (acc[cat] = acc[cat] || []).push(item);
              return acc;
            }, {})
          );
          return (
            <>
              {/* Desktop: full table */}
              <div className="table-container load-table-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Catégorie</th>
                      <th>Produit</th>
                      <th>PU TTC</th>
                      <th style={{ textAlign: 'center' }}>Qté</th>
                      {showVendu && <th style={{ textAlign: 'center' }}>Vendu</th>}
                      <th style={{ textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems.map(([cat, catItems]) => {
                      const catCol = getColor(cat);
                      return (
                      <Fragment key={cat}>
                        {catItems.map((item) => (
                        <tr key={item.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                          <td className="td-code">{item.product_id}</td>
                          <td><span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{item.category || 'Sans catégorie'}</span></td>
                          <td>{item.product_name}</td>
                          <td className="td-price">{formatDT(item.prix_ttc)}</td>
                          <td className="td-qty">{item.qte_chargee}</td>
                          {showVendu && <td className="td-qty">{item.qte_vendue}</td>}
                          <td className="td-price">{formatDT(item.qte_chargee * Number(item.prix_ttc))}</td>
                        </tr>
                        ))}
                        <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                          <td colSpan="5" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>
                            Sous-total {cat}
                          </td>
                          <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_chargee, 0)}</td>
                          {showVendu && <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_vendue, 0)}</td>}
                          <td className="td-price" style={{ fontWeight: 700 }}>{formatDT(catItems.reduce((s,i) => s + i.qte_chargee * Number(i.prix_ttc), 0))}</td>
                        </tr>
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: card list (all content, no horizontal scroll) */}
              <div className="load-cards-view">
                {groupedItems.map(([cat, catItems]) => {
                  const catCol = getColor(cat);
                  return (
                    <section className="load-cat-group" key={cat}>
                      <header className="load-cat-head">
                        <span className="cat-pill" style={{ background: catCol.bg, color: catCol.text }}>{cat}</span>
                        <span className="load-cat-count">{catItems.length} produit{catItems.length > 1 ? 's' : ''}</span>
                      </header>

                      {catItems.map((item) => (
                        <article key={item.id} className="load-card" style={{ borderLeftColor: catCol.bar }}>
                          <div className="load-card-top">
                            <span className="load-card-name">{item.product_name}</span>
                            <span className="load-card-code">{item.product_id}</span>
                          </div>
                          <div className="load-card-stats">
                            <div>
                              <span>PU TTC</span>
                              <b>{formatDT(item.prix_ttc)}</b>
                            </div>
                            <div>
                              <span>Chargé</span>
                              <b>{item.qte_chargee}</b>
                            </div>
                            {showVendu && (
                              <div>
                                <span>Vendu</span>
                                <b>{item.qte_vendue}</b>
                              </div>
                            )}
                            <div>
                              <span>Montant</span>
                              <b>{formatDT(item.qte_chargee * Number(item.prix_ttc))}</b>
                            </div>
                          </div>
                        </article>
                      ))}

                      <div className="load-cat-subtotal" style={{ borderLeftColor: catCol.bar, background: catCol.bg }}>
                        <span style={{ color: catCol.text }}>Sous-total</span>
                        Chargé <b>{catItems.reduce((s, i) => s + i.qte_chargee, 0)}</b>
                        {showVendu && <> · Vendu <b>{catItems.reduce((s, i) => s + i.qte_vendue, 0)}</b></>}
                        · Montant <b>{formatDT(catItems.reduce((s, i) => s + i.qte_chargee * Number(i.prix_ttc), 0))}</b>
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          );
        })()}
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

      {/* Pre-terminer summary (step 1) */}
      {showTerminer && (
        <div className="modal-overlay" onClick={() => { setShowTerminer(false); cleanTerminerUrl(); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <h3 className="modal-title">Résumé avant clôture</h3>
            <p style={{ marginBottom: 'var(--space-3)' }}><strong>{livraison.reference}</strong></p>

            {/* Items table */}
            <div className="table-container" style={{ marginBottom: 'var(--space-4)', maxHeight: '280px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style={{ textAlign: 'center' }}>Qté vendue</th>
                    <th style={{ textAlign: 'right' }}>PU TTC</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    livraison.items.filter(i => i.qte_vendue > 0).reduce((acc, item) => {
                      const cat = item.category || 'Sans catégorie';
                      (acc[cat] = acc[cat] || []).push(item);
                      return acc;
                    }, {})
                  ).map(([cat, catItems]) => {
                    const catCol = getColor(cat);
                    return (
                      <Fragment key={cat}>
                        {catItems.map((item) => (
                          <tr key={item.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                            <td>{item.product_name}</td>
                            <td className="td-qty">{item.qte_vendue}</td>
                            <td className="td-price">{formatDT(item.prix_ttc)}</td>
                            <td className="td-price">{formatDT(item.qte_vendue * Number(item.prix_ttc))}</td>
                          </tr>
                        ))}
                        <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                          <td style={{ color: catCol.text, textAlign: 'right', fontWeight: 700 }}>
                            Sous-total {cat}
                          </td>
                          <td className="td-qty">{catItems.reduce((s, i) => s + i.qte_vendue, 0)}</td>
                          <td></td>
                          <td className="td-price" style={{ fontWeight: 700 }}>
                            {formatDT(catItems.reduce((s, i) => s + (i.qte_vendue * Number(i.prix_ttc)), 0))}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {livraison.items.filter(i => i.qte_vendue > 0).length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucune vente enregistrée</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial summary */}
            <div className="detail-grid" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="detail-card"><h3>CA Total</h3><p className="detail-value">{formatDT(ca)}</p></div>
              {!isCommercial && !isSalaire && <div className="detail-card"><h3>Commission (10%)</h3><p className="detail-value">{formatDT(commission)}</p></div>}
              {isSalaire && !isCommercial && <div className="detail-card"><h3>Salaire</h3><p className="detail-value" style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: '0.85rem' }}>Mensuel fixe</p></div>}
              {!isCommercial && <div className="detail-card"><h3>Net à reverser</h3><p className="detail-value">{formatDT(net_a_reverser)}</p></div>}
              {totalAvances > 0 && (
                <>
                  <div className="detail-card"><h3>Avances acceptées</h3><p className="detail-value" style={{ color: 'var(--color-primary)' }}>{formatDT(totalAvances)}</p></div>
                  {!isCommercial && <div className="detail-card"><h3>Reste à payer</h3><p className="detail-value">{formatDT(resteAPayer)}</p></div>}
                </>
              )}
            </div>

            {/* Ecarts summary */}
            {livraison.ecarts && livraison.ecarts.length > 0 && (() => {
              const pendingEcarts = livraison.ecarts.filter(e => e.status !== 'PAID' && e.status !== 'RESOLVED');
              const totalEcart = pendingEcarts.reduce((sum, e) => sum + Number(e.amount), 0);
              if (pendingEcarts.length === 0) return null;
              return (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger-border)' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-danger)' }}>Écarts non résolus : {formatDT(totalEcart)}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{pendingEcarts.length} écart(s) en attente</p>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowTerminer(false); cleanTerminerUrl(); }}>Annuler</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setShowTerminer(false); setShowTerminerPassword(true); setPassword(''); setActionError(''); }}
              >
                Confirmer et terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminer password confirmation (step 2) */}
      {showTerminerPassword && (
        <div className="modal-overlay" onClick={() => { setShowTerminerPassword(false); setShowTerminer(true); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">Confirmer la clôture</h3>
            <div className="modal-summary">
              <p>Vous allez terminer définitivement : <strong>{livraison.reference}</strong></p>
              <p>{isCommercial ? `CA: ${formatDT(ca)}` : `CA: ${formatDT(ca)} | Net à reverser: ${formatDT(net_a_reverser)}`}</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleTerminer}>
              <div className="form-group">
                <label className="form-label" htmlFor="terminer-password">Mot de passe</label>
                <input id="terminer-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowTerminerPassword(false); setShowTerminer(true); }}>Retour</button>
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
              {isCommercial
                ? <p>CA: {formatDT(ca)}</p>
                : <p>CA: {formatDT(ca)} | Commission: {formatDT(commission)} | Net: {formatDT(net_a_reverser)}</p>}
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
                  {terminerSummary.summary.map((s) => {
                      const cat = s.category || 'Sans catégorie';
                      return (
                    <tr key={s.product_id} style={{ background: getColor(cat).bg, borderLeftColor: getColor(cat).bar }}>
                      <td>{s.product_name}</td>
                      <td className="td-qty">{s.qte_chargee}</td>
                      <td className="td-qty">{s.qte_vendue}</td>
                      <td className="td-qty">{s.qte_retour}</td>
                      <td className="td-price">{formatDT(s.montant_vendu)}</td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p><strong>CA Total:</strong> {formatDT(terminerSummary.ca_total)}</p>
            {!isCommercial && !isSalaire && <p><strong>Commission (10%):</strong> {formatDT(terminerSummary.commission)}</p>}
            {isSalaire && !isCommercial && <p style={{ fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>Salaire mensuel — pas de commission</p>}
            {!isCommercial && <p><strong>Net à reverser:</strong> {formatDT(terminerSummary.net_a_reverser)}</p>}
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
                <label className="form-label" htmlFor="avance-method">Mode de paiement</label>
                <select
                  id="avance-method"
                  className="form-input"
                  value={avancePaymentMethod}
                  onChange={(e) => setAvancePaymentMethod(e.target.value)}
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="WAFA_CASH">Wafa Cash</option>
                  <option value="IZI_CASH">Izi Cash</option>
                  <option value="VERSEMENT">Versement</option>
                </select>
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

      {/* Demander réouverture modal (Commercial) */}
      {showReouverture && (
        <div className="modal-overlay" onClick={() => setShowReouverture(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Demander la réouverture</h3>
            <div className="modal-summary">
              <p>Vous demandez la réouverture de la livraison <strong>{livraison?.reference}</strong>.</p>
              <p>Un administrateur devra confirmer cette demande.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleDemanderReouverture}>
              <div className="form-group">
                <label className="form-label">Motif (optionnel)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Raison de la réouverture..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReouverture(false)} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '...' : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmer réouverture modal (Admin) */}
      {showConfirmerReouverture && (
        <div className="modal-overlay" onClick={() => setShowConfirmerReouverture(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Confirmer la réouverture</h3>
            <div className="modal-summary">
              <p>Vous allez rouvrir la livraison <strong>{livraison?.reference}</strong>.</p>
              <p>Le statut repassera à <strong>En cours</strong>. Le commercial pourra à nouveau déclarer des ventes.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleConfirmerReouverture}>
              <div className="form-group">
                <label className="form-label" htmlFor="reopen-password">Votre mot de passe *</label>
                <input
                  id="reopen-password"
                  type="password"
                  className="form-input"
                  placeholder="Mot de passe pour confirmer"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmerReouverture(false)} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '...' : 'Confirmer la réouverture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demander retour création modal (Commercial) */}
      {showRetourCreation && (
        <div className="modal-overlay" onClick={() => setShowRetourCreation(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Retour à la création</h3>
            <div className="modal-summary">
              <p>Vous demandez le retour de la livraison <strong>{livraison?.reference}</strong> à l'état "Création".</p>
              <p>Un administrateur devra confirmer cette demande. Les ventes déclarées seront conservées.</p>
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleDemanderRetourCreation}>
              <div className="form-group">
                <label className="form-label">Motif (optionnel)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Raison du retour à la création..."
                  value={retourCreationReason}
                  onChange={(e) => setRetourCreationReason(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRetourCreation(false)} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-warning" disabled={submitting}>
                  {submitting ? '...' : 'Envoyer la demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmer retour création modal (Admin) */}
      {showConfirmerRetourCreation && (
        <div className="modal-overlay" onClick={() => setShowConfirmerRetourCreation(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Confirmer le retour à la création</h3>
            <div className="modal-summary">
              <p>Vous allez retourner la livraison <strong>{livraison?.reference}</strong> à l'état <strong>Création (Confirmé)</strong>.</p>
              <p>Le commercial pourra à nouveau modifier les produits chargés. Les ventes déclarées seront conservées.</p>
              {livraison?.return_reason && (
                <p style={{ marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                  Motif du commercial : « {livraison.return_reason} »
                </p>
              )}
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={handleConfirmerRetourCreation}>
              <div className="form-group">
                <label className="form-label" htmlFor="retour-creation-password">Votre mot de passe *</label>
                <input
                  id="retour-creation-password"
                  type="password"
                  className="form-input"
                  placeholder="Mot de passe pour confirmer"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmerRetourCreation(false)} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-warning" disabled={submitting}>
                  {submitting ? '...' : 'Confirmer le retour à la création'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Déclarer écart modal */}
      {showEcartModal && (
        <div className="modal-overlay" onClick={() => setShowEcartModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <h3 className="modal-title">Déclarer un écart</h3>
            <div className="modal-summary">
              <p><strong>{livraison?.reference}</strong></p>
              <p>Commercial : {livraison?.commercial_name}</p>
            </div>
            {ecartError && <div className="login-error">{ecartError}</div>}
            <form onSubmit={handleDeclarerEcart}>
              <div className="form-group">
                <label className="form-label">Montant de l'écart (DT)</label>
                <input type="number" step="0.001" min="0.001" className="form-input"
                  value={ecartAmount} onChange={e => setEcartAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Justification *</label>
                <textarea className="form-input" rows={3} placeholder="Raison de l'écart..."
                  value={ecartJustification} onChange={e => setEcartJustification(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEcartModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? '...' : "Déclarer l'écart"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmer écart modal (COMMERCIAL) */}
      {confirmingEcartId && (
        <div className="modal-overlay" onClick={() => { setConfirmingEcartId(null); setPassword(''); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Confirmer l'écart</h3>
            <div className="modal-summary">
              <p>En confirmant, vous reconnaissez cet écart comme étant dû.</p>
              {(() => {
                const ec = livraison?.ecarts?.find(e => e.id === confirmingEcartId);
                return ec ? <p style={{color:'var(--color-danger)'}}>Montant : <strong>{formatDT(ec.amount)}</strong></p> : null;
              })()}
            </div>
            {actionError && <div className="login-error">{actionError}</div>}
            <form onSubmit={e => { e.preventDefault(); handleConfirmerEcart(confirmingEcartId, password); }}>
              <div className="form-group">
                <label className="form-label">Votre mot de passe</label>
                <input type="password" className="form-input" value={password}
                  onChange={e => setPassword(e.target.value)} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setConfirmingEcartId(null); setPassword(''); }}>Annuler</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? '...' : "Confirmer l'écart"}
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
