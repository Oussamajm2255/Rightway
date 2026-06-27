/**
 * Idempotent startup migrations — safe to run on every deploy.
 * Uses ADD COLUMN IF NOT EXISTS so existing columns are never affected.
 */
const pool = require('./pool');

const migrations = [
  // Brute-force protection (H-5)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,
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
