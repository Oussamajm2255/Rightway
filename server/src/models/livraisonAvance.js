const pool = require('../db/pool');

/**
 * Commercial declares an advance payment
 */
async function create(livraison_id, commercial_id, amount, payment_method, image_base64) {
  const { rows } = await pool.query(
    `INSERT INTO livraison_avances (livraison_id, commercial_id, amount, payment_method, image_base64)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [livraison_id, commercial_id, amount, payment_method || 'ESPECES', image_base64 || null]
  );
  return rows[0];
}

/**
 * List all avances for a livraison
 */
async function findByLivraison(livraison_id) {
  const { rows } = await pool.query(
    `SELECT la.*,
            c.full_name AS commercial_name,
            a.full_name AS admin_name
     FROM livraison_avances la
     LEFT JOIN users c ON la.commercial_id = c.id
     LEFT JOIN users a ON la.admin_id = a.id
     WHERE la.livraison_id = $1
     ORDER BY la.created_at DESC`,
    [livraison_id]
  );
  return rows;
}

/**
 * Admin accepts an avance
 */
async function accepter(id, admin_id) {
  const { rows } = await pool.query(
    `UPDATE livraison_avances
     SET status = 'ACCEPTE', admin_id = $2, confirmed_at = NOW()
     WHERE id = $1 AND status = 'EN_ATTENTE'
     RETURNING *`,
    [id, admin_id]
  );
  return rows[0] || null;
}

/**
 * Admin refuses an avance with optional note
 */
async function refuser(id, admin_id, note) {
  const { rows } = await pool.query(
    `UPDATE livraison_avances
     SET status = 'REFUSE', admin_id = $2, admin_note = $3, confirmed_at = NOW()
     WHERE id = $1 AND status = 'EN_ATTENTE'
     RETURNING *`,
    [id, admin_id, note || null]
  );
  return rows[0] || null;
}

/**
 * Super admin updates payment method of an existing avance
 */
async function updatePaymentMethod(id, payment_method) {
  const { rows } = await pool.query(
    `UPDATE livraison_avances
     SET payment_method = $2
     WHERE id = $1
     RETURNING *`,
    [id, payment_method]
  );
  return rows[0] || null;
}

/**
 * Total accepted avances for a livraison
 */
async function getTotalAccepted(livraison_id) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM livraison_avances
     WHERE livraison_id = $1 AND status = 'ACCEPTE'`,
    [livraison_id]
  );
  return Number(rows[0].total);
}

module.exports = { create, findByLivraison, accepter, refuser, updatePaymentMethod, getTotalAccepted };
