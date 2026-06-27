const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const commercialController = require('../controllers/commercials');

// All commercial routes require authentication + ADMIN or SUPER_ADMIN role
router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), commercialController.getAllCommercials);
router.get('/history', authorize('SUPER_ADMIN', 'ADMIN'), commercialController.getHistory);

module.exports = router;
