const pool = require('../db/pool');

async function findAll({ category, is_active, search } = {}) {
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  let idx = 1;

  if (category) {
    query += ` AND category = $${idx++}`;
    params.push(category);
  }

  if (is_active !== undefined && is_active !== null) {
    query += ` AND is_active = $${idx++}`;
    params.push(is_active === 'true' || is_active === true);
  }

  if (search) {
    query += ` AND (name ILIKE $${idx} OR barcode ILIKE $${idx} OR id ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ' ORDER BY category, name';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByBarcode(barcode) {
  const { rows } = await pool.query('SELECT * FROM products WHERE barcode = $1', [barcode]);
  return rows[0] || null;
}

async function getNextId() {
  // Advisory lock to serialize product ID generation (lock key = hash of 'product-id-gen')
  const lockKey = 123456789; // fixed key: serialize all product creates
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);

    const { rows } = await client.query(
      "SELECT id FROM products WHERE id LIKE 'PROD-%' ORDER BY id DESC LIMIT 1"
    );
    if (rows.length === 0) return 'PROD-001';
    const lastNum = parseInt(rows[0].id.replace('PROD-', ''), 10);
    const nextNum = lastNum + 1;
    return `PROD-${String(nextNum).padStart(3, '0')}`;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    client.release();
  }
}

async function create({ barcode, name, category, purchase_price, selling_price_ttc }) {
  const id = await getNextId();
  const { rows } = await pool.query(
    `INSERT INTO products (id, barcode, name, category, purchase_price, selling_price_ttc)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, barcode, name, category || null, purchase_price, selling_price_ttc]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['barcode', 'name', 'category', 'purchase_price', 'selling_price_ttc', 'is_active'];
  const sets = [];
  const params = [id];
  let idx = 2;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }

  if (sets.length === 0) return findById(id);

  const { rows } = await pool.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function archive(id) {
  const { rows } = await pool.query(
    "UPDATE products SET is_active = false WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0] || null;
}

async function getCategories() {
  const { rows } = await pool.query(
    'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
  );
  return rows.map((r) => r.category);
}

module.exports = { findAll, findById, findByBarcode, getNextId, create, update, archive, getCategories };
