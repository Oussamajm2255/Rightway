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
  const { user } = useAuth();
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

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tableau de bord</h1>
            <p className="page-subtitle">Bienvenue, {user?.full_name}</p>
          </div>
        </div>
        <div className="stats-grid">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Bienvenue, {user?.full_name}</p>
        </div>
      </div>

      {user.role === 'SUPER_ADMIN' && <SuperAdminDashboard data={data} navigate={navigate} />}
      {user.role === 'ADMIN' && <AdminDashboard data={data} navigate={navigate} />}
      {user.role === 'COMMERCIAL' && <CommercialDashboard data={data} navigate={navigate} />}
    </div>
  );
}

/* ===== KPI Card ===== */
function KpiCard({ label, value, color, onClick }) {
  return (
    <div
      className={`kpi-card ${onClick ? 'kpi-clickable' : ''}`}
      onClick={onClick}
      style={color ? { '--kpi-accent': color } : {}}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

/* ===== Section Header ===== */
function SectionHeader({ title }) {
  return <h2 className="section-header">{title}</h2>;
}

/* ===== SUPER ADMIN ===== */
function SuperAdminDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <>
      <div className="stats-grid">
        <KpiCard label="Utilisateurs actifs" value={data.users_count} onClick={() => navigate('/users')} />
        <KpiCard label="Produits" value={data.products_count} onClick={() => navigate('/products')} />
        <KpiCard label="Livraisons actives" value={data.active_livraisons} color="var(--color-warning)" onClick={() => navigate('/livraisons')} />
        <KpiCard label="CA Total" value={formatDT(data.ca_total)} color="var(--color-primary)" />
      </div>

      {data.stock_alerts && data.stock_alerts.length > 0 && (
        <div className="detail-section">
          <SectionHeader title="Alerte Stock" />
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Produit</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.stock_alerts.map((a) => (
                  <tr key={a.id} className="row-alert">
                    <td className="td-code">{a.id}</td>
                    <td>{a.name}</td>
                    <td className="td-qty qty-low">{a.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/users')}>Gérer les utilisateurs</button>
        <button className="btn btn-secondary" onClick={() => navigate('/products')}>Gérer les produits</button>
        <button className="btn btn-secondary" onClick={() => navigate('/stock')}>Voir le stock</button>
      </div>
    </>
  );
}

/* ===== ADMIN ===== */
function AdminDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <>
      <div className="stats-grid">
        <KpiCard label="Produits en stock" value={data.stock_products} onClick={() => navigate('/stock')} />
        <KpiCard label="Unités totales" value={data.stock_total_qty} />
        <KpiCard label="Livraisons actives" value={data.active_livraisons} color="var(--color-warning)" onClick={() => navigate('/livraisons')} />
        <KpiCard label="En attente" value={data.pending_livraisons} color="#E65100" onClick={() => navigate('/livraisons')} />
      </div>

      {data.stock_alerts && data.stock_alerts.length > 0 && (
        <div className="detail-section">
          <SectionHeader title="Alerte Stock" />
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Produit</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {data.stock_alerts.map((a) => (
                  <tr key={a.id} className="row-alert">
                    <td className="td-code">{a.id}</td>
                    <td>{a.name}</td>
                    <td className="td-qty qty-low">{a.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/livraisons/nouvelle')}>
            + Nouvelle livraison
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/stock')}>Gérer le stock</button>
        </div>
      </div>
    </>
  );
}

/* ===== COMMERCIAL ===== */
function CommercialDashboard({ data, navigate }) {
  if (!data) return null;
  return (
    <>
      {/* Pending Bon de Sortie alerts */}
      {data.pending_bons && data.pending_bons.length > 0 && (
        <div className="detail-section">
          <SectionHeader title="Bons de sortie en attente" />
          {data.pending_bons.map((bon) => (
            <div key={bon.id} className="alert-card" onClick={() => navigate(`/livraisons/${bon.id}`)} style={{ cursor: 'pointer' }}>
              <div className="alert-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
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
          <SectionHeader title="Livraison en cours" />
          <div className="active-livraison-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/livraisons/${data.active_livraison.id}`)}>
            <div className="active-livraison-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 17h16M6 17V6l4-4h8v15" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7" cy="20" r="2" />
                <circle cx="17" cy="20" r="2" />
              </svg>
            </div>
            <div className="alert-body">
              <strong>{data.active_livraison.reference}</strong>
              <p>En cours depuis le {new Date(data.active_livraison.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/ventes/${data.active_livraison.id}`); }}>
                Ventes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="stats-grid" style={{ marginTop: '0' }}>
        <KpiCard label="CA Total" value={formatDT(data.ca_total)} color="var(--color-primary)" />
        <KpiCard label="Commission (10%)" value={formatDT(data.commission)} color="#0D7B4B" />
      </div>

      {/* Recent history */}
      {data.recent_livraisons && data.recent_livraisons.length > 0 && (
        <div className="detail-section">
          <SectionHeader title="Historique récent" />
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
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
    </>
  );
}

function StatusBadge({ status }) {
  const labels = { EN_ATTENTE_COMMERCIAL: 'En attente', EN_COURS: 'En cours', EN_RETOUR: 'En retour', EN_ATTENTE_ANNULATION: 'Annulation demandée', ANNULE: 'Annulé', CLOTURE: 'Clôturé' };
  const cls = { EN_ATTENTE_COMMERCIAL: 'badge-status-pending', EN_COURS: 'badge-status-active', EN_RETOUR: 'badge-status-warning', EN_ATTENTE_ANNULATION: 'badge-status-warning', ANNULE: 'badge-status-closed', CLOTURE: 'badge-status-closed' }[status] || '';
  return <span className={`badge ${cls}`}>{labels[status] || status}</span>;
}

export default DashboardPage;
