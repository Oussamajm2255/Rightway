const pool = require('./pool');

// Tunisia city coordinates mapped to realistic distribution
const TUNISIA_LOCATIONS = [
  { name: 'Tunis — Centre-ville', lat: 36.8065, lng: 10.1815 },
  { name: 'Sfax — Médina',        lat: 34.7406, lng: 10.7603 },
  { name: 'Sousse — Corniche',    lat: 35.8256, lng: 10.6370 },
  { name: 'Kairouan — Centre',    lat: 35.6712, lng: 10.1005 },
  { name: 'Bizerte — Port',       lat: 37.2763, lng: 9.8724 },
  { name: 'Gabès — Oasis',        lat: 33.8880, lng: 10.0975 },
  { name: 'Nabeul — Dar Chaabane',lat: 36.4527, lng: 10.7342 },
  { name: 'Gafsa — Centre',       lat: 34.4311, lng: 8.7757 },
  { name: 'Monastir — Marina',    lat: 35.7643, lng: 10.8113 },
  { name: 'Ariana — Centre',      lat: 36.8665, lng: 10.1647 },
  { name: 'Ben Arous — Centre',   lat: 36.7474, lng: 10.2245 },
  { name: 'Médenine — Centre',    lat: 33.3550, lng: 10.5054 },
  { name: 'Kasserine — Centre',   lat: 35.1675, lng: 8.8287 },
  { name: 'Mahdia — Port',        lat: 35.5025, lng: 11.0453 },
  { name: 'El Kef — Médina',      lat: 36.1741, lng: 8.7047 },
  { name: 'Siliana — Centre',     lat: 36.0833, lng: 9.3667 },
  { name: 'Zaghouan — Centre',    lat: 36.4000, lng: 10.1500 },
  { name: 'Béja — Centre',        lat: 36.7256, lng: 9.1817 },
  { name: 'Jendouba — Centre',    lat: 36.5000, lng: 8.7833 },
  { name: 'Tataouine — Ksar',     lat: 32.9297, lng: 10.4517 },
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS commercial_locations (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        latitude NUMERIC(10, 7) NOT NULL,
        longitude NUMERIC(10, 7) NOT NULL,
        location_name VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_commercial_locations_user ON commercial_locations(user_id);
    `);

    // Fetch all active COMMERCIAL users
    const { rows: commercials } = await client.query(
      "SELECT id FROM users WHERE role = 'COMMERCIAL' AND is_active = true"
    );

    if (commercials.length === 0) {
      console.log('No COMMERCIAL users found — skipping seed.');
      await client.query('COMMIT');
      return;
    }

    // Assign each commercial a unique Tunisia location (wrap if more users than locations)
    let seeded = 0;
    for (let i = 0; i < commercials.length; i++) {
      const loc = TUNISIA_LOCATIONS[i % TUNISIA_LOCATIONS.length];

      await client.query(
        `INSERT INTO commercial_locations (user_id, latitude, longitude, location_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           location_name = EXCLUDED.location_name,
           updated_at = NOW()`,
        [commercials[i].id, loc.lat, loc.lng, loc.name]
      );
      seeded++;
    }

    await client.query('COMMIT');
    console.log(`Migration complete: ${seeded} commercial(s) seeded with Tunisia locations.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
