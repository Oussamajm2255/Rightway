import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { formatDateTime } from '../lib/utils';
import './LivraisonsPage.css';

const STATUS_LABELS = {
  EN_ATTENTE_COMMERCIAL: 'En attente commercial',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  EN_RETOUR: 'En retour',
  EN_ATTENTE_ANNULATION: 'Annulation demandée',
  ANNULE: 'Annulé',
  CLOTURE: 'Clôturé',
};

function getStatusBadge(status) {
  const className = {
    EN_ATTENTE_COMMERCIAL: 'badge-status-pending',
    CONFIRME: 'badge-status-info',
    EN_COURS: 'badge-status-active',
    EN_RETOUR: 'badge-status-warning',
    EN_ATTENTE_ANNULATION: 'badge-status-warning',
    ANNULE: 'badge-status-closed',
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
                <th style={{textAlign:'center'}}>Avance</th>
                <th style={{textAlign:'center'}}>Écart</th>
                <th>Créé par</th>
                <th>Date</th>
                <th>Clôturé</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l) => (
                <tr
                  key={l.id}
                  className={`clickable-row${l.has_pending_ecart ? ' row-ecart-pending' : ''}`}
                  onClick={() => navigate(`/livraisons/${l.id}`)}
                >
                  <td className="td-code">{l.reference}</td>
                  <td>{l.commercial_name}</td>
                  <td>
                    {l.vehicle_name}
                    {l.vehicle_plate && <span className="vehicle-plate">{l.vehicle_plate}</span>}
                  </td>
                  <td>{getStatusBadge(l.status)}</td>
                  <td style={{textAlign:'center'}}>
                    {l.has_avance ? (
                      <span style={{color:'var(--color-primary)', fontWeight:500, fontSize:'0.85rem'}} title={`${Number(l.total_avances).toFixed(3)} DT`}>
                        ✔ {Number(l.total_avances).toFixed(3)} DT
                      </span>
                    ) : (
                      <span style={{color:'var(--color-text-muted)', fontSize:'0.75rem'}}>—</span>
                    )}
                  </td>
                  <td style={{textAlign:'center'}}>
                    {l.has_pending_ecart ? (
                      <span className="ecart-badge ecart-badge-pending" title="Écart en attente de confirmation">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        En attente
                      </span>
                    ) : l.has_ecart ? (
                      <span className="ecart-badge ecart-badge-resolved" title="Écart résolu">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        Résolu
                      </span>
                    ) : (
                      <span style={{color:'var(--color-text-muted)', fontSize:'0.75rem'}}>—</span>
                    )}
                  </td>
                  <td>{l.admin_name}</td>
                  <td className="td-date">
                    {formatDateTime(l.created_at)}
                  </td>
                  <td className="td-date">
                    {l.closed_at ? formatDateTime(l.closed_at) : '—'}
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
