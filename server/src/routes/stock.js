const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { listStock, getAlerts, adjustStock, listMovements } = require('../controllers/stock');

// All routes require authentication
router.use(authenticate);

// GET /api/stock (Super Admin, Directeur Commercial, Magasinier)
router.get('/', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER'), listStock);

// GET /api/stock/alerts
router.get('/alerts', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER'), getAlerts);

// PUT /api/stock/adjust (Super Admin only)
router.put('/adjust', authorize('SUPER_ADMIN'), adjustStock);

// GET /api/stock/movements (Super Admin only)
router.get('/movements', authorize('SUPER_ADMIN'), listMovements);

module.exports = router;
