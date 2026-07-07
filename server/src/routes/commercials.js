const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const commercialController = require('../controllers/commercials');

// Commercials data is for owners/directors only — never the magasinier
router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), commercialController.getAllCommercials);
router.get('/history', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), commercialController.getHistory);

module.exports = router;
