import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isRefreshTokenAvailable, getRefreshToken } from '../lib/tokenManager';
import { apiPost } from '../lib/api';
import './LoginPage.css';

const REMEMBER_PREF_KEY = 'rightway_remember_me';
const LAST_EMAIL_KEY = 'rightway_last_email'; // non-sensitive, pre-fill only

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const mounted = useRef(false);
  const autoLoginAttempted = useRef(false);

  // ── Auto-login on mount using refresh token ──
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    async function attemptAutoLogin() {
      if (autoLoginAttempted.current) return;
      autoLoginAttempted.current = true;

      const hasRT = await isRefreshTokenAvailable();
      if (!hasRT) {
        // No persisted session — pre-fill email only
        const savedEmail = localStorage.getItem(LAST_EMAIL_KEY);
        if (savedEmail) setEmail(savedEmail);
        const savedPref = localStorage.getItem(REMEMBER_PREF_KEY);
        if (savedPref === 'true') setRememberMe(true);
        return;
      }

      setAutoLogging(true);
      try {
        const rt = await getRefreshToken();
        const data = await apiPost('/auth/refresh', { refreshToken: rt });

        // Refresh succeeded — store tokens and redirect
        const { setTokens: storeTokens } = await import('../lib/tokenManager');
        await storeTokens(data.token, data.refreshToken || null);

        // Fetch user info to populate AuthContext
        const { apiGet } = await import('../lib/api');
        const userData = await apiGet('/auth/me');
        localStorage.setItem('rightway_user', JSON.stringify(userData.user));
        localStorage.setItem('rightway_expires_at', String(Date.now() + 8 * 60 * 60 * 1000));
        localStorage.setItem('rightway_token', data.token);

        navigate('/', { replace: true });
      } catch {
        // Refresh token expired/revoked — show login form
        setAutoLogging(false);
        const savedEmail = localStorage.getItem(LAST_EMAIL_KEY);
        if (savedEmail) setEmail(savedEmail);
      }
    }

    attemptAutoLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual submit ──
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password, rememberMe);

      // Store preferences (email is non-sensitive, safe to keep)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_PREF_KEY, 'true');
        localStorage.setItem(LAST_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_PREF_KEY);
      }

      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Échec de la connexion. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Auto-login placeholder UI (avoids flash of the form) ──
  if (autoLogging) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-logo">Right Way</h1>
            <p className="login-subtitle">STE RIGHT WAY FOR TRADING</p>
          </div>
          <div className="login-form" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div className="login-auto-spinner" />
            <p style={{ marginTop: 16, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Reconnexion automatique…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">Right Way</h1>
          <p className="login-subtitle">STE RIGHT WAY FOR TRADING</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-form-title">Connexion</h2>

          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="vous@rightway.tn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus={!email}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Mot de passe</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus={!!email}
            />
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Rester connecté</span>
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="login-footer">
          <p>MF: 1826056/P/N/M/000</p>
          <p>29 Rue de Palestine, 1002 Tunis</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
