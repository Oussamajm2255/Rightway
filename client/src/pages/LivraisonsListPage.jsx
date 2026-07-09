import { useState, useEffect, useCallback, useMemo } from 'react';
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

// Single source of truth for both the status badge color and the row/card
// left-edge accent bar, so the two always agree visually.
const STATUS_ACCENT = {
  EN_ATTENTE_COMMERCIAL: 'pending',
  CONFIRME: 'info',
  EN_COURS: 'active',
  EN_RETOUR: 'warning',
  EN_ATTENTE_ANNULATION: 'warning',
  ANNULE: 'closed',
  CLOTURE: 'closed',
};

const AVATAR_PALETTE = ['#0A0A0B', '#57575E', '#26262B', '#3D3D42', '#57575E', '#9A9AA2', '#E10600'];

function getAvatar(name) {
  const str = (name || '?').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  const bg = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  const words = str.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : (words[0]?.[0] || '?').toUpperCase();
  return { bg, initials };
}

function getStatusBadge(status) {
  const accent = STATUS_ACCENT[status] || '';
  return <span className={`badge badge-status-${accent}`}>{STATUS_LABELS[status] || status}</span>;
}

function IconSearch({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconEmptyBox() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6l8-4 8 4-8 4-8-4z" />
      <path d="M2 6v8l8 4M18 6v8l-8 4" />
      <path d="M10 10v8" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function renderAvanceChip(l) {
  if (!l.has_avance) return <span className="livr-muted-dash">—</span>;
  return (
    <span className="livr-avance-chip" title={`${Number(l.total_avances).toFixed(3)} DT`}>
      <IconCheck /> {Number(l.total_avances).toFixed(3)} DT
    </span>
  );
}

function renderEcartChip(l) {
  if (l.has_pending_ecart) {
    return (
      <span className="ecart-badge ecart-badge-pending" title="Écart en attente de confirmation">
        <IconAlertCircle /> En attente
      </span>
    );
  }
  if (l.has_ecart) {
    return (
      <span className="ecart-badge ecart-badge-resolved" title="Écart résolu">
        <IconCheck /> Résolu
      </span>
    );
  }
  return <span className="livr-muted-dash">—</span>;
}

function LivraisonsListPage() {
  const [livraisons, setLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('ALL');
  const navigate = useNavigate();

  const fetchLivraisons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetched once, unfiltered — status + search filtering happens entirely
      // client-side so the chip counts below always reflect the whole list
      // regardless of which chip/search is active, and filtering is instant.
      // Still bound by the server's default limit (models/livraison.js
      // findAll, limit=100) — if that default is ever raised/paginated,
      // these counts are only as complete as it allows.
      const data = await apiGet('/livraisons');
      setLivraisons(data.livraisons);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLivraisons(); }, [fetchLivraisons]);

  const counts = useMemo(() => {
    const c = { ALL: livraisons.length };
    for (const l of livraisons) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [livraisons]);

  const filtered = useMemo(() => {
    let list = livraisons;
    if (activeChip !== 'ALL') list = list.filter((l) => l.status === activeChip);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        l.reference?.toLowerCase().includes(q) ||
        l.commercial_name?.toLowerCase().includes(q) ||
        l.vehicle_name?.toLowerCase().includes(q) ||
        l.vehicle_plate?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [livraisons, activeChip, search]);

  function renderRow(l) {
    const accent = STATUS_ACCENT[l.status] || 'closed';
    const avatar = getAvatar(l.commercial_name);
    return (
      <tr
        key={l.id}
        className={`clickable-row livr-row-accent-${accent}${l.has_pending_ecart ? ' row-ecart-pending' : ''}`}
        onClick={() => navigate(`/livraisons/${l.id}`)}
      >
        <td className="td-code">{l.reference}</td>
        <td>
          <div className="livr-commercial-cell">
            <span className="livr-avatar" style={{ background: avatar.bg }}>{avatar.initials}</span>
            <span>{l.commercial_name}</span>
          </div>
        </td>
        <td>
          {l.vehicle_name}
          {l.vehicle_plate && <span className="vehicle-plate">{l.vehicle_plate}</span>}
        </td>
        <td>{getStatusBadge(l.status)}</td>
        <td style={{ textAlign: 'center' }}>{renderAvanceChip(l)}</td>
        <td style={{ textAlign: 'center' }}>{renderEcartChip(l)}</td>
        <td>{l.admin_name}</td>
        <td className="td-date">{formatDateTime(l.created_at)}</td>
        <td className="td-date">{l.closed_at ? formatDateTime(l.closed_at) : '—'}</td>
      </tr>
    );
  }

  // Mobile equivalent of renderRow — every column preserved as card content.
  function renderCard(l) {
    const accent = STATUS_ACCENT[l.status] || 'closed';
    const avatar = getAvatar(l.commercial_name);
    return (
      <article
        key={l.id}
        className={`livr-card livr-row-accent-${accent}${l.has_pending_ecart ? ' row-ecart-pending' : ''}`}
        onClick={() => navigate(`/livraisons/${l.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/livraisons/${l.id}`); }}
      >
        <div className="livr-card-top">
          <span className="livr-card-ref">{l.reference}</span>
          {getStatusBadge(l.status)}
        </div>

        <div className="livr-card-commercial">
          <span className="livr-avatar" style={{ background: avatar.bg }}>{avatar.initials}</span>
          <div className="livr-card-idn">
            <span className="livr-card-name">{l.commercial_name}</span>
            <span className="livr-card-vehicle">
              {l.vehicle_name}
              {l.vehicle_plate && <span className="vehicle-plate">{l.vehicle_plate}</span>}
            </span>
          </div>
        </div>

        <div className="livr-card-chips">
          <div className="livr-card-chip-cell">
            <span className="livr-card-k">Avance</span>
            {renderAvanceChip(l)}
          </div>
          <div className="livr-card-chip-cell">
            <span className="livr-card-k">Écart</span>
            {renderEcartChip(l)}
          </div>
        </div>

        <div className="livr-card-meta">
          <div><span>Créé par</span><b>{l.admin_name || '—'}</b></div>
          <div><span>Date</span><b>{formatDateTime(l.created_at)}</b></div>
          <div><span>Clôturé</span><b>{l.closed_at ? formatDateTime(l.closed_at) : '—'}</b></div>
        </div>
      </article>
    );
  }

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

      <div className="livr-toolbar">
        <div className="livr-search-wrap">
          <IconSearch />
          <input
            className="livr-search-input"
            type="text"
            placeholder="Rechercher par référence, commercial, véhicule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="livr-chip-row">
          <button
            type="button"
            className={`livr-chip ${activeChip === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveChip('ALL')}
          >
            Tous <span className="livr-chip-count">{counts.ALL || 0}</span>
          </button>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`livr-chip ${activeChip === value ? 'active' : ''}`}
              onClick={() => setActiveChip(value)}
            >
              {label} <span className="livr-chip-count">{counts[value] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="table-container">
          <table className="data-table">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td><span className="skeleton skeleton-text" style={{ width: '70px' }} /></td>
                  <td>
                    <div className="livr-commercial-cell">
                      <span className="skeleton skeleton-avatar" style={{ width: '26px', height: '26px' }} />
                      <span className="skeleton skeleton-text" style={{ width: '110px' }} />
                    </div>
                  </td>
                  <td><span className="skeleton skeleton-text" style={{ width: '90px' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '60px' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '40px', margin: '0 auto' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '40px', margin: '0 auto' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '80px' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '100px' }} /></td>
                  <td><span className="skeleton skeleton-text" style={{ width: '100px' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {livraisons.length === 0 ? (
            <>
              <IconEmptyBox />
              <p>Aucune livraison trouvée.</p>
            </>
          ) : (
            <>
              <IconSearch size={40} />
              <p>Aucun résultat pour ces filtres.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: full table */}
          <div className="table-container livr-fade-in livr-table-view">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Commercial</th>
                  <th>Véhicule</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'center' }}>Avance</th>
                  <th style={{ textAlign: 'center' }}>Écart</th>
                  <th>Créé par</th>
                  <th>Date</th>
                  <th>Clôturé</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(renderRow)}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list (all content, no horizontal scroll) */}
          <div className="livr-cards-view livr-fade-in">
            {filtered.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
}

export default LivraisonsListPage;
