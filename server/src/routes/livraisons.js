const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
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
} = require('../controllers/livraisons');

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), createLivraison);
router.get('/', listLivraisons);
router.get('/:id', getLivraison);
router.put('/:id/confirm-sortie', authorize('COMMERCIAL'), confirmSortie);

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

module.exports = router;
