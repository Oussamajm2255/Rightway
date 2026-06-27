const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getBenefits } = require('../controllers/benefits');

// All routes require auth + SUPER_ADMIN
router.use(authenticate);

// GET /api/benefits
router.get('/', authorize('SUPER_ADMIN'), getBenefits);

module.exports = router;
