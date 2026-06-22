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

async function adjustStock(product_id, quantity_change, reason, created_by) {
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

    // Write stock movement
    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reason, created_by)
       VALUES ($1, 'AJUSTEMENT', $2, $3, $4)`,
      [product_id, quantity_change, reason, created_by]
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

module.exports = { getStockLevels, getStockAlerts, adjustStock };
