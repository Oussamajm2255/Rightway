import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

/* ── Eye icon for show/hide toggle ── */
function IconEye({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  /* ── GPS tracking state (existing) ── */
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [forced, setForced] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  /* ── Password change state ── */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const currentRef = useRef(null);
  const newRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    async function fetch() {
      try {
        const data = await apiGet('/users/me/tracking');
        setTrackingEnabled(data.location_tracking_enabled);
        setForced(data.forced === true);
      } catch (err) {
        setTrackingError(err.message);
      } finally {
        setLoadingTracking(false);
      }
    }
    fetch();
  }, []);

  async function handleToggle() {
    const next = !trackingEnabled;
    setToggling(true);
    setTrackingError('');
    try {
      await apiPut('/users/me/tracking', { enabled: next });
      setTrackingEnabled(next);
    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setToggling(false);
    }
  }

  /* ── Password change logic ── */
  function resetPwForm() {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setPwError('');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');

    // Client-side validation
    if (!currentPw) {
      setPwError('Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (!newPw) {
      setPwError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (newPw === currentPw) {
      setPwError('Le nouveau mot de passe doit être différent de l\'actuel.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setChanging(true);
    try {
      await apiPut('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true);
      resetPwForm();
      // Force logout after 2s — security best practice: invalidate the JWT
      // that was used to authorize this request.
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setChanging(false);
    }
  }

  /* ── Focus next field on Enter ── */
  function handleKeyDown(ref, e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.focus();
    }
  }

  if (loadingTracking) {
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
        <p className="settings-subtitle">Gérez vos préférences de confidentialité et de sécurité</p>
      </div>

      {/* ─── GPS Tracking Card ─── */}
      {!forced && (
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

          {trackingError && <p className="settings-error">{trackingError}</p>}

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
      )}

      {/* ─── Security / Password Card ─── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <IconLock />
          <div className="settings-card-title">
            <h3>Sécurité</h3>
            <p>Changez votre mot de passe. Vous serez reconnecté après la modification.</p>
          </div>
        </div>

        <form className="settings-card-body" onSubmit={handleChangePassword} noValidate>
          {pwSuccess && (
            <p className="settings-saved">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mot de passe modifié avec succès. Redirection vers la connexion…
            </p>
          )}

          {pwError && <p className="settings-error">{pwError}</p>}

          {/* Current password */}
          <div className="pw-field">
            <label className="pw-label" htmlFor="pw-current">Mot de passe actuel</label>
            <div className="pw-input-wrap">
              <input
                ref={currentRef}
                id="pw-current"
                className="pw-input"
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                onKeyDown={e => handleKeyDown(newRef, e)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={changing || pwSuccess}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCurrent(v => !v)} tabIndex={-1} aria-label="Afficher le mot de passe">
                <IconEye visible={showCurrent} />
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="pw-field">
            <label className="pw-label" htmlFor="pw-new">Nouveau mot de passe</label>
            <div className="pw-input-wrap">
              <input
                ref={newRef}
                id="pw-new"
                className="pw-input"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                onKeyDown={e => handleKeyDown(confirmRef, e)}
                placeholder="Minimum 8 caractères"
                autoComplete="new-password"
                disabled={changing || pwSuccess}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNew(v => !v)} tabIndex={-1} aria-label="Afficher le mot de passe">
                <IconEye visible={showNew} />
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="pw-field">
            <label className="pw-label" htmlFor="pw-confirm">Confirmer le mot de passe</label>
            <div className="pw-input-wrap">
              <input
                ref={confirmRef}
                id="pw-confirm"
                className="pw-input"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess(false); }}
                placeholder="Répétez le nouveau mot de passe"
                autoComplete="new-password"
                disabled={changing || pwSuccess}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1} aria-label="Afficher le mot de passe">
                <IconEye visible={showConfirm} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="pw-submit"
            disabled={changing || pwSuccess}
          >
            {changing ? (
              <>
                <span className="pw-spinner" />
                Modification…
              </>
            ) : (
              'Changer le mot de passe'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
