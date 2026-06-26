const pool = require('../db/pool');

async function getStockLevels({ category, below_threshold } = {}) {
  let query = `
    SELECT
      p.id, p.barcode, p.name, p.category,
      p.purchase_price, p.selling_price_ttc,
      COALESCE(ds.quantity, 0) AS quantity,
      ds.last_updated
    FROM products p
    LEFT JOIN depot_stock ds ON p.id = ds.product_id
    WHERE p.is_active = true
  `;
  const params = [];
  let idx = 1;

  if (category) {
    query += ` AND p.category = $${idx++}`;
    params.push(category);
  }

  if (below_threshold !== undefined && below_threshold !== null) {
    query += ` AND COALESCE(ds.quantity, 0) < $${idx++}`;
    params.push(Number(below_threshold));
  }

  query += ' ORDER BY p.category, p.name';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function getStockAlerts(threshold = 20) {
  return getStockLevels({ below_threshold: threshold });
}

async function adjustStock(product_id, quantity_change, reason, created_by, extraFields = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current stock level
    const { rows: currentRows } = await client.query(
      'SELECT COALESCE(quantity, 0) AS quantity FROM depot_stock WHERE product_id = $1 FOR UPDATE',
      [product_id]
    );
    const currentQty = currentRows.length > 0 ? currentRows[0].quantity : 0;
    const newQty = currentQty + quantity_change;

    // Validate stock won't go negative
    if (newQty < 0) {
      await client.query('ROLLBACK');
      return {
        error: `Stock insuffisant. Stock actuel: ${currentQty}. Réduction demandée: ${Math.abs(quantity_change)}. Il manque ${Math.abs(newQty)} unité(s).`
      };
    }

    // Upsert depot_stock (safe: newQty >= 0 guaranteed)
    const { rows: stockRows } = await client.query(
      `INSERT INTO depot_stock (product_id, quantity)
       VALUES ($1, $2)
       ON CONFLICT (product_id)
       DO UPDATE SET quantity = $2, last_updated = NOW()
       RETURNING *`,
      [product_id, newQty]
    );

    // Write stock movement with optional extra fields
    const { movement_date, invoice_number, company_name } = extraFields;
    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reason, created_by, movement_date, invoice_number, company_name)
       VALUES ($1, 'AJUSTEMENT', $2, $3, $4, $5, $6, $7)`,
      [product_id, quantity_change, reason, created_by, movement_date || null, invoice_number || null, company_name || null]
    );

    await client.query('COMMIT');
    return { stock: stockRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getStockMovements({ limit = 100, product_id, type, movement_date, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (product_id) {
    conditions.push(`sm.product_id = $${idx++}`);
    params.push(product_id);
  }
  if (type) {
    conditions.push(`sm.type = $${idx++}`);
    params.push(type);
  }
  if (movement_date) {
    conditions.push(`sm.movement_date = $${idx++}`);
    params.push(movement_date);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const query = `
    SELECT
      sm.id, sm.product_id, sm.type, sm.quantity,
      sm.movement_date, sm.invoice_number, sm.company_name,
      sm.reason, sm.created_at,
      p.name AS product_name, p.category AS product_category,
      u.full_name AS created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.created_by = u.id
    ${where}
    ORDER BY sm.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  params.push(limit, offset);
  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getStockLevels, getStockAlerts, adjustStock, getStockMovements };
