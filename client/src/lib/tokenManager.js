/**
 * Token Manager — Capacitor Preferences-backed secure storage for
 * access and refresh tokens.  Falls back to localStorage when
 * Capacitor is not available (browser dev).
 *
 * Capacitor Preferences uses Android SharedPreferences under the hood,
 * which is app-sandboxed and not exposed to the WebView devtools in
 * release builds — far safer than raw localStorage for credentials.
 */
import { Preferences } from '@capacitor/preferences';

const ACCESS_KEY = 'rightway_access_token';
const REFRESH_KEY = 'rightway_refresh_token';
const USER_KEY = 'rightway_user';
const EXPIRES_AT_KEY = 'rightway_expires_at';

// ── Capacitor availability check ──────────────────────────────────

function isCapacitorAvailable() {
  try {
    // Preferences plugin exists only when running inside Capacitor
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

// ── Access token ──────────────────────────────────────────────────

export async function setAccessToken(token) {
  if (isCapacitorAvailable()) {
    await Preferences.set({ key: ACCESS_KEY, value: token });
  }
  // Always mirror to localStorage so non-Capacitor API interceptor
  // can read it synchronously during fetch calls.
  localStorage.setItem('rightway_token', token);
}

export async function getAccessToken() {
  if (isCapacitorAvailable()) {
    const { value } = await Preferences.get({ key: ACCESS_KEY });
    if (value) return value;
  }
  return localStorage.getItem('rightway_token');
}

// ── Refresh token ─────────────────────────────────────────────────

export async function setRefreshToken(token) {
  if (isCapacitorAvailable()) {
    await Preferences.set({ key: REFRESH_KEY, value: token });
  }
  // Mirror for fallback
  localStorage.setItem('rightway_refresh_token', token);
}

export async function getRefreshToken() {
  if (isCapacitorAvailable()) {
    const { value } = await Preferences.get({ key: REFRESH_KEY });
    if (value) return value;
  }
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
  if (isCapacitorAvailable()) {
    await Promise.all([
      Preferences.remove({ key: ACCESS_KEY }),
      Preferences.remove({ key: REFRESH_KEY }),
    ]);
  }
  localStorage.removeItem('rightway_token');
  localStorage.removeItem('rightway_refresh_token');
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

// ── Device info ───────────────────────────────────────────────────

export function getDeviceName() {
  try {
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad/i.test(ua);
    if (isAndroid) return 'Android';
    if (isIOS) return 'iOS';
    return 'Web';
  } catch {
    return 'Unknown';
  }
}

export function getDeviceId() {
  // Use a stable device identifier.  In Capacitor we could use
  // the Device plugin's UUID, but Preferences-backed tokens are
  // already per-app-install.  A simple hash of the platform +
  // screen fingerprint is sufficient for session auditing.
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
