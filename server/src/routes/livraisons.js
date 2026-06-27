const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { signDownloadToken } = require('../utils/jwt');
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
  declarerAvance,
  getAvances,
  accepterAvance,
  refuserAvance,
  realtimeData,
} = require('../controllers/livraisons');

router.use(authenticate);

// Validate download token scope: dtokens are bound to a specific livraison ID
function ensureDownloadTokenScope(req, res, next) {
  if (req.downloadTokenLivraisonId && req.downloadTokenLivraisonId !== req.params.id) {
    return res.status(403).json({ error: 'Token de téléchargement invalide pour cette livraison.' });
  }
  next();
}

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), createLivraison);
router.get('/', listLivraisons);
router.get('/:id', getLivraison);
router.put('/:id/confirm-sortie', authorize('COMMERCIAL'), confirmSortie);

// Archive (SUPER_ADMIN only)
router.put('/:id/archive', authorize('SUPER_ADMIN'), archiveLivraison);

// Annulation flow: commercial requests → admin confirms
router.put('/:id/demander-annulation', authorize('COMMERCIAL'), demanderAnnulation);
router.put('/:id/confirmer-annulation', authorize('SUPER_ADMIN', 'ADMIN'), confirmerAnnulation);

// Avances (advance payments during EN_COURS)
router.post('/:id/avances', authorize('COMMERCIAL'), declarerAvance);
router.get('/:id/avances', authorize('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'), getAvances);
router.put('/:id/avances/:avanceId/accepter', authorize('SUPER_ADMIN', 'ADMIN'), accepterAvance);
router.put('/:id/avances/:avanceId/refuser', authorize('SUPER_ADMIN', 'ADMIN'), refuserAvance);

// Real-time monitoring route
router.get('/:id/realtime', authorize('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'), realtimeData);

// Sales routes
router.get('/:id/sales', authorize('COMMERCIAL'), getSales);
router.post('/:id/sales', authorize('COMMERCIAL'), recordSale);
router.post('/:id/sales/sync', authorize('COMMERCIAL'), syncOfflineSales);

// End & Retour routes
router.put('/:id/terminer', authorize('COMMERCIAL'), terminerLivraison);
router.put('/:id/confirmer-retour', authorize('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'), confirmerRetour);

// PDF routes — download token scope must match the requested livraison
router.get('/:id/bon-sortie/pdf', ensureDownloadTokenScope, downloadBonSortiePDF);
router.get('/:id/bon-retour/pdf', ensureDownloadTokenScope, downloadBonRetourPDF);
router.get('/:id/dossier/pdf', ensureDownloadTokenScope, downloadDossierPDF);
router.get('/:id/dossier', ensureDownloadTokenScope, getDossier);

// PDF download token — generates short-lived token for window.open() PDFs
router.get('/:id/pdf-token', authenticate, (req, res) => {
  const livraisonId = req.params.id;
  const token = signDownloadToken(req.user.id, livraisonId);
  res.json({ token });
});

module.exports = router;
