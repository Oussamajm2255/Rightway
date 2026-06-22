import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
      navigate('/');
    } catch (err) {
      setError(err.message || 'Échec de la connexion. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Right Way</h1>
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
              autoFocus
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
            />
          </div>

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
