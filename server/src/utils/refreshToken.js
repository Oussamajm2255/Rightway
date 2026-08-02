const crypto = require('crypto');
const pool = require('../db/pool');

const REFRESH_TOKEN_BYTES = 48; // 48 random bytes = 96 hex chars
const REFRESH_TOKEN_DAYS = 30; // 30-day lifetime for "Keep me signed in"

// ── Token generation ─────────────────────────────────────────────

function generateRefreshToken() {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
}

// ── Persistence ───────────────────────────────────────────────────

async function storeRefreshToken(userId, hashedToken, deviceName, deviceId) {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_name, device_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hashedToken, deviceName || null, deviceId || null, expiresAt]
  );
}

async function findAndValidateRefreshToken(hashedToken) {
  const { rows } = await pool.query(
    `SELECT rt.*, u.is_active AS user_active, u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [hashedToken]
  );
  if (rows.length === 0) return null;

  const token = rows[0];

  // Check if this token was already rotated (replaced by a newer one).
  // This is a potential token-theft signal — the legitimate client would
  // have discarded the old token after rotation.
  if (token.revoked && token.replaced_by) {
    return { ...token, error: 'TOKEN_REUSED' };
  }
  if (token.revoked) return { ...token, error: 'TOKEN_REVOKED' };
  if (!token.user_active) return { ...token, error: 'USER_INACTIVE' };
  if (new Date(token.expires_at) < new Date()) return { ...token, error: 'TOKEN_EXPIRED' };

  return token;
}

// ── Rotation ──────────────────────────────────────────────────────

async function rotateRefreshToken(oldHashed, newHashed) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE, replaced_by = $1 WHERE token_hash = $2`,
    [newHashed, oldHashed]
  );
}

// ── Revocation ────────────────────────────────────────────────────

async function revokeAllUserTokens(userId) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
    [userId]
  );
}

async function revokeTokenByHash(hashedToken) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [hashedToken]
  );
}

// ── Housekeeping ──────────────────────────────────────────────────

async function cleanupExpiredTokens() {
  await pool.query(
    `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`
  );
}

module.exports = {
  generateRefreshToken,
  storeRefreshToken,
  findAndValidateRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeTokenByHash,
  cleanupExpiredTokens,
  REFRESH_TOKEN_DAYS,
};
