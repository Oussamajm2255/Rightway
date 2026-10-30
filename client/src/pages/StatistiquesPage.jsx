import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../lib/api';
import { formatDate } from '../lib/utils';
import { presetRange, DATE_PRESETS } from '../lib/datePresets';
import { useCategoryPalette } from '../context/CategoryPaletteContext';
import './BenefitsPage.css';

function fmtDT(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
}
function fmtInt(v) { return v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR'); }

const TABS = [
  { key: 'products', label: 'Par produit' },
  { key: 'commercials', label: 'Par commercial' },
  { key: 'product_commercial', label: 'Produit par commercial' },
];

const PRODUCT_COLUMNS = [
  ['id', 'Code'], ['name', 'Produit'], ['category', 'Catégorie'],
  ['selling_price_ttc', 'Prix Vente'], ['total_sold', 'Qté Vendue'], ['ca', 'CA'],
];
const RIGHT_ALIGNED = ['selling_price_ttc', 'total_sold', 'ca'];

const PAGE_SIZE = 50;

const IconChart = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;

export default function StatistiquesPage() {
  const { getColor } = useCategoryPalette();
  const latestRequest = useRef(0);

  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ total_sold: 0, ca: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [datePreset, setDatePreset] = useState('month');
  const [dateFrom, setDateFrom] = useState(() => presetRange('month').from);
  const [dateTo, setDateTo] = useState(() => presetRange('month').to);
  const [sortCol, setSortCol] = useState('ca');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (tab === 'product_commercial' && commercialId) params.append('commercial_id', commercialId);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      params.append('sort_by', sortCol);
      params.append('sort_dir', sortDir);
      params.append('page', page);
      params.append('limit', PAGE_SIZE);

      const data = await apiGet(`/benefits/sales-stats?${params.toString()}`);
      if (request !== latestRequest.current) return;
      setProducts(data.products);
      setCommercials(data.commercials);
      setTotal(data.total);
      setTotals(data.totals);
    } catch (err) {
      if (request === latestRequest.current) setError(err.message);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [tab, search, category, commercialId, dateFrom, dateTo, sortCol, sortDir, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    apiGet('/products/categories').then((data) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // The third tab always needs one commercial: start with the best seller
  useEffect(() => {
    if (tab === 'product_commercial' && !commercialId && commercials.length > 0) {
      setCommercialId(commercials[0].id);
    }
  }, [tab, commercialId, commercials]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col); setSortDir('desc');
    }
    setPage(1);
  }

  function changeTab(key) {
    setTab(key);
    setPage(1);
  }

  function applyPreset(key) {
    const r = presetRange(key);
    setDatePreset(key);
    setDateFrom(r.from);
    setDateTo(r.to);
    setPage(1);
  }

  function openCommercial(id) {
    setCommercialId(id);
    changeTab('product_commercial');
  }

  const selectedCommercial = commercials.find((c) => c.id === commercialId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const commercialTotals = commercials.reduce(
    (s, c) => ({ livraisons: s.livraisons + c.livraisons, total_sold: s.total_sold + c.total_sold, ca: s.ca + c.ca }),
    { livraisons: 0, total_sold: 0, ca: 0 }
  );

  const periodLabel = (() => {
    if (!dateFrom && !dateTo) return 'Toute période';
    const preset = DATE_PRESETS.find((pr) => pr.key === datePreset);
    if (preset) return preset.label;
    const p = [];
    if (dateFrom) p.push('Du ' + formatDate(dateFrom));
    if (dateTo) p.push('Au ' + formatDate(dateTo));
    return p.join(' · ');
  })();

  const productTotalLabel = `TOTAL${category ? ` · ${category}` : ''}${tab === 'product_commercial' && selectedCommercial ? ` · ${selectedCommercial.full_name}` : ''}`;

  function renderProducts() {
    return (
      <div className="table-wrapper">
        <div className="results-bar">
          <span><strong>{loading ? '…' : total}</strong> produit(s) affiché(s)</span>
        </div>

        <div className="table-scroll benefits-table-view">
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                {PRODUCT_COLUMNS.map(([col, label]) => (
                  <th key={col} className={`sortable${sortCol === col ? ' ' + sortDir : ''}`} style={RIGHT_ALIGNED.includes(col) ? { textAlign: 'right' } : {}}
                    onClick={() => handleSort(col)}>
                    {label}<span className="sort-icon" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">{loading ? 'Chargement…' : 'Aucun produit ne correspond aux critères de recherche.'}</div></td></tr>
              ) : products.map((p) => {
                const cColors = getColor(p.category);
                return (
                  <tr key={p.id} style={{ '--cat-bg': cColors.bg }}>
                    <td className="val-mono muted" data-label="Code">{p.id}</td>
                    <td className="td-name" title={p.name} data-label="Produit">{p.name}</td>
                    <td data-label="Catégorie">{p.category ? <span className="cat-badge" style={{ background: cColors.bg, color: cColors.text }}>{p.category}</span> : <span className="cat-badge cat-default">—</span>}</td>
                    <td className="val-mono right" data-label="Prix Vente">{fmtDT(p.selling_price_ttc)}</td>
                    <td className="val-mono right" data-label="Qté Vendue">{fmtInt(p.total_sold)}</td>
                    <td className="val-mono right" data-label="CA">{p.ca > 0 ? fmtDT(p.ca) : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            {products.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} className="total-label">{productTotalLabel} — {total} produit(s)</td>
                  <td className="val-mono right" data-label="Qté Vendue">{fmtInt(totals.total_sold)}</td>
                  <td className="val-mono right" data-label="CA">{fmtDT(totals.ca)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile: card list */}
        <div className="benefits-cards-view">
          {products.length === 0 ? (
            <div className="empty-state">{loading ? 'Chargement…' : 'Aucun produit ne correspond aux critères de recherche.'}</div>
          ) : (
            <>
              {products.map((p) => {
                const cColors = getColor(p.category);
                return (
                  <article key={p.id} className="ben-card" style={{ borderLeftColor: cColors.bar }}>
                    <div className="ben-card-top">
                      <div className="ben-card-identity">
                        <span className="ben-card-code">{p.id}</span>
                        <span className="ben-card-name">{p.name}</span>
                      </div>
                      {p.category && (
                        <span className="cat-badge" style={{ background: cColors.bg, color: cColors.text, flexShrink: 0 }}>{p.category}</span>
                      )}
                    </div>
                    <div className="ben-card-stats">
                      <div><span>Prix Vente</span><b>{fmtDT(p.selling_price_ttc)}</b></div>
                      <div><span>Qté Vendue</span><b>{fmtInt(p.total_sold)}</b></div>
                      <div><span>CA</span><b>{p.ca > 0 ? fmtDT(p.ca) : '—'}</b></div>
                    </div>
                  </article>
                );
              })}
              <article className="ben-card ben-total-card">
                <div className="ben-total-head">
                  <span>{productTotalLabel}</span>
                  <span className="ben-total-count">{total} produit(s)</span>
                </div>
                <div className="ben-card-stats">
                  <div><span>Qté Vendue</span><b>{fmtInt(totals.total_sold)}</b></div>
                  <div><span>CA</span><b>{fmtDT(totals.ca)}</b></div>
                </div>
              </article>
            </>
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="pagination">
            <span className="pagination-info">Affichage <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> sur <strong>{total}</strong></span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCommercials() {
    return (
      <div className="table-wrapper">
        <div className="results-bar">
          <span><strong>{loading ? '…' : commercials.length}</strong> commercial(aux)</span>
        </div>

        <div className="table-scroll benefits-table-view">
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Commercial</th>
                <th style={{ textAlign: 'right' }}>Livraisons clôturées</th>
                <th style={{ textAlign: 'right' }}>Qté Vendue</th>
                <th style={{ textAlign: 'right' }}>CA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {commercials.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state">{loading ? 'Chargement…' : 'Aucun commercial trouvé.'}</div></td></tr>
              ) : commercials.map((c) => (
                <tr key={c.id}>
                  <td className="td-name" data-label="Commercial">{c.full_name}</td>
                  <td className="val-mono right" data-label="Livraisons clôturées">{fmtInt(c.livraisons)}</td>
                  <td className="val-mono right" data-label="Qté Vendue">{fmtInt(c.total_sold)}</td>
                  <td className="val-mono right" data-label="CA">{c.ca > 0 ? fmtDT(c.ca) : <span className="muted">—</span>}</td>
                  <td className="right"><button className="btn btn-sm btn-outline" onClick={() => openCommercial(c.id)}>Voir les produits</button></td>
                </tr>
              ))}
            </tbody>
            {commercials.length > 0 && (
              <tfoot>
                <tr>
                  <td className="total-label">TOTAL</td>
                  <td className="val-mono right" data-label="Livraisons clôturées">{fmtInt(commercialTotals.livraisons)}</td>
                  <td className="val-mono right" data-label="Qté Vendue">{fmtInt(commercialTotals.total_sold)}</td>
                  <td className="val-mono right" data-label="CA">{fmtDT(commercialTotals.ca)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile: card list */}
        <div className="benefits-cards-view">
          {commercials.length === 0 ? (
            <div className="empty-state">{loading ? 'Chargement…' : 'Aucun commercial trouvé.'}</div>
          ) : (
            <>
              {commercials.map((c) => (
                <article key={c.id} className="ben-card">
                  <div className="ben-card-top">
                    <div className="ben-card-identity">
                      <span className="ben-card-name">{c.full_name}</span>
                    </div>
                  </div>
                  <div className="ben-card-stats">
                    <div><span>Livraisons</span><b>{fmtInt(c.livraisons)}</b></div>
                    <div><span>Qté Vendue</span><b>{fmtInt(c.total_sold)}</b></div>
                    <div><span>CA</span><b>{c.ca > 0 ? fmtDT(c.ca) : '—'}</b></div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => openCommercial(c.id)}>Voir les produits</button>
                </article>
              ))}
              <article className="ben-card ben-total-card">
                <div className="ben-total-head"><span>TOTAL</span></div>
                <div className="ben-card-stats">
                  <div><span>Livraisons</span><b>{fmtInt(commercialTotals.livraisons)}</b></div>
                  <div><span>Qté Vendue</span><b>{fmtInt(commercialTotals.total_sold)}</b></div>
                  <div><span>CA</span><b>{fmtDT(commercialTotals.ca)}</b></div>
                </div>
              </article>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="benefits-page">
      <div className="benefits-topbar">
        <div className="topbar-left">
          <div className="page-icon-wrap">{IconChart}</div>
          <div className="topbar-title">
            <h1>Statistiques</h1>
            <span>Ventes par produit et par commercial · livraisons clôturées</span>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm btn-primary" onClick={fetchData}>Actualiser</button>
        </div>
      </div>

      <div className="benefits-content">
        <div className="date-presets">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`preset-btn${tab === t.key ? ' active' : ''}`} onClick={() => changeTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="filters-bar">
          {tab !== 'commercials' && (
            <>
              <div className="filter-group">
                <input type="text" className="filter-input filter-search" placeholder="Rechercher nom ou code…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <div className="filter-group">
                <label className="filter-label">Catégorie</label>
                <select className="filter-input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                  <option value="">Toutes</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}
          {tab === 'product_commercial' && (
            <div className="filter-group">
              <label className="filter-label">Commercial</label>
              <select className="filter-input" value={commercialId} onChange={(e) => { setCommercialId(e.target.value); setPage(1); }}>
                {commercials.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="date-presets">
            {DATE_PRESETS.map((p) => (
              <button key={p.key} type="button" className={`preset-btn${datePreset === p.key ? ' active' : ''}`} onClick={() => applyPreset(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="filter-period">
            <label className="filter-label">Du</label>
            <input type="date" className="filter-input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset('custom'); setPage(1); }} />
            <span className="filter-sep">au</span>
            <input type="date" className="filter-input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset('custom'); setPage(1); }} />
          </div>
        </div>

        <div>
          <div className="section-header">
            <h2>{tab === 'commercials' ? 'CA par commercial' : tab === 'product_commercial' ? `Ventes de ${selectedCommercial?.full_name || '…'}` : 'CA par produit'}</h2>
            <div className="section-header-line" />
            <span className="period-label">{periodLabel}</span>
          </div>

          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={fetchData}>Réessayer</button>
            </div>
          )}

          {tab === 'commercials' ? renderCommercials() : renderProducts()}
        </div>
      </div>
    </div>
  );
}
