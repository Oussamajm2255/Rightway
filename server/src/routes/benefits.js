const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getBenefits, getSalesStats } = require('../controllers/benefits');

router.use(authenticate);

// GET /api/benefits
router.get('/', authorize('SUPER_ADMIN'), getBenefits);

// GET /api/benefits/sales-stats — sales only, no cost or benefit data
router.get('/sales-stats', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), getSalesStats);

module.exports = router;
