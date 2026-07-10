import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../lib/api';
import './SettingsPage.css';

export default function SettingsPage() {
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetch() {
      try {
        const data = await apiGet('/users/me/tracking');
        setTrackingEnabled(data.location_tracking_enabled);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  async function handleToggle() {
    const next = !trackingEnabled;
    setToggling(true);
    setError('');
    try {
      await apiPut('/users/me/tracking', { enabled: next });
      setTrackingEnabled(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">Chargement des paramètres…</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Paramètres</h1>
        <p className="settings-subtitle">Gérez vos préférences de confidentialité et de compte</p>
      </div>

      {/* ─── GPS Tracking Card ─── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 2a8 8 0 00-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 00-8-8z"/>
            <line x1="12" y1="2" x2="12" y2="4"/>
            <line x1="12" y1="20" x2="12" y2="22"/>
            <line x1="2" y1="10" x2="4" y2="10"/>
            <line x1="20" y1="10" x2="22" y2="10"/>
          </svg>
          <div className="settings-card-title">
            <h3>Partage de localisation</h3>
            <p>
              {trackingEnabled
                ? 'Votre position en temps réel est partagée avec la direction sur la carte de suivi.'
                : 'Activez pour partager votre position en temps réel avec la direction.'}
            </p>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="tracking-info">
            <span className="tracking-status-label">Suivi GPS</span>
            <span className={`tracking-status-badge ${trackingEnabled ? 'enabled' : 'disabled'}`}>
              {trackingEnabled ? 'Activé' : 'Désactivé'}
            </span>
          </div>

          <button
            className={`settings-toggle ${trackingEnabled ? 'active' : ''}`}
            onClick={handleToggle}
            disabled={toggling}
            aria-label={trackingEnabled ? 'Désactiver le suivi' : 'Activer le suivi'}
          >
            <span className="toggle-track" />
            <span className="toggle-label">
              {toggling ? 'En cours…' : trackingEnabled ? 'Désactiver' : 'Activer'}
            </span>
          </button>

          {error && <p className="settings-error">{error}</p>}

          <div className="tracking-privacy-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>
              {trackingEnabled
                ? 'Vous pouvez désactiver le suivi à tout moment. Votre dernière position sera effacée.'
                : 'Votre position ne sera pas collectée. Vous gardez le contrôle total de votre vie privée.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
