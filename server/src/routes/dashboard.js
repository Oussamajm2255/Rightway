const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { superAdminDashboard, adminDashboard, commercialDashboard } = require('../controllers/dashboard');

router.use(authenticate);

router.get('/super-admin', authorize('SUPER_ADMIN'), superAdminDashboard);
router.get('/admin', authorize('SUPER_ADMIN', 'ADMIN'), adminDashboard);
router.get('/commercial', authorize('SUPER_ADMIN', 'ADMIN', 'COMMERCIAL'), commercialDashboard);

module.exports = router;
