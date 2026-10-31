const pool = require('../db/pool');

/**
 * Commercial asks to go back from EN_RETOUR to EN_COURS to correct their sales
 */
async function create(livraison_id, requested_by, reason) {
  const { rows } = await pool.query(
    `INSERT INTO livraison_retour_en_cours_log (livraison_id, requested_by, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [livraison_id, requested_by, reason || null]
  );
  return rows[0];
}

/**
 * Admin confirms — EN_RETOUR back to EN_COURS. Sales are kept and no stock
 * moves, since stock only comes back at clôture. Bon de Retour confirmations
 * are cleared: they were given on figures that are about to change.
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
    if (livRows[0].status !== 'EN_RETOUR') {
      await client.query('ROLLBACK');
      return { error: 'Seules les livraisons en retour peuvent revenir en cours.' };
    }

    // Close every pending request; without one, nothing may be reverted
    const now = new Date().toISOString();
    const { rowCount } = await client.query(
      `UPDATE livraison_retour_en_cours_log
       SET confirmed_by = $2, confirmed_at = $3
       WHERE livraison_id = $1
         AND confirmed_by IS NULL`,
      [livraison_id, confirmed_by, now]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return { error: 'Aucune demande de retour en cours en attente.' };
    }

    await client.query(
      `UPDATE livraisons
       SET status = 'EN_COURS',
           end_declared_at = NULL,
           retour_confirmed_by_admin_at = NULL,
           retour_confirmed_by_commercial_at = NULL
       WHERE id = $1`,
      [livraison_id]
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

module.exports = { create, confirm };
