const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const commercialController = require('../controllers/commercials');

// Commercials data is for the owner only
router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN'), commercialController.getAllCommercials);
router.get('/history', authorize('SUPER_ADMIN'), commercialController.getHistory);

module.exports = router;
