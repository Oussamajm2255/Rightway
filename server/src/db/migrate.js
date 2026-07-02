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
    livraison_id  UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
    amount        NUMERIC(12,3) NOT NULL CHECK(amount > 0),
    justification TEXT NOT NULL,
    declared_by   UUID NOT NULL REFERENCES users(id),
    declared_at   TIMESTAMPTZ DEFAULT NOW(),
    confirmed_by  UUID REFERENCES users(id),
    confirmed_at  TIMESTAMPTZ,
    payment_requested_by UUID REFERENCES users(id),
    payment_requested_at TIMESTAMPTZ,
    payment_confirmed_by UUID REFERENCES users(id),
    payment_confirmed_at TIMESTAMPTZ,
    status        VARCHAR(20) DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','PAYMENT_REQUESTED','PAID')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ecarts_livraison ON livraison_ecarts(livraison_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ecarts_status ON livraison_ecarts(status)`,

  // Livraison ecarts — payment workflow columns (idempotent)
  `ALTER TABLE livraison_ecarts ADD COLUMN IF NOT EXISTS payment_requested_by UUID REFERENCES users(id)`,
  `ALTER TABLE livraison_ecarts ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ`,
  `ALTER TABLE livraison_ecarts ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES users(id)`,
  `ALTER TABLE livraison_ecarts ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ`,
  // Drop and recreate status CHECK constraint to include new values
  `ALTER TABLE livraison_ecarts DROP CONSTRAINT IF EXISTS livraison_ecarts_status_check`,
  `ALTER TABLE livraison_ecarts ADD CONSTRAINT livraison_ecarts_status_check CHECK (status IN ('PENDING','CONFIRMED','PAYMENT_REQUESTED','PAID'))`,

  // Livraison reopen (Cloture → EN_COURS with admin confirmation)
  `ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS livraison_reopen_log (
    id SERIAL PRIMARY KEY,
    livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    confirmed_by UUID REFERENCES users(id),
    reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reopen_log_livraison ON livraison_reopen_log(livraison_id)`,

  // Avance payment method (Task 4)
  `ALTER TABLE livraison_avances ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'ESPECES'`,

  // Return to creation (Task 5)
  `ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS returned_to_creation_at TIMESTAMPTZ`,
  `ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS return_reason TEXT`,
  `CREATE TABLE IF NOT EXISTS livraison_retour_creation_log (
    id SERIAL PRIMARY KEY,
    livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    confirmed_by UUID REFERENCES users(id),
    reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_retour_creation_log_livraison ON livraison_retour_creation_log(livraison_id)`,
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
