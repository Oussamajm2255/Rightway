import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '../lib/api';
import { unregisterNativePush } from '../lib/nativePush';
import {
  setTokens,
  getRefreshToken,
  clearTokens,
  isRefreshTokenAvailable,
  getDeviceName,
  getDeviceId,
} from '../lib/tokenManager';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rightway_token';
const USER_KEY = 'rightway_user';
const EXPIRES_AT_KEY = 'rightway_expires_at';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in ms
const WARNING_BEFORE = 5 * 60 * 1000; // 5 minutes before expiry

// ── Sync localStorage mirror read for initial render ──
// tokenManager always mirrors writes to localStorage, so this is
// safe for the synchronous useState initializer even in Capacitor.
function readInitialUser() {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readInitialUser);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

  const executeLogout = useCallback(() => {
    // Revoke the server-side refresh token (fire-and-forget).
    // Must happen BEFORE clearTokens() which wipes the token.
    getRefreshToken().then((rt) => {
      if (rt) {
        apiPost('/auth/logout', { refreshToken: rt }).catch(() => {});
      }
    });
    // Detach this device's push token from the user (needs the JWT,
    // which we're about to clear). Fire-and-forget.
    unregisterNativePush();
    // Clear all tokens (Capacitor Preferences + localStorage)
    clearTokens();
    setToken(null);
    setUser(null);
    setShowExpiryModal(false);
    setShowLogoutConfirm(false);
    setLogoutSubmitting(false);
  }, []);

  const requestLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const cancelLogout = useCallback(() => {
    setShowLogoutConfirm(false);
  }, []);

  const confirmLogout = useCallback(() => {
    setLogoutSubmitting(true);
    // Brief delay to show loading state, then execute
    setTimeout(() => executeLogout(), 150);
  }, [executeLogout]);

  const refreshSession = useCallback(async () => {
    try {
      // Try refresh-token rotation first (for "Keep me signed in" flow)
      const rt = await getRefreshToken();
      if (rt) {
        const data = await apiPost('/auth/refresh', { refreshToken: rt });
        await setTokens(data.token, data.refreshToken);
        const expiresAt = Date.now() + SESSION_DURATION;
        localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
        setToken(data.token);
        setShowExpiryModal(false);
        return true;
      }

      // Fallback: legacy JWT extension (within 5-min window)
      const data = await apiPost('/auth/refresh', {});
      await setTokens(data.token, null);
      const expiresAt = Date.now() + SESSION_DURATION;
      localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
      setToken(data.token);
      setShowExpiryModal(false);
      return true;
    } catch {
      executeLogout();
      return false;
    }
  }, [executeLogout]);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const data = await apiPost('/auth/login', {
      email,
      password,
      rememberMe,
      deviceName: getDeviceName(),
      deviceId: getDeviceId(),
    });
    await setTokens(data.token, data.refreshToken || null);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    const expiresAt = Date.now() + SESSION_DURATION;
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── Handle auth:expired custom event from api.js interceptor ──
  useEffect(() => {
    function handleAuthExpired() {
      executeLogout();
    }
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [executeLogout]);

  // ── Initial token verification ──
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiGet('/auth/me');
        const userData = data.user;
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setUser(userData);
      } catch {
        executeLogout();
      } finally {
        setLoading(false);
      }
    }
    verifyToken();
  }, [token, executeLogout]);

  // Session expiry timer
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
      if (!expiresAt) return;

      const remaining = Number(expiresAt) - Date.now();
      if (remaining <= 0) {
        executeLogout();
      } else if (remaining <= WARNING_BEFORE) {
        setShowExpiryModal(true);
      }
    };

    const interval = setInterval(checkExpiry, 30000); // Check every 30 seconds
    checkExpiry();

    return () => clearInterval(interval);
  }, [token, executeLogout]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      refreshSession,
      showExpiryModal,
      setShowExpiryModal,
      logout: executeLogout, // direct logout (session expiry, etc.)
      requestLogout,        // shows confirmation first (UI buttons)
      confirmLogout,
      cancelLogout,
      showLogoutConfirm,
      logoutSubmitting,
      hasPersistedSession: isRefreshTokenAvailable, // async check for auto-login gate
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
