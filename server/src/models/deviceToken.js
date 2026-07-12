const pool = require('../db/pool');

// A device (FCM) token belongs to exactly one user. If the same physical
// device later logs in as a different user, the token is reassigned.
async function upsert(user_id, token, platform = 'android') {
  const { rows } = await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token)
     DO UPDATE SET user_id = EXCLUDED.user_id,
                   platform = EXCLUDED.platform,
                   updated_at = NOW()
     RETURNING *`,
    [user_id, token, platform]
  );
  return rows[0];
}

async function findByUser(user_id) {
  const { rows } = await pool.query(
    'SELECT * FROM device_tokens WHERE user_id = $1 ORDER BY updated_at DESC',
    [user_id]
  );
  return rows;
}

// Remove a token. When user_id is given (logout), scope the delete to that
// user so a request can only detach its own device. When omitted (FCM pruning
// of an invalid token), remove it unconditionally.
async function remove(token, user_id = null) {
  if (user_id) {
    await pool.query('DELETE FROM device_tokens WHERE token = $1 AND user_id = $2', [token, user_id]);
  } else {
    await pool.query('DELETE FROM device_tokens WHERE token = $1', [token]);
  }
}

module.exports = { upsert, findByUser, remove };
