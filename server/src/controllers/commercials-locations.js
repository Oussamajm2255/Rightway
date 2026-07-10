const pool = require('../db/pool');

// GET /api/commercials/locations
// Returns all COMMERCIAL users who opted in — those with GPS data and those still pending
async function getAllLocations(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id AS user_id,
        cl.latitude,
        cl.longitude,
        cl.location_name,
        cl.updated_at,
        u.full_name,
        u.is_active
      FROM users u
      LEFT JOIN commercial_locations cl ON u.id = cl.user_id
      WHERE u.role = 'COMMERCIAL'
        AND (
          u.location_tracking_enabled = true
          OR COALESCE((SELECT force_location_tracking FROM global_settings WHERE id = 1), false) = true
        )
      ORDER BY u.full_name
    `);

    const locations = rows.map(r => ({
      user_id: r.user_id,
      full_name: r.full_name,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      location_name: r.location_name || null,
      updated_at: r.updated_at,
      is_active: r.is_active,
      has_location: r.latitude != null && r.longitude != null,
    }));

    res.json({ locations });
  } catch (err) {
    console.error('getAllLocations error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// PUT /api/commercials/location
// Commercial updates their own GPS location — only if tracking is enabled
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
    // Check tracking opt-in — allowed if the commercial opted in themselves
    // OR the company-wide forced-tracking switch is on (signed GPS consent).
    const { rows: userRows } = await pool.query(
      'SELECT location_tracking_enabled FROM users WHERE id = $1',
      [userId]
    );
    const { rows: gs } = await pool.query(
      'SELECT force_location_tracking FROM global_settings WHERE id = 1'
    );
    const forced = gs[0]?.force_location_tracking === true;
    if (!userRows[0] || (!userRows[0].location_tracking_enabled && !forced)) {
      return res.status(403).json({ error: 'Suivi de localisation désactivé. Activez-le dans Paramètres.' });
    }

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
