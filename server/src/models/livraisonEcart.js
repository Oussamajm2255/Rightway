const pool = require('../db/pool');

async function create({ livraison_id, amount, justification, declared_by }) {
  const { rows } = await pool.query(
    `INSERT INTO livraison_ecarts (livraison_id, amount, justification, declared_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [livraison_id, amount, justification, declared_by]
  );
  return rows[0];
}

async function findByLivraison(livraison_id) {
  const { rows } = await pool.query(
    `SELECT e.*, 
            d.full_name AS declared_by_name,
            c.full_name AS confirmed_by_name
     FROM livraison_ecarts e
     JOIN users d ON e.declared_by = d.id
     LEFT JOIN users c ON e.confirmed_by = c.id
     WHERE e.livraison_id = $1
     ORDER BY e.declared_at DESC`,
    [livraison_id]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT e.*, 
            d.full_name AS declared_by_name,
            c.full_name AS confirmed_by_name
     FROM livraison_ecarts e
     JOIN users d ON e.declared_by = d.id
     LEFT JOIN users c ON e.confirmed_by = c.id
     WHERE e.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function confirm(id, commercial_id) {
  const { rows } = await pool.query(
    `UPDATE livraison_ecarts 
     SET status = 'CONFIRMED', confirmed_by = $2, confirmed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *`,
    [id, commercial_id]
  );
  return rows[0] || null;
}

async function getPendingCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM livraison_ecarts WHERE status = 'PENDING'`
  );
  return rows[0]?.count || 0;
}

module.exports = { create, findByLivraison, findById, confirm, getPendingCount };
