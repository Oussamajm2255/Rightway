require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding failed_login_attempts column to users...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0');
    console.log('Adding locked_until column to users...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
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
