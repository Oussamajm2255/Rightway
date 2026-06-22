const { verifyToken } = require('../utils/jwt');
const pool = require('../db/pool');

/**
 * Authenticate — verify JWT from Authorization header.
 * Sets req.user with { id, email, full_name, role }.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
    }

    // Verify user still exists and is active
    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Compte introuvable.' });
    }

    if (!rows[0].is_active) {
      return res.status(403).json({ error: 'Votre compte a été désactivé. Contactez un administrateur.' });
    }

    req.user = {
      id: rows[0].id,
      email: rows[0].email,
      full_name: rows[0].full_name,
      role: rows[0].role,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * Authorize — check if req.user.role is in allowed roles.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé. Vous n\'avez pas les droits nécessaires.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
