const pool = require('../db/pool');

// ═══════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════

async function getCategoryTree() {
  const { rows } = await pool.query(
    `SELECT id, name, parent_id, created_at
     FROM prelevement_categories
     ORDER BY COALESCE(parent_id, id), parent_id IS NOT NULL, name`
  );

  const map = new Map();
  const roots = [];
  for (const r of rows) {
    map.set(r.id, { ...r, children: [] });
  }
  for (const r of rows) {
    const node = map.get(r.id);
    if (r.parent_id) {
      const parent = map.get(r.parent_id);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function getCategoryById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM prelevement_categories WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createCategory({ name, parent_id }) {
  const { rows } = await pool.query(
    `INSERT INTO prelevement_categories (name, parent_id)
     VALUES ($1, $2)
     RETURNING *`,
    [name, parent_id || null]
  );
  return rows[0];
}

async function updateCategory(id, { name }) {
  const { rows } = await pool.query(
    `UPDATE prelevement_categories SET name = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [name, id]
  );
  return rows[0] || null;
}

async function deleteCategory(id) {
  // ON DELETE CASCADE handles children; check for existing expenses
  const { rows: expCount } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM prelevements WHERE category_id = $1',
    [id]
  );
  const { rows } = await pool.query(
    'DELETE FROM prelevement_categories WHERE id = $1 RETURNING *',
    [id]
  );
  return { deleted: rows[0] || null, orphanedExpenses: expCount[0]?.cnt || 0 };
}

// ═══════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════

async function findAllPrelevements({ page = 1, limit = 20, category_id, date_from, date_to, search } = {}) {
  let query = `
    SELECT p.*, c.name AS category_name, pc.name AS parent_category_name,
           u.full_name AS declared_by_name
    FROM prelevements p
    JOIN prelevement_categories c ON p.category_id = c.id
    LEFT JOIN prelevement_categories pc ON c.parent_id = pc.id
    JOIN users u ON p.declared_by = u.id
    WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (category_id) {
    // Include children of the selected category
    query += ` AND (p.category_id = $${idx++} OR c.parent_id = $${idx - 1})`;
    params.push(category_id);
  }
  if (date_from) {
    query += ` AND p.expense_date >= $${idx++}`;
    params.push(date_from);
  }
  if (date_to) {
    query += ` AND p.expense_date <= $${idx++}`;
    params.push(date_to);
  }
  if (search) {
    query += ` AND (p.description ILIKE $${idx} OR p.reference ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  // Count
  const countQuery = query.replace(
    /SELECT .* FROM/,
    'SELECT COUNT(*)::int AS total FROM'
  );
  const { rows: countRows } = await pool.query(countQuery, params);
  const total = countRows[0]?.total || 0;

  // Paginate
  const offset = (page - 1) * limit;
  query += ` ORDER BY p.expense_date DESC, p.declared_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return { expenses: rows, total, page, limit };
}

async function findPrelevementById(id) {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, pc.name AS parent_category_name,
            u.full_name AS declared_by_name
     FROM prelevements p
     JOIN prelevement_categories c ON p.category_id = c.id
     LEFT JOIN prelevement_categories pc ON c.parent_id = pc.id
     JOIN users u ON p.declared_by = u.id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function createPrelevement({ category_id, amount, description, reference, expense_date, declared_by, status = 'VALIDE' }) {
  const { rows } = await pool.query(
    `INSERT INTO prelevements (category_id, amount, description, reference, expense_date, declared_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [category_id, amount, description || null, reference || null, expense_date, declared_by, status]
  );
  return rows[0];
}

async function updatePrelevement(id, fields) {
  const allowed = ['category_id', 'amount', 'description', 'reference', 'expense_date', 'status'];
  const sets = [];
  const params = [id];
  let idx = 2;
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }
  if (sets.length === 0) return findPrelevementById(id);
  sets.push(`updated_at = NOW()`);
  const { rows } = await pool.query(
    `UPDATE prelevements SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function deletePrelevement(id) {
  const { rows } = await pool.query(
    'DELETE FROM prelevements WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}

// ═══════════════════════════════════════════════
// STATS / KPI
// ═══════════════════════════════════════════════

async function getStats() {
  const [totals, monthly, byMain, byChild, topExpenses] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(amount), 0)::float AS total_expenses,
        COUNT(*)::int AS total_count,
        COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)), 0)::float AS current_month_total,
        CASE WHEN COUNT(DISTINCT DATE_TRUNC('month', expense_date)) > 0
          THEN (SUM(amount) / COUNT(DISTINCT DATE_TRUNC('month', expense_date)))::float
          ELSE 0 END AS monthly_avg
      FROM prelevements
      WHERE status = 'VALIDE'
    `),
    pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', expense_date), 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0)::float AS total,
             COUNT(*)::int AS count
      FROM prelevements
      WHERE expense_date >= CURRENT_DATE - INTERVAL '12 months' AND status = 'VALIDE'
      GROUP BY month ORDER BY month
    `),
    pool.query(`
      SELECT c.id AS category_id, c.name AS category_name,
             COALESCE(SUM(p.amount), 0)::float AS total,
             COUNT(p.id)::int AS count
      FROM prelevement_categories c
      LEFT JOIN prelevements p ON p.category_id = c.id AND p.status = 'VALIDE'
      WHERE c.parent_id IS NULL
      GROUP BY c.id, c.name
      ORDER BY total DESC
    `),
    pool.query(`
      SELECT c.id AS category_id, c.name AS category_name,
             pc.name AS parent_name,
             COALESCE(SUM(p.amount), 0)::float AS total,
             COUNT(p.id)::int AS count
      FROM prelevement_categories c
      LEFT JOIN prelevements p ON p.category_id = c.id AND p.status = 'VALIDE'
      LEFT JOIN prelevement_categories pc ON c.parent_id = pc.id
      WHERE c.parent_id IS NOT NULL
      GROUP BY c.id, c.name, pc.name
      ORDER BY total DESC
    `),
    pool.query(`
      SELECT p.id, p.description, p.amount, p.expense_date,
             c.name AS category_name
      FROM prelevements p
      JOIN prelevement_categories c ON p.category_id = c.id
      WHERE p.status = 'VALIDE'
      ORDER BY p.amount DESC LIMIT 10
    `),
  ]);

  const t = totals.rows[0] || {};
  const totalExpenses = t.total_expenses || 0;

  return {
    total_expenses: totalExpenses,
    total_count: t.total_count || 0,
    current_month_total: t.current_month_total || 0,
    monthly_avg: t.monthly_avg || 0,
    monthly_trend: monthly.rows,
    by_main_category: byMain.rows.map(r => ({
      ...r,
      percentage: totalExpenses > 0 ? Math.round((r.total / totalExpenses) * 1000) / 10 : 0,
    })),
    by_child_category: byChild.rows,
    top_expenses: topExpenses.rows,
  };
}

// ═══════════════════════════════════════════════
// RECURRING EXPENSES
// ═══════════════════════════════════════════════

async function findAllRecurringPrelevements() {
  const { rows } = await pool.query(`
    SELECT r.*, c.name AS category_name, pc.name AS parent_category_name
    FROM recurring_prelevements r
    JOIN prelevement_categories c ON r.category_id = c.id
    LEFT JOIN prelevement_categories pc ON c.parent_id = pc.id
    ORDER BY r.created_at DESC
  `);
  return rows;
}

async function findRecurringPrelevementById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM recurring_prelevements WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createRecurringPrelevement({
  category_id, amount, description, is_active = true, created_by,
  frequency = 'MONTHLY', generation_day = null, generation_weekday = null, generation_month = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO recurring_prelevements
       (category_id, amount, description, is_active, created_by, frequency, generation_day, generation_weekday, generation_month)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [category_id, amount, description || null, is_active, created_by, frequency, generation_day, generation_weekday, generation_month]
  );
  return rows[0];
}

async function updateRecurringPrelevement(id, fields) {
  const allowed = ['category_id', 'amount', 'description', 'is_active', 'frequency', 'generation_day', 'generation_weekday', 'generation_month'];
  const sets = [];
  const params = [id];
  let idx = 2;
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }
  }
  if (sets.length === 0) return findRecurringPrelevementById(id);
  sets.push(`updated_at = NOW()`);
  const { rows } = await pool.query(
    `UPDATE recurring_prelevements SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function deleteRecurringPrelevement(id) {
  const { rows } = await pool.query(
    'DELETE FROM recurring_prelevements WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  findAllPrelevements,
  findPrelevementById,
  createPrelevement,
  updatePrelevement,
  deletePrelevement,
  getStats,
  findAllRecurringPrelevements,
  findRecurringPrelevementById,
  createRecurringPrelevement,
  updateRecurringPrelevement,
  deleteRecurringPrelevement,
};
