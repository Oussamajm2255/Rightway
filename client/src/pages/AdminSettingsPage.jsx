import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../lib/api';
import './SettingsPage.css';

export default function AdminSettingsPage() {
  const [day, setDay] = useState(1);
  const [forceTracking, setForceTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState(false);
  const [togglingGps, setTogglingGps] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    async function fetch() {
      try {
        const res = await apiGet('/prelevements/settings');
        setDay(res.settings?.salary_generation_day || 1);
        setForceTracking(res.settings?.force_location_tracking === true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  // Persist both fields together — the endpoint expects both.
  async function persist(nextDay, nextForce) {
    await apiPut('/prelevements/settings', {
      salary_generation_day: parseInt(nextDay),
      force_location_tracking: nextForce,
    });
  }

  async function handleToggleGps() {
    const next = !forceTracking;
    setTogglingGps(true);
    setError('');
    setSaved('');
    try {
      await persist(day, next);
      setForceTracking(next);
      setSaved(next ? 'Suivi GPS activé pour tous les commerciaux.' : 'Suivi GPS obligatoire désactivé.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingGps(false);
    }
  }

  async function handleSaveDay() {
    setSavingDay(true);
    setError('');
    setSaved('');
    try {
      await persist(day, forceTracking);
      setSaved('Jour de génération enregistré.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDay(false);
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
        <p className="settings-subtitle">Configuration globale de l'entreprise</p>
      </div>

      {error && <p className="settings-error">{error}</p>}
      {saved && <p className="settings-saved">{saved}</p>}

      {/* ─── Forced GPS Tracking Card ─── */}
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
            <h3>Suivi GPS obligatoire</h3>
            <p>
              {forceTracking
                ? 'La position de tous les commerciaux est suivie automatiquement, sans action de leur part.'
                : 'Activez pour suivre automatiquement tous les commerciaux (autorisation GPS signée).'}
            </p>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="tracking-info">
            <span className="tracking-status-label">Suivi de tous les commerciaux</span>
            <span className={`tracking-status-badge ${forceTracking ? 'enabled' : 'disabled'}`}>
              {forceTracking ? 'Activé' : 'Désactivé'}
            </span>
          </div>

          <button
            className={`settings-toggle ${forceTracking ? 'active' : ''}`}
            onClick={handleToggleGps}
            disabled={togglingGps}
            aria-label={forceTracking ? 'Désactiver le suivi obligatoire' : 'Activer le suivi obligatoire'}
          >
            <span className="toggle-track" />
            <span className="toggle-label">
              {togglingGps ? 'En cours…' : forceTracking ? 'Désactiver' : 'Activer'}
            </span>
          </button>

          <div className="tracking-privacy-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>
              Lorsque activé, les commerciaux n'ont pas besoin d'activer le suivi depuis leur téléphone.
              La case « Suivi GPS » disparaît de leurs paramètres.
            </span>
          </div>
        </div>
      </div>

      {/* ─── Salary Generation Day Card ─── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div className="settings-card-title">
            <h3>Génération des salaires</h3>
            <p>Jour du mois où les prélèvements de salaires sont générés automatiquement (statut « EN ATTENTE »).</p>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="tracking-info">
            <span className="tracking-status-label">Jour de génération (1–28)</span>
            <input
              type="number"
              min="1"
              max="28"
              value={day}
              onChange={e => setDay(e.target.value)}
              style={{ width: '80px', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '15px', textAlign: 'center' }}
            />
          </div>

          <button
            className="settings-toggle active"
            onClick={handleSaveDay}
            disabled={savingDay}
          >
            <span className="toggle-label">{savingDay ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
