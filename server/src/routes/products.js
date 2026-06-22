const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createProductRules, updateProductRules } = require('../validators/product');
const {
  listProducts,
  listCategories,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
} = require('../controllers/products');

// Auth on all routes
router.use(authenticate);

// GET /api/products/categories — must be before /:id
router.get('/categories', listCategories);

// GET /api/products
router.get('/', listProducts);

// GET /api/products/:id
router.get('/:id', getProduct);

// POST /api/products — SUPER_ADMIN only
router.post('/', authorize('SUPER_ADMIN'), createProductRules, createProduct);

// PUT /api/products/:id — SUPER_ADMIN only
router.put('/:id', authorize('SUPER_ADMIN'), updateProductRules, updateProduct);

// DELETE /api/products/:id — SUPER_ADMIN only
router.delete('/:id', authorize('SUPER_ADMIN'), archiveProduct);

module.exports = router;
