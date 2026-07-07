const bcrypt = require('bcryptjs');
const pool = require('./pool');

const BCRYPT_ROUNDS = 12;

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting seed...');

    // ============================================================
    // Hash passwords
    // ============================================================
    const superAdminHash = await bcrypt.hash(process.env.SEED_SUPER_ADMIN_PASSWORD || 'RightWay@2026', BCRYPT_ROUNDS);
    const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@2026', BCRYPT_ROUNDS);
    const commercialHash = await bcrypt.hash(process.env.SEED_COMMERCIAL_PASSWORD || 'Commercial@2026', BCRYPT_ROUNDS);

    // ============================================================
    // USERS
    // ============================================================
    console.log('Seeding users...');

    await client.query(`
      INSERT INTO users (id, full_name, email, password_hash, role, phone, vehicle_name, vehicle_plate)
      VALUES
        (gen_random_uuid(), 'Super Admin', 'superadmin@rightway.tn', $1, 'SUPER_ADMIN', NULL, NULL, NULL),
        (gen_random_uuid(), 'Directeur Commercial', 'admin@rightway.tn', $2, 'DIRECTEUR_COMMERCIAL', NULL, NULL, NULL),
        (gen_random_uuid(), 'Smir', 'smir@rightway.tn', $3, 'COMMERCIAL', '+216 22 111 222', 'Isuzu NPR', '215 TUN 1234'),
        (gen_random_uuid(), 'Haithem', 'haithem@rightway.tn', $3, 'COMMERCIAL', '+216 55 333 444', 'Renault Master', '216 TUN 5678'),
        (gen_random_uuid(), 'Naoufel', 'naoufel@rightway.tn', $3, 'COMMERCIAL', '+216 98 555 666', 'Peugeot Boxer', '217 TUN 9012'),
        (gen_random_uuid(), 'Ayoub', 'ayoub@rightway.tn', $3, 'COMMERCIAL', '+216 23 777 888', 'Fiat Ducato', '218 TUN 3456')
    `, [superAdminHash, adminHash, commercialHash]);

    // ============================================================
    // PRODUCTS
    // ============================================================
    console.log('Seeding products...');

    await client.query(`
      INSERT INTO products (id, barcode, name, category, purchase_price, selling_price_ttc)
      VALUES
        ('PROD-001', 'KAK01', 'KAKITO FOUR', 'Biscuits', 6.500, 10.000),
        ('PROD-002', 'KAK02', 'KAKITO MOKLI', 'Biscuits', 4.875, 7.500),
        ('PROD-003', 'CO001', 'SABLE', 'Biscuits', 9.100, 14.000),
        ('PROD-004', 'CSS001', 'COOKIES SANS SUCRE', 'Gateaux', 14.300, 22.000),
        ('PROD-005', 'BR01', 'BROWNIE', 'Gateaux', 13.650, 21.000),
        ('PROD-006', 'AM001', 'AMANDIES', 'Gateaux', 10.920, 16.800),
        ('PROD-007', 'MA01', 'Cake MARIO', 'Gateaux', 12.025, 18.500),
        ('PROD-008', 'VAL001', 'Cake VALENTINO', 'Gateaux', 15.275, 23.500),
        ('PROD-009', 'DB001', 'DATE BAR', 'Gateaux', 27.300, 42.000),
        ('PROD-010', 'GAUF01', 'GAUFRETTE 80G', 'Biscuits', 13.260, 20.400),
        ('PROD-011', 'BIS001', 'BISCUIT 190G', 'Biscuits', 18.850, 29.000),
        ('PROD-012', 'CK001', 'LANGUE DE CHAT GOUTINEL', 'Biscuits', 17.550, 27.000)
    `);

    // ============================================================
    // DEPOT STOCK
    // ============================================================
    console.log('Seeding depot stock...');

    await client.query(`
      INSERT INTO depot_stock (product_id, quantity)
      VALUES
        ('PROD-001', 508),
        ('PROD-002', 295),
        ('PROD-003', 286),
        ('PROD-004', 50),
        ('PROD-005', 298),
        ('PROD-006', 248),
        ('PROD-007', 30),
        ('PROD-008', 30),
        ('PROD-009', 300),
        ('PROD-010', 205),
        ('PROD-011', 69),
        ('PROD-012', 50)
    `);

    console.log('Seed completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = seed;
