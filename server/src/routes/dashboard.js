const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { superAdminDashboard, adminDashboard, commercialDashboard } = require('../controllers/dashboard');

router.use(authenticate);

router.get('/super-admin', superAdminDashboard);
router.get('/admin', adminDashboard);
router.get('/commercial', commercialDashboard);

module.exports = router;
