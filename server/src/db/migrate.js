/**
 * Idempotent startup migrations — safe to run on every deploy.
 * Uses ADD COLUMN IF NOT EXISTS so existing columns are never affected.
 */
const pool = require('./pool');

const migrations = [
  // Brute-force protection (H-5)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,

  // Prelevement (expense management — SUPER_ADMIN only)
  `CREATE TABLE IF NOT EXISTS prelevement_categories (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    parent_id     INTEGER REFERENCES prelevement_categories(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_root_name
    ON prelevement_categories (name) WHERE parent_id IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_prelevement_cat_child_name
    ON prelevement_categories (parent_id, name) WHERE parent_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS prelevements (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES prelevement_categories(id),
    amount          NUMERIC(12,2) NOT NULL CHECK(amount > 0),
    description     TEXT,
    reference       VARCHAR(100),
    declared_by     UUID NOT NULL REFERENCES users(id),
    declared_at     TIMESTAMPTZ DEFAULT NOW(),
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_prelevements_category ON prelevements(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prelevements_date ON prelevements(expense_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_prelevements_declared_by ON prelevements(declared_by)`,

  // Livraison ecarts (discrepancy declarations)
  `CREATE TABLE IF NOT EXISTS livraison_ecarts (
    id            SERIAL PRIMARY KEY,
    livraison_id  INTEGER NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
    amount        NUMERIC(12,3) NOT NULL CHECK(amount > 0),
    justification TEXT NOT NULL,
    declared_by   UUID NOT NULL REFERENCES users(id),
    declared_at   TIMESTAMPTZ DEFAULT NOW(),
    confirmed_by  UUID REFERENCES users(id),
    confirmed_at  TIMESTAMPTZ,
    status        VARCHAR(20) DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ecarts_livraison ON livraison_ecarts(livraison_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ecarts_status ON livraison_ecarts(status)`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Running startup migrations...');
    for (let i = 0; i < migrations.length; i++) {
      try {
        await client.query(migrations[i]);
        console.log(`[migrate] ✓ Migration ${i + 1}/${migrations.length} OK`);
      } catch (err) {
        console.error(`[migrate] ✗ Migration ${i + 1}/${migrations.length} FAILED:`, err.message);
      }
    }
    console.log('[migrate] Startup migrations complete');
  } finally {
    client.release();
  }

  // Auto-seed after migration (idempotent)
  try {
    await seedPrelevementCategories();
    console.log('[migrate] Categories seeded');
  } catch (err) {
    console.error('[migrate] Seed error:', err.message);
  }
}

/**
 * Seed 6 preset prelevement categories (flat — no children).
 * Idempotent: skips existing entries via WHERE NOT EXISTS.
 */
async function seedPrelevementCategories() {
  const categories = [
    'Transport & Déplacement',
    'Fournitures & Consommables',
    'Charges du personnel',
    'Services & Abonnements',
    'Impôts & Taxes',
    'Autres',
  ];

  const client = await pool.connect();
  try {
    for (const name of categories) {
      await client.query(
        `INSERT INTO prelevement_categories (name, parent_id)
         SELECT $1::VARCHAR(150), NULL
         WHERE NOT EXISTS (
           SELECT 1 FROM prelevement_categories
           WHERE name = $1 AND parent_id IS NULL
         )`,
        [name]
      );
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations, seedPrelevementCategories };
