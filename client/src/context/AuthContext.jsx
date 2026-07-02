import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '../lib/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rightway_token';
const USER_KEY = 'rightway_user';
const EXPIRES_AT_KEY = 'rightway_expires_at';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in ms
const WARNING_BEFORE = 5 * 60 * 1000; // 5 minutes before expiry

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

  const executeLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
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
      const data = await apiPost('/auth/refresh', {});
      localStorage.setItem(TOKEN_KEY, data.token);
      const expiresAt = Date.now() + SESSION_DURATION;
      localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
      setToken(data.token);
      setShowExpiryModal(false);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await apiPost('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    const expiresAt = Date.now() + SESSION_DURATION;
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

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
        logout();
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
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      refreshSession,
      showExpiryModal,
      setShowExpiryModal,
      logout: executeLogout, // direct logout (session expiry, etc.)
      requestLogout,        // shows confirmation first (UI buttons)
      confirmLogout,
      cancelLogout,
      showLogoutConfirm,
      logoutSubmitting,
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
