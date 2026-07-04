require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function check() {
  const ref = 'LIV-20260630-006';
  const { rows } = await pool.query('SELECT * FROM livraisons WHERE reference = $1', [ref]);
  if (rows.length === 0) {
    console.log('Not found');
    process.exit(0);
  }
  const liv = rows[0];
  console.log('Livraison:', liv.id, liv.status);

  const { rows: items } = await pool.query('SELECT * FROM livraison_items WHERE livraison_id = $1', [liv.id]);
  console.log('Items:', items);
  process.exit(0);
}

check().catch(console.error);
