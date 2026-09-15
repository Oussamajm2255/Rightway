require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/db/pool');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if constraint exists, if so drop it
    await client.query(`
      ALTER TABLE recurring_prelevements 
      DROP CONSTRAINT IF EXISTS recurring_prelevements_frequency_check
    `);
    
    // Add new constraint
    await client.query(`
      ALTER TABLE recurring_prelevements 
      ADD CONSTRAINT recurring_prelevements_frequency_check 
      CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'))
    `);
    
    await client.query('COMMIT');
    console.log('Successfully updated constraint for QUARTERLY.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

main();
