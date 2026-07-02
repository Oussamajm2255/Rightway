const pool = require('../db/pool');

/**
 * Commercial requests to reopen a closed livraison
 */
async function create(livraison_id, requested_by, reason) {
  const { rows } = await pool.query(
    `INSERT INTO livraison_reopen_log (livraison_id, requested_by, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [livraison_id, requested_by, reason || null]
  );
  return rows[0];
}

/**
 * Admin confirms reopen — sets livraison back to EN_COURS
 */
async function confirm(livraison_id, confirmed_by) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the livraison row to prevent concurrent modification
    const { rows: livRows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE', [livraison_id]
    );
    if (livRows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Livraison introuvable.' };
    }
    if (livRows[0].status !== 'CLOTURE') {
      await client.query('ROLLBACK');
      return { error: 'Seules les livraisons clôturées peuvent être réouvertes.' };
    }

    // Update livraison status back to EN_COURS
    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons SET status = 'EN_COURS', reopened_at = $2 WHERE id = $1`,
      [livraison_id, now]
    );

    // Update the latest pending reopen log
    await client.query(
      `UPDATE livraison_reopen_log
       SET confirmed_by = $2, confirmed_at = $3
       WHERE livraison_id = $1
         AND confirmed_by IS NULL
       ORDER BY requested_at DESC
       LIMIT 1`,
      [livraison_id, confirmed_by, now]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get reopen logs for a livraison
 */
async function findByLivraison(livraison_id) {
  const { rows } = await pool.query(
    `SELECT rl.*, u.full_name AS requested_by_name, uc.full_name AS confirmed_by_name
     FROM livraison_reopen_log rl
     LEFT JOIN users u ON u.id = rl.requested_by
     LEFT JOIN users uc ON uc.id = rl.confirmed_by
     WHERE rl.livraison_id = $1
     ORDER BY rl.requested_at DESC`,
    [livraison_id]
  );
  return rows;
}

module.exports = { create, confirm, findByLivraison };
