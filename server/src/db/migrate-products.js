require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('=== Product Catalog Migration ===\n');

    // 1. Fetch current products to get prices
    const { rows: current } = await client.query('SELECT * FROM products WHERE is_active = true');
    const byId = {};
    current.forEach(p => byId[p.id] = p);
    console.log(`Current active products: ${current.length}`);

    // 2. Define the new category → sous-catégories mapping
    // Each sous-catégorie inherits parent's purchase_price and selling_price_ttc
    const mapping = [
      // PROD-001 KAKITO FOUR
      { parent: 'PROD-001', items: ['Baton', 'Boule'] },

      // PROD-002 KAKITO MOKLI — Mini bâtons + Mini boules × 4 flavors
      { parent: 'PROD-002', items: [
        'Mini bâtons Sel', 'Mini bâtons Piquant', 'Mini bâtons Fromage', 'Mini bâtons Ail',
        'Mini boules Sel', 'Mini boules Piquant', 'Mini boules Fromage', 'Mini boules Ail',
      ]},

      // NEW: Kakito Mokli Seaux (same prices as PROD-002)
      { parent: 'PROD-002', items: ['Seau Sel', 'Seau Piquant', 'Seau Fromage', 'Seau Ail'], parentName: 'KAKITO MOKLI SEAUX' },

      // PROD-003 SABLE + PROD-004 COOKIES SANS SUCRE → merged as "SABLE COOKIES SANS SUCRE"
      { parent: 'PROD-003', items: ['Noix de coco', 'Cacao', 'Amandes'], parentName: 'SABLE COOKIES SANS SUCRE' },

      // PROD-007 Cake MARIO
      { parent: 'PROD-007', items: ['Pépites de chocolat', 'Tout chocolat', 'Vanille chocolat'] },

      // PROD-008 Cake VALENTINO
      { parent: 'PROD-008', items: ['Pépites chocolat', 'Tout chocolat', 'Vanille chocolat'] },

      // PROD-010 GAUFRETTE 80G
      { parent: 'PROD-010', items: ['Chocolat', 'Fraise', 'Noisette', 'Noix de coco', 'Lait'] },

      // PROD-011 BISCUIT 190G
      { parent: 'PROD-011', items: ['Chocolat', 'Lait', 'Noisette'] },

      // PROD-012 LANGUE DE CHAT GOUTINEL
      { parent: 'PROD-012', items: ['Nature', 'Chocolat'] },
    ];

    // 3. Get next product ID
    const { rows: lastRow } = await client.query("SELECT id FROM products WHERE id LIKE 'PROD-%' ORDER BY id DESC LIMIT 1");
    let nextNum = lastRow.length > 0 ? parseInt(lastRow[0].id.replace('PROD-', ''), 10) + 1 : 13;

    let created = 0;
    const parentIdsToArchive = new Set();

    await client.query('BEGIN');

    for (const group of mapping) {
      const parentProduct = byId[group.parent];
      const parentName = group.parentName || parentProduct.name;
      const categoryName = group.parentName ? group.parentName : parentProduct.name;
      parentIdsToArchive.add(group.parent);

      // If parentName differs from original (e.g., merged or renamed), create a new parent entry
      if (group.parentName) {
        // Create the new parent product entry
        const id = `PROD-${String(nextNum++).padStart(3, '0')}`;
        await client.query(
          `INSERT INTO products (id, barcode, name, category, purchase_price, selling_price_ttc)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [id, parentProduct.barcode + '-S', parentName, parentProduct.category, parentProduct.purchase_price, parentProduct.selling_price_ttc]
        );
        created++;
      }

      for (const itemName of group.items) {
        const id = `PROD-${String(nextNum++).padStart(3, '0')}`;
        const barcode = `MIG-${String(nextNum-1).padStart(4, '0')}`;
        await client.query(
          `INSERT INTO products (id, barcode, name, category, purchase_price, selling_price_ttc)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, barcode, itemName, categoryName, parentProduct.purchase_price, parentProduct.selling_price_ttc]
        );
        created++;
      }
    }

    // 4. Archive old parent products (except BROWNIE, AMANDIES, DATE BAR which stay)
    const keepActive = ['PROD-005', 'PROD-006', 'PROD-009']; // BROWNIE, AMANDIES, DATE BAR
    const toArchive = [...parentIdsToArchive].filter(id => !keepActive.includes(id));

    for (const id of toArchive) {
      await client.query("UPDATE products SET is_active = false WHERE id = $1", [id]);
    }

    // Also archive PROD-004 (COOKIES SANS SUCRE — merged into SABLE COOKIES SANS SUCRE)
    await client.query("UPDATE products SET is_active = false WHERE id = 'PROD-004'");

    await client.query('COMMIT');

    console.log(`\nNew products created: ${created}`);
    console.log(`Archived old products: ${toArchive.length + 1}`); // +1 for PROD-004
    console.log(`Kept active: ${keepActive.join(', ')}`);
    console.log(`\nTotal active products:`);
    const { rows: active } = await client.query('SELECT COUNT(*) FROM products WHERE is_active = true');
    console.log(`  ${active[0].count} products`);

    // 5. Summary
    console.log(`\n=== Migration Complete ===`);
    const { rows: all } = await client.query(
      'SELECT id, barcode, name, category, selling_price_ttc FROM products WHERE is_active = true ORDER BY category, name'
    );
    all.forEach(p => console.log(`  ${p.id} | ${p.barcode.padEnd(15)} | ${p.name.padEnd(25)} | ${(p.category||'').padEnd(25)} | ${p.selling_price_ttc} DT`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
