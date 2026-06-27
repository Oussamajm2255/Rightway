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
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, COALESCE(parent_id, 0))
  )`,
  `CREATE TABLE IF NOT EXISTS prelevements (
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
  )`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
