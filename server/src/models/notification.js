const pool = require('../db/pool');

async function create(user_id, message, livraison_id = null) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, message, livraison_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [user_id, message, livraison_id]
  );

  // Fire-and-forget push notification to the user's device(s)
  // Lazy-required to avoid circular dependency at module init time
  try {
    const { sendToUser } = require('../services/pushService');
    sendToUser(user_id, {
      title: 'Right Way',
      body: message,
      url: livraison_id ? `/livraisons/${livraison_id}` : '/',
      tag: livraison_id ? `livraison-${livraison_id}` : 'rightway',
    }).catch(() => {});
  } catch (_) { /* push service unavailable — not critical */ }

  return rows[0];
}

async function findByUser(user_id, { unread_only = false } = {}) {
  let query = 'SELECT * FROM notifications WHERE user_id = $1';
  const params = [user_id];

  if (unread_only) {
    query += ' AND is_read = false';
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function markRead(id, user_id) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [id, user_id]
  );
}

async function markAllRead(user_id) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [user_id]
  );
}

async function countUnread(user_id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
    [user_id]
  );
  return parseInt(rows[0].count, 10);
}

module.exports = { create, findByUser, markRead, markAllRead, countUnread };
