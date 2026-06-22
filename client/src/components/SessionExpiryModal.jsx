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
    // Will show again on next check if still within warning window
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon">⏳</div>
        <h3 className="modal-title">Session expirant</h3>
        <p className="modal-message">
          Votre session expire dans 5 minutes. Souhaitez-vous la prolonger ?
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleDismiss}>
            Plus tard
          </button>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Prolonger la session
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
