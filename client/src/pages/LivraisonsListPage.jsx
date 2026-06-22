import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import './LivraisonsPage.css';

const STATUS_LABELS = {
  EN_ATTENTE_COMMERCIAL: 'En attente commercial',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  EN_RETOUR: 'En retour',
  CLOTURE: 'Clôturé',
};

function getStatusBadge(status) {
  const className = {
    EN_ATTENTE_COMMERCIAL: 'badge-status-pending',
    CONFIRME: 'badge-status-info',
    EN_COURS: 'badge-status-active',
    EN_RETOUR: 'badge-status-warning',
    CLOTURE: 'badge-status-closed',
  }[status] || '';

  return (
    <span className={`badge ${className}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function LivraisonsListPage() {
  const [livraisons, setLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const fetchLivraisons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const data = await apiGet(`/livraisons?${params.toString()}`);
      setLivraisons(data.livraisons);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLivraisons(); }, [fetchLivraisons]);

  return (
    <div className="livraisons-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Livraisons</h1>
          <p className="page-subtitle">Toutes les livraisons</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/livraisons/nouvelle')}>
          + Nouvelle livraison
        </button>
      </div>

      <div className="filters-bar">
        <select
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state">Chargement...</div>
      ) : livraisons.length === 0 ? (
        <div className="empty-state"><p>Aucune livraison trouvée.</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Commercial</th>
                <th>Véhicule</th>
                <th>Statut</th>
                <th>Créé par</th>
                <th>Date</th>
                <th>Clôturé</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l) => (
                <tr
                  key={l.id}
                  className="clickable-row"
                  onClick={() => navigate(`/livraisons/${l.id}`)}
                >
                  <td className="td-code">{l.reference}</td>
                  <td>{l.commercial_name}</td>
                  <td>
                    {l.vehicle_name}
                    {l.vehicle_plate && <span className="vehicle-plate">{l.vehicle_plate}</span>}
                  </td>
                  <td>{getStatusBadge(l.status)}</td>
                  <td>{l.admin_name}</td>
                  <td className="td-date">
                    {new Date(l.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="td-date">
                    {l.closed_at ? new Date(l.closed_at).toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LivraisonsListPage;
