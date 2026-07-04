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
  generateSalaries,
  updatePrelevementStatus,
  listRecurringPrelevements,
  createRecurringPrelevement,
  updateRecurringPrelevement,
  deleteRecurringPrelevement,
  generateRecurring,
  getSettings,
  updateSettings,
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

// Recurring Expenses (Charges Fixes)
router.get('/recurring', listRecurringPrelevements);
router.post('/recurring', createRecurringPrelevement);
router.put('/recurring/:id', updateRecurringPrelevement);
router.delete('/recurring/:id', deleteRecurringPrelevement);
router.post('/generate-recurring', generateRecurring); // Kept for cron or manual override if needed

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Salary Auto-Generation
router.post('/generate-salaries', generateSalaries); // Kept for cron
router.put('/:id/status', updatePrelevementStatus);

// Expenses
router.get('/', listPrelevements);
router.get('/:id', getPrelevement);
router.post('/', createPrelevementRules, createPrelevement);
router.put('/:id', updatePrelevementRules, updatePrelevement);
router.post('/:id/delete', deletePrelevementRules, deletePrelevement);

module.exports = router;
