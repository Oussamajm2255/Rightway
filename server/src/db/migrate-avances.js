// Migration: add livraison_avances table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS livraison_avances (
        id SERIAL PRIMARY KEY,
        livraison_id UUID REFERENCES livraisons(id) ON DELETE CASCADE,
        amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
        image_base64 TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
          CHECK (status IN ('EN_ATTENTE', 'ACCEPTE', 'REFUSE')),
        commercial_id UUID REFERENCES users(id),
        admin_id UUID REFERENCES users(id),
        admin_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_livraison_avances_livraison ON livraison_avances(livraison_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_livraison_avances_status ON livraison_avances(livraison_id, status);
    `);

    await client.query('COMMIT');
    console.log('Migration avances: table and indexes created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration avances failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
