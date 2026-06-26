require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding movement_date, invoice_number, company_name to stock_movements...');
    await client.query('ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS movement_date DATE');
    await client.query('ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100)');
    await client.query('ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS company_name VARCHAR(150)');
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
