require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

/**
 * Migration: add notifications.link_url — an optional in-app deep link so a
 * notification not tied to a livraison (e.g. an auto-prélèvement awaiting
 * approval) can navigate somewhere when tapped (e.g. '/prelevements').
 *
 * Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
 */
async function migrate() {
  const client = await pool.connect();
  try {
    console.log('=== Notifications link_url Migration ===\n');
    await client.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url TEXT');
    console.log('Added notifications.link_url.');
    console.log('=== Migration Complete ===');
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
