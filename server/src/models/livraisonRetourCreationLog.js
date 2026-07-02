const pool = require('../db/pool');

/**
 * Commercial requests to return a livraison from EN_COURS back to CONFIRME (Création)
 */
async function create(livraison_id, requested_by, reason) {
  const { rows } = await pool.query(
    `INSERT INTO livraison_retour_creation_log (livraison_id, requested_by, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [livraison_id, requested_by, reason || null]
  );
  return rows[0];
}

/**
 * Admin confirms retour-creation — reverts livraison from EN_COURS to CONFIRME
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
    if (livRows[0].status !== 'EN_COURS') {
      await client.query('ROLLBACK');
      return { error: 'Seules les livraisons en cours peuvent être retournées à la création.' };
    }

    // Revert to CONFIRME (preserve sales consistency)
    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons SET status = 'CONFIRME', returned_to_creation_at = $2 WHERE id = $1`,
      [livraison_id, now]
    );

    // Update the latest pending retour-creation log
    await client.query(
      `UPDATE livraison_retour_creation_log
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
 * Get retour-creation logs for a livraison
 */
async function findByLivraison(livraison_id) {
  const { rows } = await pool.query(
    `SELECT rl.*, u.full_name AS requested_by_name, uc.full_name AS confirmed_by_name
     FROM livraison_retour_creation_log rl
     LEFT JOIN users u ON u.id = rl.requested_by
     LEFT JOIN users uc ON uc.id = rl.confirmed_by
     WHERE rl.livraison_id = $1
     ORDER BY rl.requested_at DESC`,
    [livraison_id]
  );
  return rows;
}

module.exports = { create, confirm, findByLivraison };
