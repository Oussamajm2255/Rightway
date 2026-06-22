import { useAuth } from '../context/AuthContext';
import './SessionExpiryModal.css';

function SessionExpiryModal() {
  const { showExpiryModal, refreshSession, logout, setShowExpiryModal } = useAuth();

  if (!showExpiryModal) return null;

  async function handleRefresh() {
    const success = await refreshSession();
    if (!success) {
      // refreshSession calls logout on failure
    }
  }

  function handleDismiss() {
    setShowExpiryModal(false);
  }

  return (
    <div className="session-expiry-overlay">
      <div className="session-expiry-card">
        <div className="session-expiry-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="session-expiry-title">Session expirant</h3>
        <p className="session-expiry-message">
          Votre session expire dans 5 minutes. Souhaitez-vous la prolonger ?
        </p>
        <div className="session-expiry-actions">
          <button className="btn btn-primary" onClick={handleRefresh}>
            Prolonger la session
          </button>
          <button className="btn btn-secondary" onClick={handleDismiss}>
            Plus tard
          </button>
          <button className="btn btn-outline-danger" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiryModal;
