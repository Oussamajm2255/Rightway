const pool = require('../db/pool');

async function upsert(user_id, endpoint, p256dh, auth, user_agent) {
  const { rows } = await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                   user_agent = EXCLUDED.user_agent, updated_at = NOW()
     RETURNING *`,
    [user_id, endpoint, p256dh, auth, user_agent || null]
  );
  return rows[0];
}

async function remove(user_id, endpoint) {
  await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [user_id, endpoint]
  );
}

async function findByUser(user_id) {
  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
    [user_id]
  );
  return rows;
}

async function findAll() {
  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions ORDER BY user_id, created_at DESC'
  );
  return rows;
}

module.exports = { upsert, remove, findByUser, findAll };
