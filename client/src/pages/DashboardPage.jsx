import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import './DashboardPage.css';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const endpoint = `/dashboard/${user.role === 'SUPER_ADMIN' ? 'super-admin' : user.role === 'ADMIN' ? 'admin' : 'commercial'}`;
        const result = await apiGet(endpoint);
        setData(result);
      } catch {} finally { setLoading(false); }
    }
    fetchDashboard();
  }, [user.role]);

  if (loading) return <div className="page-container"><div className="loading-state">Chargement...</div></div>;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Bienvenue, {user?.full_name}</p>
        </div>
        <button className="btn btn-outline-danger" onClick={logout}>Se déconnecter</button>
      </div>

      {user.role === 'SUPER_ADMIN' && <SuperAdminDashboard data={data} navigate={navigate} />}
      {user.role === 'ADMIN' && <AdminDashboard data={data} navigate={navigate} />}
      {user.role === 'COMMERCIAL' && <CommercialDashboard data={data} navigate={navigate} />}
    </div>
  );
}

function StatCard({ title, value, subtitle, color, onClick }) {
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} style={color ? { borderLeftColor: color } : {}}>
      <div className="stat-title">{title}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}

/* ===== SUPER ADMIN ===== */
function SuperAdminDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <div>
      <div className="stats-grid">
        <StatCard title="Utilisateurs actifs" value={data.users_count} onClick={() => navigate('/users')} />
        <StatCard title="Produits" value={data.products_count} onClick={() => navigate('/products')} />
        <StatCard title="Livraisons actives" value={data.active_livraisons} color="var(--color-warning)" onClick={() => navigate('/livraisons')} />
        <StatCard title="CA Total" value={formatDT(data.ca_total)} color="var(--color-primary)" />
      </div>

      {data.stock_alerts && data.stock_alerts.length > 0 && (
        <div className="detail-section">
          <h2>Alerte Stock (&lt; 20)</h2>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Produit</th><th>Stock</th></tr></thead>
              <tbody>
                {data.stock_alerts.map((a) => (
                  <tr key={a.id} className="row-alert"><td className="td-code">{a.id}</td><td>{a.name}</td><td className="td-qty qty-low">{a.quantity}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== ADMIN ===== */
function AdminDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <div>
      <div className="stats-grid">
        <StatCard title="Produits en stock" value={data.stock_products} onClick={() => navigate('/stock')} />
        <StatCard title="Unités totales" value={data.stock_total_qty} />
        <StatCard title="Livraisons actives" value={data.active_livraisons} color="var(--color-warning)" onClick={() => navigate('/livraisons')} />
        <StatCard title="En attente" value={data.pending_livraisons} color="#e65100" onClick={() => navigate('/livraisons')} />
      </div>

      {data.stock_alerts && data.stock_alerts.length > 0 && (
        <div className="detail-section">
          <h2>Alerte Stock (&lt; 20)</h2>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Produit</th><th>Stock</th></tr></thead>
              <tbody>
                {data.stock_alerts.map((a) => (
                  <tr key={a.id} className="row-alert"><td className="td-code">{a.id}</td><td>{a.name}</td><td className="td-qty qty-low">{a.quantity}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="detail-section" style={{ marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/livraisons/nouvelle')}>+ Nouvelle livraison</button>
        <button className="btn btn-outline" style={{ marginLeft: '0.75rem' }} onClick={() => navigate('/stock')}>Gérer le stock</button>
      </div>
    </div>
  );
}

/* ===== COMMERCIAL ===== */
function CommercialDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <div>
      {/* Pending Bon de Sortie alerts */}
      {data.pending_bons && data.pending_bons.length > 0 && (
        <div className="detail-section">
          <h2>Bons de sortie en attente</h2>
          {data.pending_bons.map((bon) => (
            <div key={bon.id} className="alert-card" onClick={() => navigate(`/livraisons/${bon.id}`)} style={{ cursor: 'pointer' }}>
              <div className="alert-icon">📋</div>
              <div className="alert-body">
                <strong>{bon.reference}</strong>
                <p>Créé par {bon.admin_name} le {new Date(bon.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <button className="btn btn-primary btn-sm">Confirmer</button>
            </div>
          ))}
        </div>
      )}

      {/* Active livraison */}
      {data.active_livraison && (
        <div className="detail-section">
          <h2>Livraison en cours</h2>
          <div className="alert-card" style={{ borderColor: 'var(--color-primary)', background: '#f0fdf4' }}>
            <div className="alert-icon">🚚</div>
            <div className="alert-body">
              <strong>{data.active_livraison.reference}</strong>
              <p>En cours depuis le {new Date(data.active_livraison.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ventes/${data.active_livraison.id}`)}>Ventes</button>
            </div>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <StatCard title="CA Total" value={formatDT(data.ca_total)} color="var(--color-primary)" />
        <StatCard title="Commission (10%)" value={formatDT(data.commission)} color="#15803d" />
      </div>

      {/* Recent history */}
      {data.recent_livraisons && data.recent_livraisons.length > 0 && (
        <div className="detail-section">
          <h2>Historique récent</h2>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Référence</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {data.recent_livraisons.map((l) => (
                  <tr key={l.id} className="clickable-row" onClick={() => navigate(`/livraisons/${l.id}`)}>
                    <td className="td-code">{l.reference}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="td-date">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = { EN_ATTENTE_COMMERCIAL: 'En attente', EN_COURS: 'En cours', EN_RETOUR: 'En retour', CLOTURE: 'Clôturé' };
  const cls = { EN_ATTENTE_COMMERCIAL: 'badge-status-pending', EN_COURS: 'badge-status-active', EN_RETOUR: 'badge-status-warning', CLOTURE: 'badge-status-closed' }[status] || '';
  return <span className={`badge ${cls}`}>{labels[status] || status}</span>;
}

export default DashboardPage;
