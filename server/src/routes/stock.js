const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { listStock, getAlerts, adjustStock } = require('../controllers/stock');

// All routes require authentication
router.use(authenticate);

// GET /api/stock (Admin + Super Admin)
router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), listStock);

// GET /api/stock/alerts (Admin + Super Admin)
router.get('/alerts', authorize('SUPER_ADMIN', 'ADMIN'), getAlerts);

// PUT /api/stock/adjust (Super Admin only)
router.put('/adjust', authorize('SUPER_ADMIN'), adjustStock);

module.exports = router;
