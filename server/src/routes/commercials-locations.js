const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAllLocations, updateLocation } = require('../controllers/commercials-locations');

router.use(authenticate);

// SUPER_ADMIN views all commercial locations on the dashboard map
router.get('/', authorize('SUPER_ADMIN'), getAllLocations);

// COMMERCIAL updates their own GPS location from mobile app
router.put('/location', authorize('COMMERCIAL'), updateLocation);

module.exports = router;
