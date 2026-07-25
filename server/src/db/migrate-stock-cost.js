require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

/**
 * Migration: record the real purchase cost of each stock movement.
 *
 * Adds stock_movements.unit_price — a snapshot of products.purchase_price
 * taken at the moment stock is added, so the "Prix total" shown in the
 * Journal des ajustements reflects what the added quantity actually cost and
 * never drifts when a product's price is edited later.
 *
 * Existing addition rows (quantity > 0) are backfilled with the current
 * product price — the best estimate available for historical entries.
 *
 * Safe to run multiple times (ADD COLUMN IF NOT EXISTS + only backfills NULLs).
 */
async function migrate() {
  const client = await pool.connect();
  try {
    console.log('=== Stock Cost Migration ===\n');

    await client.query('BEGIN');

    // 1. Add the snapshot column
    console.log('[1/2] Adding stock_movements.unit_price ...');
    await client.query(
      'ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,3)'
    );

    // 2. Backfill historical manual addition rows with the current product
    //    price. Scoped to AJUSTEMENT additions — the only rows the journal's
    //    "Prix total" surfaces; delivery movements (SORTIE/RETOUR) don't carry
    //    a purchase cost.
    console.log('[2/2] Backfilling existing addition rows ...');
    const { rowCount } = await client.query(`
      UPDATE stock_movements sm
      SET unit_price = p.purchase_price
      FROM products p
      WHERE sm.product_id = p.id
        AND sm.unit_price IS NULL
        AND sm.quantity > 0
        AND sm.type = 'AJUSTEMENT'
    `);

    await client.query('COMMIT');
    console.log(`\nBackfilled ${rowCount} addition row(s).`);
    console.log('=== Migration Complete ===');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
