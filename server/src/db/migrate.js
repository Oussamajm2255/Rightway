/**
 * Idempotent startup migrations — safe to run on every deploy.
 * Uses ADD COLUMN IF NOT EXISTS so existing columns are never affected.
 */
const pool = require('./pool');

const migrations = [
  // Brute-force protection (H-5)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,

  // Salaire vs Commission: personnel remuneration type
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS remuneration_type VARCHAR(20) DEFAULT 'COMMISSION'`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_remuneration_type_check`,
  `ALTER TABLE users ADD CONSTRAINT users_remuneration_type_check CHECK (remuneration_type IN ('COMMISSION', 'SALAIRE'))`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(10,3) DEFAULT 0`,

  // Role model overhaul: the old ADMIN role is split into
  //  - DIRECTEUR_COMMERCIAL: full access (the former ADMIN)
  //  - MAGASINIER: restricted warehouse role (personnel, salary/commission)
  // Existing ADMIN rows become DIRECTEUR_COMMERCIAL. The constraint is
  // widened (drop) BEFORE the backfill so the UPDATE validates, then a new
  // constraint with the final four roles is added. Idempotent on re-run.
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
  `UPDATE users SET role = 'DIRECTEUR_COMMERCIAL' WHERE role = 'ADMIN'`,
  `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL'))`,

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

  // Prelevements status (for salary auto-generation)
  `ALTER TABLE prelevements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'VALIDE'`,
  `ALTER TABLE prelevements DROP CONSTRAINT IF EXISTS prelevements_status_check`,
  `ALTER TABLE prelevements ADD CONSTRAINT prelevements_status_check CHECK (status IN ('VALIDE', 'EN_ATTENTE', 'REJETE'))`,

  // Recurring Prelevements (Charges Fixes)
  `CREATE TABLE IF NOT EXISTS recurring_prelevements (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES prelevement_categories(id),
    amount          NUMERIC(12,2) NOT NULL CHECK(amount > 0),
    description     TEXT,
    is_active       BOOLEAN DEFAULT true,
    generation_day  INTEGER DEFAULT 1 CHECK (generation_day BETWEEN 1 AND 28),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS generation_day INTEGER DEFAULT 1 CHECK (generation_day BETWEEN 1 AND 28)`,

  // Recurring Prelevements — dynamic cycle (WEEKLY / MONTHLY / YEARLY)
  // instead of a fixed monthly-only schedule.
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'MONTHLY'`,
  `ALTER TABLE recurring_prelevements DROP CONSTRAINT IF EXISTS recurring_prelevements_frequency_check`,
  `ALTER TABLE recurring_prelevements ADD CONSTRAINT recurring_prelevements_frequency_check CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'YEARLY'))`,
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS generation_weekday INTEGER CHECK (generation_weekday BETWEEN 1 AND 7)`,
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS generation_month INTEGER CHECK (generation_month BETWEEN 1 AND 12)`,

  // Monthly charges can now fire on SEVERAL days per month (e.g. 7, 14,
  // 21 and 31). Days up to 31 are allowed; a day beyond the current
  // month's length fires on its last day instead (31 -> 30/28).
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS generation_days INTEGER[]`,
  `UPDATE recurring_prelevements
     SET generation_days = ARRAY[generation_day]
   WHERE generation_days IS NULL AND frequency = 'MONTHLY' AND generation_day IS NOT NULL`,
  // generation_day was capped at 28; days up to 31 are now legal since the
  // cron falls back to the month's last day when the month is shorter.
  `ALTER TABLE recurring_prelevements DROP CONSTRAINT IF EXISTS recurring_prelevements_generation_day_check`,
  `ALTER TABLE recurring_prelevements ADD CONSTRAINT recurring_prelevements_generation_day_check CHECK (generation_day BETWEEN 1 AND 31)`,

  // Prelevements attributable to a specific commercial (vehicle repair,
  // fuel bonus, salary, etc.) — nullable, so "no commercial" (a general
  // company charge) stays the default for every existing row.
  `ALTER TABLE prelevements ADD COLUMN IF NOT EXISTS commercial_id UUID REFERENCES users(id)`,
  `CREATE INDEX IF NOT EXISTS idx_prelevements_commercial ON prelevements(commercial_id)`,
  `ALTER TABLE recurring_prelevements ADD COLUMN IF NOT EXISTS commercial_id UUID REFERENCES users(id)`,

  // Global Settings
  `CREATE TABLE IF NOT EXISTS global_settings (
    id SERIAL PRIMARY KEY,
    salary_generation_day INTEGER DEFAULT 1 CHECK (salary_generation_day BETWEEN 1 AND 28),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `INSERT INTO global_settings (id, salary_generation_day) VALUES (1, 1) ON CONFLICT (id) DO NOTHING`,

  // Company-wide forced GPS tracking. When ON, the STE owner (SUPER_ADMIN)
  // tracks every commercial regardless of their personal in-app toggle —
  // backed by the signed consent the commercials gave to allow GPS use.
  `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS force_location_tracking BOOLEAN NOT NULL DEFAULT false`,

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
