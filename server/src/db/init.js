require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const seed = require('./seed');

async function init() {
  const client = await pool.connect();
  try {
    console.log('=== Right Way — Database Initialization ===\n');

    // Step 1: Run schema
    console.log('[1/2] Running schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSQL);
    console.log('Schema created successfully.\n');

    // Step 2: Run seed
    console.log('[2/2] Running seed...');
    await seed();
    console.log('');

    // Step 3: Verify
    console.log('=== Verification ===');
    const { rows: userRows } = await client.query('SELECT id, full_name, email, role FROM users ORDER BY role, full_name');
    console.log(`Users (${userRows.length}):`);
    userRows.forEach(u => console.log(`  ${u.full_name} <${u.email}> — ${u.role}`));

    const { rows: productRows } = await client.query('SELECT id, barcode, name, category, selling_price_ttc FROM products ORDER BY id');
    console.log(`\nProducts (${productRows.length}):`);
    productRows.forEach(p => console.log(`  ${p.id} | ${p.barcode} | ${p.name} | ${p.category} | ${p.selling_price_ttc} DT`));

    const { rows: stockRows } = await client.query('SELECT ds.product_id, p.name, ds.quantity FROM depot_stock ds JOIN products p ON ds.product_id = p.id ORDER BY ds.product_id');
    console.log(`\nStock (${stockRows.length}):`);
    stockRows.forEach(s => console.log(`  ${s.product_id} | ${s.name} | ${s.quantity} unités`));

    console.log('\n=== Database initialization complete ===');
    process.exit(0);
  } catch (err) {
    console.error('\nInitialization failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
