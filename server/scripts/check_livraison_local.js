const { Pool } = require('pg');

async function check() {
  const localPool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/rightway'
  });
  
  try {
    const ref = 'LIV-20260630-006';
    const { rows } = await localPool.query('SELECT * FROM livraisons WHERE reference = $1', [ref]);
    if (rows.length === 0) {
      console.log('Not found locally');
    } else {
      const liv = rows[0];
      console.log('Livraison locally:', liv.id, liv.status);
      const { rows: items } = await localPool.query('SELECT * FROM livraison_items WHERE livraison_id = $1', [liv.id]);
      console.log('Items:', items);
    }
  } catch(e) {
    console.error('Local DB error:', e.message);
  }
  process.exit(0);
}

check().catch(console.error);
