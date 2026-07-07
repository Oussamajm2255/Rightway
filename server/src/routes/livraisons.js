const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { signDownloadToken } = require('../utils/jwt');
const pool = require('../db/pool');
const {
  createLivraison,
  listLivraisons,
  getLivraison,
  confirmSortie,
  getSales,
  recordSale,
  syncOfflineSales,
  terminerLivraison,
  confirmerRetour,
  downloadBonSortiePDF,
  downloadBonRetourPDF,
  downloadDossierPDF,
  getDossier,
  archiveLivraison,
  demanderAnnulation,
  confirmerAnnulation,
  demanderReouverture,
  confirmerReouverture,
  demanderRetourCreation,
  confirmerRetourCreation,
  declarerAvance,
  getAvances,
  accepterAvance,
  refuserAvance,
  modifierAvancePaiement,
  realtimeData,
  declarerEcart,
  listEcarts,
  confirmerEcart,
  requestPaymentEcart,
  confirmPaymentEcart,
} = require('../controllers/livraisons');

router.use(authenticate);

// Validate download token scope: dtokens are bound to a specific livraison ID
function ensureDownloadTokenScope(req, res, next) {
  if (req.downloadTokenLivraisonId && req.downloadTokenLivraisonId !== req.params.id) {
    return res.status(403).json({ error: 'Token de téléchargement invalide pour cette livraison.' });
  }
  next();
}

// Ownership guard: restricts per-livraison access by role.
//  - Download tokens are their own auth mechanism (scope-checked separately)
//  - SUPER_ADMIN and DIRECTEUR_COMMERCIAL: unrestricted
//  - COMMERCIAL: only their own livraisons
//  - MAGASINIER: only unfinished livraisons from the last 5 days
async function requireLivraisonOwnership(req, res, next) {
  if (req.downloadTokenLivraisonId) return next();
  const role = req.user.role;
  if (role === 'SUPER_ADMIN' || role === 'DIRECTEUR_COMMERCIAL') return next();
  try {
    const { rows } = await pool.query(
      'SELECT commercial_id, status, created_at FROM livraisons WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Livraison introuvable.' });
    }
    if (role === 'COMMERCIAL') {
      if (rows[0].commercial_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
      return next();
    }
    if (role === 'MAGASINIER') {
      const finished = ['CLOTURE', 'ANNULE'].includes(rows[0].status);
      const tooOld = (Date.now() - new Date(rows[0].created_at).getTime()) > 5 * 24 * 3600 * 1000;
      if (finished || tooOld) return res.status(403).json({ error: 'Accès refusé.' });
      return next();
    }
    return next();
  } catch (err) {
    console.error('requireLivraisonOwnership error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

router.post('/', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), createLivraison);
router.get('/', listLivraisons);
router.get('/:id', requireLivraisonOwnership, getLivraison);
router.put('/:id/confirm-sortie', authorize('COMMERCIAL'), confirmSortie);

// Archive (SUPER_ADMIN only)
router.put('/:id/archive', authorize('SUPER_ADMIN'), archiveLivraison);

// Annulation flow: commercial requests → directeur confirms
router.put('/:id/demander-annulation', authorize('COMMERCIAL'), demanderAnnulation);
router.put('/:id/confirmer-annulation', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), confirmerAnnulation);

// Reopen flow: commercial requests → directeur confirms (Cloture → EN_COURS)
router.post('/:id/demander-reouverture', authorize('COMMERCIAL'), demanderReouverture);
router.put('/:id/confirmer-reouverture', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), confirmerReouverture);

// Retour creation flow: commercial requests → directeur confirms (EN_COURS → CONFIRME)
router.put('/:id/demander-retour-creation', authorize('COMMERCIAL'), demanderRetourCreation);
router.put('/:id/confirmer-retour-creation', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), confirmerRetourCreation);

// Avances (advance payments during EN_COURS)
router.post('/:id/avances', authorize('COMMERCIAL'), declarerAvance);
router.get('/:id/avances', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL'), requireLivraisonOwnership, getAvances);
router.put('/:id/avances/:avanceId/accepter', authorize('SUPER_ADMIN'), accepterAvance);
router.put('/:id/avances/:avanceId/refuser', authorize('SUPER_ADMIN'), refuserAvance);
router.put('/:id/avances/:avanceId/mode-paiement', authorize('SUPER_ADMIN'), modifierAvancePaiement);

// Ecarts (discrepancy declarations)
router.post('/:id/ecarts', authorize('SUPER_ADMIN'), declarerEcart);
router.get('/:id/ecarts', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL'), requireLivraisonOwnership, listEcarts);
router.post('/:id/ecarts/:ecartId/confirm', authorize('COMMERCIAL'), confirmerEcart);
router.post('/:id/ecarts/:ecartId/request-payment', authorize('COMMERCIAL'), requestPaymentEcart);
router.post('/:id/ecarts/:ecartId/confirm-payment', authorize('SUPER_ADMIN'), confirmPaymentEcart);

// Real-time monitoring route
router.get('/:id/realtime', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL'), requireLivraisonOwnership, realtimeData);

// Sales routes
router.get('/:id/sales', authorize('COMMERCIAL'), getSales);
router.post('/:id/sales', authorize('COMMERCIAL'), recordSale);
router.post('/:id/sales/sync', authorize('COMMERCIAL'), syncOfflineSales);

// End & Retour routes
router.put('/:id/terminer', authorize('COMMERCIAL'), terminerLivraison);
router.put('/:id/confirmer-retour', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'COMMERCIAL'), confirmerRetour);

// PDF routes — ownership + download token scope must match the requested livraison
router.get('/:id/bon-sortie/pdf', requireLivraisonOwnership, ensureDownloadTokenScope, downloadBonSortiePDF);
router.get('/:id/bon-retour/pdf', requireLivraisonOwnership, ensureDownloadTokenScope, downloadBonRetourPDF);
router.get('/:id/dossier/pdf', requireLivraisonOwnership, ensureDownloadTokenScope, downloadDossierPDF);
router.get('/:id/dossier', requireLivraisonOwnership, ensureDownloadTokenScope, getDossier);

// PDF download token — generates short-lived token for window.open() PDFs
router.get('/:id/pdf-token', authenticate, (req, res) => {
  const livraisonId = req.params.id;
  const token = signDownloadToken(req.user.id, livraisonId);
  res.json({ token });
});

module.exports = router;
