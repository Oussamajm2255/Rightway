const pool = require('../db/pool');

async function findAll({ role, roles, is_active, search } = {}) {
  let query = 'SELECT id, full_name, email, role, phone, vehicle_name, vehicle_plate, is_active, remuneration_type, salary_amount, last_login_at, created_at FROM users WHERE 1=1';
  const params = [];
  let idx = 1;

  if (role) {
    query += ` AND role = $${idx++}`;
    params.push(role);
  }

  if (roles && roles.length > 0) {
    const placeholders = roles.map(() => `$${idx++}`).join(', ');
    query += ` AND role IN (${placeholders})`;
    params.push(...roles);
  }

  if (is_active !== undefined && is_active !== null) {
    query += ` AND is_active = $${idx++}`;
    params.push(is_active === 'true' || is_active === true);
  }

  if (search) {
    query += ` AND (full_name ILIKE $${idx} OR email ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  query += ' ORDER BY created_at DESC';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, role, phone, vehicle_name, vehicle_plate, is_active, remuneration_type, salary_amount, last_login_at, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, role FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function create({ full_name, email, password_hash, role, phone, vehicle_name, vehicle_plate, remuneration_type, salary_amount }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, full_name, email, password_hash, role, phone, vehicle_name, vehicle_plate, remuneration_type, salary_amount)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, full_name, email, role, phone, vehicle_name, vehicle_plate, is_active, remuneration_type, salary_amount, created_at`,
    [full_name, email.toLowerCase().trim(), password_hash, role, phone || null, vehicle_name || null, vehicle_plate || null, remuneration_type || 'COMMISSION', salary_amount || 0]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['full_name', 'email', 'phone', 'vehicle_name', 'vehicle_plate', 'is_active', 'password_hash', 'remuneration_type', 'salary_amount'];
  const sets = [];
  const params = [id];
  let idx = 2;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      if (key === 'email') {
        params.push(value.toLowerCase().trim());
      } else {
        params.push(value);
      }
    }
  }

  if (sets.length === 0) return findById(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING id, full_name, email, role, phone, vehicle_name, vehicle_plate, is_active, remuneration_type, salary_amount, last_login_at, created_at`,
    params
  );
  return rows[0] || null;
}

async function deactivate(id) {
  const { rows } = await pool.query(
    'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, full_name, email, role',
    [id]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, findByEmail, create, update, deactivate };
