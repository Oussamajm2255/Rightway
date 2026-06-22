const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'right-way-jwt-secret-key-2026-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_WINDOW = 5 * 60 * 1000; // 5 minutes before expiry

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
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

module.exports = { signToken, verifyToken, decodeToken, canRefreshToken, JWT_SECRET, JWT_EXPIRES_IN };
