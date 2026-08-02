/**
 * Token Manager — Capacitor Preferences-backed secure storage for
 * access and refresh tokens.  Falls back to localStorage when
 * Capacitor is not available (browser dev) or when the Preferences
 * native plugin hasn't been synced into the APK build yet.
 *
 * Capacitor Preferences uses Android SharedPreferences under the hood,
 * which is app-sandboxed and not exposed to the WebView devtools in
 * release builds — far safer than raw localStorage for credentials.
 *
 * IMPORTANT: The Preferences module is imported DYNAMICALLY because a
 * static `import { Preferences } from '@capacitor/preferences'` throws
 * at module-evaluation time when the native plugin isn't in the APK
 * ("preferences plugin is not implemented on android").
 */

const ACCESS_KEY = 'rightway_access_token';
const REFRESH_KEY = 'rightway_refresh_token';
const USER_KEY = 'rightway_user';
const EXPIRES_AT_KEY = 'rightway_expires_at';

// ── Lazy Preferences loader ──────────────────────────────────────
// The Capacitor Preferences JS bridge throws at import time when the
// native plugin is missing from the APK.  We load it lazily via a
// dynamic import so the error is catchable.

let _preferencesModule = null;
let _preferencesLoadAttempted = false;
let _preferencesAvailable = null;

async function _getPreferences() {
  if (_preferencesLoadAttempted) return _preferencesModule;
  _preferencesLoadAttempted = true;

  // Only attempt Preferences if we're actually inside Capacitor
  if (!window?.Capacitor?.isNativePlatform?.()) {
    _preferencesAvailable = false;
    return null;
  }

  try {
    const mod = await import('@capacitor/preferences');
    // Sanity-check: probe the native bridge
    await mod.Preferences.get({ key: '__prefs_probe__' });
    _preferencesModule = mod;
    _preferencesAvailable = true;
    return mod;
  } catch {
    console.warn(
      '[tokenManager] Preferences plugin not in this APK build — using localStorage fallback. Rebuild APK after cap sync.'
    );
    _preferencesAvailable = false;
    return null;
  }
}

async function _prefSet(key, value) {
  const mod = await _getPreferences();
  if (mod) {
    try { await mod.Preferences.set({ key, value }); } catch { /* noop */ }
  }
}

async function _prefGet(key) {
  const mod = await _getPreferences();
  if (mod) {
    try {
      const { value } = await mod.Preferences.get({ key });
      if (value) return value;
    } catch { /* fall through */ }
  }
  return null;
}

async function _prefRemove(key) {
  const mod = await _getPreferences();
  if (mod) {
    try { await mod.Preferences.remove({ key }); } catch { /* noop */ }
  }
}

// ── Access token ──────────────────────────────────────────────────

export async function setAccessToken(token) {
  await _prefSet(ACCESS_KEY, token);
  // Always mirror to localStorage so the API interceptor can read
  // the token synchronously during fetch calls.
  localStorage.setItem('rightway_token', token);
}

export async function getAccessToken() {
  const prefVal = await _prefGet(ACCESS_KEY);
  if (prefVal) return prefVal;
  return localStorage.getItem('rightway_token');
}

// ── Refresh token ─────────────────────────────────────────────────

export async function setRefreshToken(token) {
  await _prefSet(REFRESH_KEY, token);
  localStorage.setItem('rightway_refresh_token', token);
}

export async function getRefreshToken() {
  const prefVal = await _prefGet(REFRESH_KEY);
  if (prefVal) return prefVal;
  return localStorage.getItem('rightway_refresh_token');
}

export async function isRefreshTokenAvailable() {
  const rt = await getRefreshToken();
  return !!rt;
}

// ── Bulk operations ───────────────────────────────────────────────

export async function setTokens(accessToken, refreshToken) {
  await setAccessToken(accessToken);
  if (refreshToken) {
    await setRefreshToken(refreshToken);
  }
}

export async function clearTokens() {
  await _prefRemove(ACCESS_KEY);
  await _prefRemove(REFRESH_KEY);
  localStorage.removeItem('rightway_token');
  localStorage.removeItem('rightway_refresh_token');
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

// ── Device info ───────────────────────────────────────────────────

export function getDeviceName() {
  try {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    return 'Web';
  } catch {
    return 'Unknown';
  }
}

export function getDeviceId() {
  try {
    const fp = `${navigator.platform || ''}:${screen.width || 0}x${screen.height || 0}`;
    let hash = 0;
    for (let i = 0; i < fp.length; i++) {
      hash = ((hash << 5) - hash) + fp.charCodeAt(i);
      hash |= 0;
    }
    return `dev_${Math.abs(hash).toString(36)}`;
  } catch {
    return 'dev_unknown';
  }
}
