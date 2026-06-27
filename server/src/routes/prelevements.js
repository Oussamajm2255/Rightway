const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createCategoryRules,
  updateCategoryRules,
  createPrelevementRules,
  updatePrelevementRules,
  deletePrelevementRules,
} = require('../validators/prelevement');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listPrelevements,
  getPrelevement,
  createPrelevement,
  updatePrelevement,
  deletePrelevement,
  getStats,
} = require('../controllers/prelevement');

// All routes require SUPER_ADMIN
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

// Categories
router.get('/categories', listCategories);
router.post('/categories', createCategoryRules, createCategory);
router.put('/categories/:id', updateCategoryRules, updateCategory);
router.delete('/categories/:id', deleteCategory);

// Stats (before /:id)
router.get('/stats', getStats);

// Expenses
router.get('/', listPrelevements);
router.get('/:id', getPrelevement);
router.post('/', createPrelevementRules, createPrelevement);
router.put('/:id', updatePrelevementRules, updatePrelevement);
router.post('/:id/delete', deletePrelevementRules, deletePrelevement);

module.exports = router;
