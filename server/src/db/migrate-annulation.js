require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Add new statuses to CHECK constraint (must drop and recreate)
    console.log('Updating status CHECK constraint...');
    await client.query(`
      ALTER TABLE livraisons DROP CONSTRAINT IF EXISTS livraisons_status_check;
      ALTER TABLE livraisons ADD CONSTRAINT livraisons_status_check
        CHECK (status IN (
          'EN_ATTENTE_COMMERCIAL',
          'CONFIRME',
          'EN_COURS',
          'EN_RETOUR',
          'EN_ATTENTE_ANNULATION',
          'ANNULE',
          'CLOTURE'
        ));
    `);

    // 2. Add new timestamp columns
    console.log('Adding annulation timestamp columns...');
    await client.query('ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS annulation_requested_at TIMESTAMPTZ');
    await client.query('ALTER TABLE livraisons ADD COLUMN IF NOT EXISTS annulation_confirmed_by_admin_at TIMESTAMPTZ');

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
