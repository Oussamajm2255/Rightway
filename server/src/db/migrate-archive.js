require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding is_archived column to livraisons...');
    await client.query('ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false');
    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
