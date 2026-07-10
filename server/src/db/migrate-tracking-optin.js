const pool = require('./pool');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location_tracking_enabled BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('Migration: location_tracking_enabled column ready');
    pool.end();
  } catch (err) {
    console.error('Migration failed:', err.message);
    pool.end();
    process.exit(1);
  }
}

migrate();
