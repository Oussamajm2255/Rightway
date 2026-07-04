require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function check() {
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10');
  console.log(rows);
  process.exit(0);
}

check().catch(console.error);
