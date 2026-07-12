import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const REMEMBER_EMAIL_KEY = 'rightway_remembered_email';
const REMEMBER_PASS_KEY = 'rightway_remembered_pass';   // base64
const REMEMBER_PREF_KEY = 'rightway_remember_me';

function encode(s) {
  try { return btoa(unescape(encodeURIComponent(s))); } catch { return ''; }
}
function decode(s) {
  try { return decodeURIComponent(escape(atob(s))); } catch { return ''; }
}

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

  // ── Auto-login on mount when credentials are saved ──
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    const savedPass = localStorage.getItem(REMEMBER_PASS_KEY);
    const savedPref = localStorage.getItem(REMEMBER_PREF_KEY);

    if (savedEmail && savedPass && savedPref === 'true') {
      const decodedPass = decode(savedPass);
      if (decodedPass) {
        setEmail(savedEmail);
        setPassword(decodedPass);
        setRememberMe(true);
        setAutoLogging(true);

        login(savedEmail, decodedPass)
          .then(() => navigate('/', { replace: true }))
          .catch(() => {
            // Credentials stale — form stays visible, pre-filled
            setAutoLogging(false);
          });
        return;
      }
    }

    // Partial restore (email only)
    if (savedEmail) setEmail(savedEmail);
    if (savedPref === 'true') setRememberMe(true);
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
      await login(email, password);

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        localStorage.setItem(REMEMBER_PASS_KEY, encode(password));
        localStorage.setItem(REMEMBER_PREF_KEY, 'true');
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
        localStorage.removeItem(REMEMBER_PASS_KEY);
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
            <span>Se souvenir de moi</span>
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
