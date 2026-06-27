const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: JWT_SECRET must be set in production environment.');
  }
  // Development-only fallback — never used in production
  console.warn('⚠ JWT_SECRET not set. Using insecure development key. NEVER deploy to production without JWT_SECRET.');
  module.exports.__DEV_SECRET = 'right-way-dev-only-2026';
}
function getSecret() {
  return JWT_SECRET || module.exports.__DEV_SECRET;
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_WINDOW = 5 * 60 * 1000; // 5 minutes before expiry

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

function decodeToken(token) {
  return jwt.decode(token);
}

function canRefreshToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = decoded.exp;
    const timeUntilExpiry = expiresAt - now;
    return timeUntilExpiry > 0 && timeUntilExpiry <= REFRESH_WINDOW / 1000;
  } catch {
    return false;
  }
}

module.exports = { signToken, verifyToken, decodeToken, canRefreshToken, getSecret, JWT_EXPIRES_IN };
