const pool = require('../db/pool');

// GET /api/commercials/locations
// Returns all COMMERCIAL users' last known locations
async function getAllLocations(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        cl.user_id,
        cl.latitude,
        cl.longitude,
        cl.location_name,
        cl.updated_at,
        u.full_name,
        u.is_active
      FROM commercial_locations cl
      JOIN users u ON cl.user_id = u.id
      WHERE u.role = 'COMMERCIAL'
      ORDER BY u.full_name
    `);

    const locations = rows.map(r => ({
      user_id: r.user_id,
      full_name: r.full_name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      location_name: r.location_name,
      updated_at: r.updated_at,
      is_active: r.is_active,
    }));

    res.json({ locations });
  } catch (err) {
    console.error('getAllLocations error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// PUT /api/commercials/location
// Commercial updates their own GPS location
async function updateLocation(req, res) {
  const userId = req.user.id;
  const { latitude, longitude, location_name } = req.body;

  if (latitude == null || longitude == null || !location_name?.trim()) {
    return res.status(400).json({ error: 'latitude, longitude et location_name sont obligatoires' });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < 30 || lat > 38 || lng < 7 || lng > 12) {
    return res.status(400).json({ error: 'Coordonnées hors des limites de la Tunisie' });
  }

  try {
    await pool.query(
      `INSERT INTO commercial_locations (user_id, latitude, longitude, location_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         location_name = EXCLUDED.location_name,
         updated_at = NOW()`,
      [userId, lat, lng, location_name.trim()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { getAllLocations, updateLocation };
