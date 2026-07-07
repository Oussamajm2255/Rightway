import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, openPdf } from '../lib/api';
import { formatDate as fmtDate, formatDateTime } from '../lib/utils';
import { useCategoryPalette } from '../context/CategoryPaletteContext';
import './HistoriquePage.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function formatDate(d) {
  if (!d) return '—';
  return fmtDate(d);
}

const STATUS_LABELS = { EN_ATTENTE_COMMERCIAL: 'En attente', EN_COURS: 'En cours', EN_RETOUR: 'En retour', EN_ATTENTE_ANNULATION: 'Annulation demandée', ANNULE: 'Annulé', CLOTURE: 'Clôturé' };
const STATUS_CLASS = { EN_ATTENTE_COMMERCIAL: 'badge-status-pending', EN_COURS: 'badge-status-active', EN_RETOUR: 'badge-status-warning', EN_ATTENTE_ANNULATION: 'badge-status-warning', ANNULE: 'badge-status-closed', CLOTURE: 'badge-status-closed' };

function HistoriquePage() {
  const { user } = useAuth();
  const { getColor } = useCategoryPalette();
  const [livraisons, setLivraisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo + 'T23:59:59');
      const data = await apiGet(`/livraisons?${params.toString()}`);
      setLivraisons(data.livraisons);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function openDossier(id) {
    setDossierLoading(true);
    setSelectedDossier(null);
    try {
      const data = await apiGet(`/livraisons/${id}/dossier`);
      setSelectedDossier(data.dossier);
    } catch (err) {
      setError(err.message);
    } finally {
      setDossierLoading(false);
    }
  }

  function handlePrintDossier(id) {
    openPdf(`/livraisons/${id}/dossier/pdf`, id);
  }

  return (
    <div className="historique-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historique</h1>
          <p className="page-subtitle">Consultez les livraisons passées</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="Du" />
        <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Au" />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* List */}
      {loading ? <div className="loading-state">Chargement...</div> :
       livraisons.length === 0 ? <div className="empty-state"><p>Aucune livraison trouvée.</p></div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Référence</th><th>Commercial</th><th>Véhicule</th><th>Statut</th><th>Date</th><th>Clôturé</th></tr></thead>
            <tbody>
              {livraisons.map((l) => (
                <tr key={l.id} className="clickable-row" onClick={() => openDossier(l.id)}>
                  <td className="td-code">{l.reference}</td>
                  <td>{l.commercial_name}</td>
                  <td>{l.vehicle_name}{l.vehicle_plate ? ` — ${l.vehicle_plate}` : ''}</td>
                  <td><span className={`badge ${STATUS_CLASS[l.status] || ''}`}>{STATUS_LABELS[l.status] || l.status}</span></td>
                  <td className="td-date">{formatDate(l.created_at)}</td>
                  <td className="td-date">{formatDate(l.closed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dossier Detail Panel */}
      {dossierLoading && <div className="loading-state" style={{ marginTop: '1.5rem' }}>Chargement du dossier...</div>}

      {selectedDossier && (
        <div className="dossier-panel">
          <div className="dossier-header">
            <h2>{selectedDossier.livraison.reference}</h2>
            <div className="dossier-actions">
              {selectedDossier.meta.is_locked && <span className="badge badge-ok">Verrouillé</span>}
              <button className="btn btn-sm btn-outline" onClick={() => handlePrintDossier(selectedDossier.livraison.id)}>
                Imprimer le dossier complet
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedDossier(null)}>Fermer</button>
            </div>
          </div>

          {/* Meta */}
          <div className="dossier-grid">
            <div className="detail-card"><h3>Commercial</h3><p className="detail-value">{selectedDossier.livraison.commercial_name}</p><p className="detail-sub">{selectedDossier.livraison.vehicle_name} — {selectedDossier.livraison.vehicle_plate}</p></div>
            <div className="detail-card"><h3>Admin</h3><p className="detail-value">{selectedDossier.livraison.admin_name}</p></div>
            <div className="detail-card"><h3>Dates</h3><p className="detail-sub">Sortie: {formatDate(selectedDossier.livraison.created_at)}</p><p className="detail-sub">Retour: {formatDate(selectedDossier.livraison.closed_at || selectedDossier.livraison.end_declared_at)}</p></div>
            {selectedDossier.meta.duration != null && <div className="detail-card"><h3>Durée</h3><p className="detail-value">{selectedDossier.meta.duration}h</p></div>}
          </div>

          {/* Bon de Sortie */}
          <div className="detail-section"><h2>Bon de Sortie</h2>
            <div className="table-container"><table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Code</th><th>Produit</th><th>Qté Chargée</th><th>PU TTC</th><th>Total</th></tr></thead>
              <tbody>
                {Object.entries(
                  selectedDossier.livraison.items.reduce((acc, item) => {
                    const cat = item.category || 'Sans catégorie';
                    (acc[cat] = acc[cat] || []).push(item);
                    return acc;
                  }, {})
                ).map(([cat, catItems]) => {
                  const catCol = getColor(cat);
                  return (
                  <Fragment key={cat}>
                    {catItems.map((item) => (
                    <tr key={item.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                      <td className="td-code">{item.product_id}</td>
                      <td>{item.product_name}</td>
                      <td>{item.qte_chargee}</td>
                      <td>{formatDT(item.prix_ttc)}</td>
                      <td className="td-price">{formatDT(item.qte_chargee * Number(item.prix_ttc))}</td>
                    </tr>
                    ))}
                    <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                      <td colSpan="2" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>Sous-total {cat}</td>
                      <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_chargee, 0)}</td>
                      <td></td>
                      <td className="td-price">{formatDT(catItems.reduce((s,i) => s + i.qte_chargee * Number(i.prix_ttc), 0))}</td>
                    </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table></div>
            {selectedDossier.livraison.confirmed_by_commercial_at && (
              <div className="confirmation-row"><span className="badge badge-ok">Confirmé le {formatDate(selectedDossier.livraison.confirmed_by_commercial_at)}</span></div>
            )}
          </div>

          {/* Sales Log */}
          {selectedDossier.sales_log && selectedDossier.sales_log.length > 0 && (
            <div className="detail-section"><h2>Journal des ventes</h2>
              <div className="table-container"><table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead><tr><th>Date/Heure</th><th>Produit</th><th>Delta</th></tr></thead>
                <tbody>
                  {selectedDossier.sales_log.map((log) => (
                    <tr key={log.id}><td className="td-date">{formatDate(log.logged_at)}</td><td>{log.product_name}</td><td className={log.delta > 0 ? 'td-qty' : ''}>{log.delta > 0 ? '+' : ''}{log.delta}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {/* Bon de Retour */}
          <div className="detail-section"><h2>Bon de Retour</h2>
            <div className="table-container"><table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Code</th><th>Article</th><th>Qté Sortie</th><th>Qté Vendue</th><th>Qté Retour</th><th>Montant Vendu</th></tr></thead>
              <tbody>
                {Object.entries(
                  selectedDossier.livraison.items.reduce((acc, item) => {
                    const cat = item.category || 'Sans catégorie';
                    (acc[cat] = acc[cat] || []).push(item);
                    return acc;
                  }, {})
                ).map(([cat, catItems]) => {
                  const catCol = getColor(cat);
                  return (
                  <Fragment key={cat}>
                    {catItems.map((item) => {
                      const retour = item.qte_chargee - item.qte_vendue;
                      return <tr key={item.id} style={{ background: catCol.bg, borderLeftColor: catCol.bar }}>
                        <td className="td-code">{item.product_id}</td>
                        <td>{item.product_name}</td>
                        <td>{item.qte_chargee}</td>
                        <td>{item.qte_vendue}</td>
                        <td className={retour > 0 ? 'td-qty' : ''}>{retour}</td>
                        <td className="td-price">{formatDT(item.qte_vendue * Number(item.prix_ttc))}</td>
                      </tr>;
                    })}
                    <tr className="cat-subtotal" style={{ background: catCol.bg, borderLeftColor: catCol.bar, borderTopColor: catCol.bar }}>
                      <td colSpan="2" style={{ color: catCol.text, textAlign: 'center', fontWeight: 700 }}>Sous-total {cat}</td>
                      <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_chargee, 0)}</td>
                      <td className="td-qty">{catItems.reduce((s,i) => s + i.qte_vendue, 0)}</td>
                      <td className="td-qty">{catItems.reduce((s,i) => s + (i.qte_chargee - i.qte_vendue), 0)}</td>
                      <td className="td-price">{formatDT(catItems.reduce((s,i) => s + i.qte_vendue * Number(i.prix_ttc), 0))}</td>
                    </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table></div>
            {/* Financials */}
            {(() => {
              const isSalaire = selectedDossier.livraison.commercial_remuneration_type === 'SALAIRE';
              const isCommercial = user?.role === 'COMMERCIAL';
              return (
                <div className="financials">
                  <div><span>CA Total:</span> <strong>{formatDT(selectedDossier.financials.ca_total)}</strong></div>
                  {isSalaire ? (
                    !isCommercial && <div><span>Rémunération:</span> <em>Salaire mensuel</em></div>
                  ) : (
                    !isCommercial && <div><span>Commission (10%):</span> {formatDT(selectedDossier.financials.commission)}</div>
                  )}
                  {!isCommercial && <div><span>Net à reverser:</span> <strong>{formatDT(selectedDossier.financials.net_a_reverser)}</strong></div>}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoriquePage;
