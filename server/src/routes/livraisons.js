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
router.get('/:id/avances', getAvances);
router.put('/:id/avances/:avanceId/accepter', authorize('SUPER_ADMIN', 'ADMIN'), accepterAvance);
router.put('/:id/avances/:avanceId/refuser', authorize('SUPER_ADMIN', 'ADMIN'), refuserAvance);

// Real-time monitoring route
router.get('/:id/realtime', realtimeData);

// Sales routes
router.get('/:id/sales', authorize('COMMERCIAL'), getSales);
router.post('/:id/sales', authorize('COMMERCIAL'), recordSale);
router.post('/:id/sales/sync', authorize('COMMERCIAL'), syncOfflineSales);

// End & Retour routes
router.put('/:id/terminer', authorize('COMMERCIAL'), terminerLivraison);
router.put('/:id/confirmer-retour', authorize('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'), confirmerRetour);

// PDF routes
router.get('/:id/bon-sortie/pdf', downloadBonSortiePDF);
router.get('/:id/bon-retour/pdf', downloadBonRetourPDF);
router.get('/:id/dossier/pdf', downloadDossierPDF);
router.get('/:id/dossier', getDossier);

// PDF download token — generates short-lived token for window.open() PDFs
router.get('/:id/pdf-token', authenticate, (req, res) => {
  const livraisonId = req.params.id;
  const token = signDownloadToken(req.user.id, livraisonId);
  res.json({ token });
});

module.exports = router;
