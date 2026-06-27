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

// ═══════════════════════════════════════════════════════════
// ONE-TIME MIGRATION — creates tables if they don't exist
// Placed BEFORE authorize middleware so it can run even without tables
// ═══════════════════════════════════════════════════════════
router.post('/migrate', authenticate, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  try {
    const pool = require('../db/pool');
    const { seedPrelevementCategories } = require('../db/migrate');
    const client = await pool.connect();
    const results = [];
    try {
      // Create categories table
      await client.query(`
        CREATE TABLE IF NOT EXISTS prelevement_categories (
          id            SERIAL PRIMARY KEY,
          name          VARCHAR(150) NOT NULL,
          parent_id     INTEGER REFERENCES prelevement_categories(id) ON DELETE CASCADE,
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      results.push('prelevement_categories: OK');

      // Partial unique indexes (can't use expression in inline UNIQUE)
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_root_name
        ON prelevement_categories (name) WHERE parent_id IS NULL
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_child_name
        ON prelevement_categories (parent_id, name) WHERE parent_id IS NOT NULL
      `);
      results.push('unique indexes: OK');

      // Create expenses table
      await client.query(`
        CREATE TABLE IF NOT EXISTS prelevements (
          id              SERIAL PRIMARY KEY,
          category_id     INTEGER NOT NULL REFERENCES prelevement_categories(id),
          amount          NUMERIC(12,2) NOT NULL CHECK(amount > 0),
          description     TEXT,
          reference       VARCHAR(100),
          declared_by     INTEGER NOT NULL REFERENCES users(id),
          declared_at     TIMESTAMPTZ DEFAULT NOW(),
          expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      results.push('prelevements: OK');

      // Indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_prelevements_category ON prelevements(category_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_prelevements_date ON prelevements(expense_date DESC)');
      results.push('indexes: OK');
    } finally {
      client.release();
    }

    // Seed categories
    try {
      await seedPrelevementCategories();
      results.push('seed: OK');
    } catch (e) {
      results.push('seed: ' + e.message);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[migrate] Manual migration error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
