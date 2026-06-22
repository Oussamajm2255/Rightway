const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createUserRules, updateUserRules } = require('../validators/user');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  listCommercials,
} = require('../controllers/users');

// All user routes require authentication + SUPER_ADMIN role
router.use(authenticate);

// GET /api/users/commercials — must be before /:id
router.get('/commercials', listCommercials);

// GET /api/users
router.get('/', authorize('SUPER_ADMIN'), listUsers);

// GET /api/users/:id
router.get('/:id', authorize('SUPER_ADMIN'), getUser);

// POST /api/users
router.post('/', authorize('SUPER_ADMIN'), createUserRules, createUser);

// PUT /api/users/:id
router.put('/:id', authorize('SUPER_ADMIN'), updateUserRules, updateUser);

// PUT /api/users/:id/deactivate (deactivate)
router.put('/:id/deactivate', authorize('SUPER_ADMIN'), deactivateUser);

module.exports = router;
