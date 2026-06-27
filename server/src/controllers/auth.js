const pool = require('../db/pool');
const { verifyPassword } = require('../utils/password');
const { signToken, verifyToken, canRefreshToken } = require('../utils/jwt');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_hash, role, phone, vehicle_name, vehicle_plate,
              is_active, failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      // Account does not exist — do NOT leak existence.
      // IP-based rate limiter handles brute-force from the network layer.
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = rows[0];

    // Per-account brute-force protection: exponential backoff lockout.
    // Never permanently lock — lockout expires based on attempt count.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    if (!user.is_active) {
      // Clear failed attempts for deactivated accounts (don't keep them locked)
      await pool.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id]
      );
      return res.status(403).json({ error: 'Votre compte a été désactivé. Contactez un administrateur.' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Increment failed attempts with exponential backoff lockout.
      // Lockout duration = 2^(attempts-1) seconds, capped at 15 minutes.
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const lockSeconds = Math.min(Math.pow(2, newAttempts - 1), 900);
      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             locked_until = NOW() + INTERVAL '1 second' * $2
         WHERE id = $3`,
        [newAttempts, lockSeconds, user.id]
      );
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Successful login — reset lockout counter
    await pool.query(
      `UPDATE users
       SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL
       WHERE id = $1`,
      [user.id]
    );

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        vehicle_name: user.vehicle_name,
        vehicle_plate: user.vehicle_plate,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/auth/me
 * Returns current user from token
 */
async function me(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, phone, vehicle_name, vehicle_plate, is_active, last_login_at, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * POST /api/auth/refresh
 * Silently refreshes token if within 5 minutes of expiry
 * Body: { token } (optional — can also read from Authorization header)
 */
async function refresh(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const token = (req.body.token) || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(400).json({ error: 'Token requis.' });
    }

    if (!canRefreshToken(token)) {
      return res.status(400).json({ error: 'Le token ne peut pas être prolongé pour le moment. La prolongation est possible uniquement dans les 5 dernières minutes avant expiration.' });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Token invalide.' });
    }

    const newToken = signToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    res.json({ token: newToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { login, me, refresh };
