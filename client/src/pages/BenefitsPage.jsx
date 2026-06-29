import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import { catColors, CAT_PALETTE } from '../lib/categoryPalette';
import { Chart } from 'chart.js/auto';
import './BenefitsPage.css';



// ─── Formatters ───
function fmtDT(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
}
function fmtPct(v) { return Number(v).toFixed(1) + '%'; }
function fmtInt(v) { return v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR'); }

// ─── Icons (inline SVG) ───
const Icon = {
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  dollar: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  trending: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
  pie: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0110 10H12V2z"/></svg>,
  check: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>,
  shield: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  download: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v14M7 12l5 5 5-5M4 20h16"/></svg>,
  refresh: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── Margin class helper ───
function marginClass(pct) {
  if (pct === 0) return 'margin-zero';
  if (pct < 0) return 'margin-low';
  if (pct >= 35) return 'margin-high';
  if (pct >= 20) return 'margin-mid';
  return 'margin-low';
}

// ═══════════════════════════ MAIN PAGE ═══════════════════════════

export default function BenefitsPage() {
  const { user } = useAuth();
  const chartRef = useRef(null);

  // Data
  const [globalData, setGlobalData] = useState(null);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categories, setCategories] = useState([]);

  // Sort & Pagination
  const [sortCol, setSortCol] = useState('benefit');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // ─── Fetch data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      params.append('sort_by', sortCol);
      params.append('sort_dir', sortDir);
      params.append('page', page);
      params.append('limit', PAGE_SIZE);

      const data = await apiGet(`/benefits?${params.toString()}`);
      setGlobalData(data.global);
      setProducts(data.products);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, category, dateFrom, dateTo, sortCol, sortDir, page]);

  // ─── Fetch categories ───
  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet('/products/categories');
      setCategories(data.categories || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ─── Chart ───
  useEffect(() => {
    if (!products || products.length === 0) return;
    const ctx = document.getElementById('benefit-chart');
    if (!ctx) return;

    function drawChart() {
      if (chartRef.current) chartRef.current.destroy();

      // Responsive sizing: fewer bars + tighter spacing on small screens
      const w = window.innerWidth;
      const take = w <= 420 ? 10 : w <= 768 ? 12 : 15;
      const perBar = w <= 420 ? 24 : w <= 768 ? 28 : 36;
      const maxLabel = w <= 420 ? 18 : w <= 768 ? 22 : 28;
      const tickFont = w <= 420 ? 9 : w <= 768 ? 10 : 11;

      const top = [...products].sort((a, b) => b.benefit - a.benefit).slice(0, take);
      const labels = top.map((p) => p.name.length > maxLabel ? p.name.substring(0, maxLabel - 2) + '\u2026' : p.name);
      const values = top.map((p) => p.benefit);
      const colors = top.map((p) => {
        const { bar } = catColors(p.category);
        return bar + 'cc'; // 80% opacity hex
      });
      const borderColors = top.map((p) => catColors(p.category).bar);

      const chartH = Math.max(w <= 420 ? 200 : w <= 768 ? 260 : 320, top.length * perBar);
      ctx.parentElement.style.minHeight = chartH + 'px';

      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Bénéfice', data: values, backgroundColor: colors, borderColor: borderColors, borderWidth: 1.5, borderRadius: 4, borderSkipped: false }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label(ctx) { const p = top[ctx.dataIndex]; return ` ${fmtDT(ctx.parsed.x)}  \u00b7  marge ${fmtPct(p.margin_pct)}`; } },
              backgroundColor: '#fff',
              borderColor: 'var(--color-border)',
              borderWidth: 1,
              titleColor: '#111827',
              bodyColor: '#4b5675',
              padding: 10,
            },
          },
          scales: {
            x: { grid: { color: '#e1e5ef80' }, ticks: { callback: (v) => Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k DT' : v.toFixed(0) + ' DT', font: { size: 9 } } },
            y: { grid: { display: false }, ticks: { font: { size: tickFont }, color: '#4b5675' } },
          },
        },
      });
    }

    drawChart();
    let resizeTimer;
    function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 200); }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [products]);

  // ─── Handlers ───
  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col); setSortDir('desc');
    }
    setPage(1);
  }

  function handleFilterChange() {
    setPage(1);
  }

  function resetFilters() {
    setSearch(''); setCategory(''); setDateFrom(''); setDateTo('');
    setSortCol('benefit'); setSortDir('desc'); setPage(1);
  }

  function exportCSV() {
    const headers = ['Code', 'Produit', 'Catégorie', 'Prix Achat (DT)', 'Prix Vente (DT)', 'Qté Vendue', 'CA (DT)', 'Coût (DT)', 'Bénéfice (DT)', 'Marge (%)'];
    const rows = products.map((p) => [
      p.id, `"${p.name}"`, p.category || '',
      p.purchase_price.toFixed(3), p.selling_price_ttc.toFixed(3),
      p.total_sold, p.ca.toFixed(3), p.cost.toFixed(3),
      p.benefit.toFixed(3), p.margin_pct.toFixed(1),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'benefices-rightway.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Computed ───
  const totalCA = products.reduce((s, p) => s + p.ca, 0);
  const totalCost = products.reduce((s, p) => s + p.cost, 0);
  const totalBenefit = products.reduce((s, p) => s + p.benefit, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;

  const periodLabel = (() => {
    if (!dateFrom && !dateTo) return 'Toute période';
    const p = [];
    if (dateFrom) p.push('Du ' + new Date(dateFrom).toLocaleDateString('fr-FR'));
    if (dateTo) p.push('Au ' + new Date(dateTo).toLocaleDateString('fr-FR'));
    return p.join(' \u00b7 ');
  })();

  // ─── Render ───
  return (
    <div className="benefits-page">
      {/* ═══ TOPBAR ═══ */}
      <div className="benefits-topbar">
        <div className="topbar-left">
          <div className="page-icon-wrap">{Icon.chart}</div>
          <div className="topbar-title">
            <h1>Bénéfices &amp; Rentabilité</h1>
            <span>Analyse par produit · SUPER_ADMIN uniquement</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="super-admin-badge">{Icon.shield} Super Admin</span>
          <button className="btn btn-sm btn-export" onClick={exportCSV}>{Icon.download} Export CSV</button>
          <button className="btn btn-sm btn-primary" onClick={fetchData}>{Icon.refresh} Actualiser</button>
        </div>
      </div>

      <div className="benefits-content">
        {/* ═══ SECTION A: KPI GLOBALS ═══ */}
        <div>
          <div className="section-header">
            <h2>Bénéfice global</h2>
            <div className="section-header-line" />
            <span className="period-label">{periodLabel}</span>
          </div>

          {loading && !globalData ? (
            <div className="kpi-grid-5">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="kpi-card skeleton-card" />)}
            </div>
          ) : globalData ? (
            <div className="kpi-grid-5">
              {/* CA Global */}
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: 'var(--color-primary)' }} />
                <div className="kpi-icon-wrap" style={{ background: 'rgba(42,120,214,.1)', color: 'var(--color-primary)' }}>{Icon.dollar}</div>
                <div className="kpi-label">Chiffre d'Affaires Total</div>
                <div className="kpi-value" style={{ fontSize: 16 }}>{fmtDT(globalData.ca_total)}</div>
                <div className="kpi-sub">livraisons clôturées</div>
              </div>
              {/* Bénéfice Brut */}
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: globalData.benefit_gross >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }} />
                <div className="kpi-icon-wrap" style={{ background: globalData.benefit_gross >= 0 ? 'rgba(15,158,106,.1)' : 'rgba(220,38,38,.1)', color: globalData.benefit_gross >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {Icon.trending}
                </div>
                <div className="kpi-label">Bénéfice Brut</div>
                <div className={`kpi-value${globalData.benefit_gross >= 0 ? ' positive' : ' negative'}`} style={{ fontSize: 16 }}>{fmtDT(globalData.benefit_gross)}</div>
                <div className="kpi-sub">CA − Coût produits</div>
              </div>
              {/* Bénéfice Net */}
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: globalData.benefit_net >= 0 ? '#0891b2' : 'var(--color-danger)' }} />
                <div className="kpi-icon-wrap" style={{ background: globalData.benefit_net >= 0 ? 'rgba(8,145,178,.1)' : 'rgba(220,38,38,.1)', color: globalData.benefit_net >= 0 ? '#0891b2' : 'var(--color-danger)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div className="kpi-label">Bénéfice Net</div>
                <div className={`kpi-value${globalData.benefit_net >= 0 ? ' positive' : ' negative'}`} style={{ fontSize: 16 }}>{fmtDT(globalData.benefit_net)}</div>
                <div className="kpi-sub">{globalData.prelevement_total > 0 || globalData.ecart_total > 0 ? `après déductions (${fmtDT(-(globalData.prelevement_total + globalData.ecart_total))})` : 'après déductions'}</div>
              </div>
              {/* Marge Moyenne */}
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: globalData.margin_avg >= 30 ? 'var(--color-success)' : globalData.margin_avg >= 15 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                <div className="kpi-icon-wrap" style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed' }}>{Icon.pie}</div>
                <div className="kpi-label">Marge Bénéficiaire Moyenne</div>
                <div className="kpi-value" style={{ color: globalData.margin_avg >= 30 ? 'var(--color-success)' : globalData.margin_avg >= 15 ? 'var(--color-warning)' : 'var(--color-danger)', fontSize: 20 }}>{fmtPct(globalData.margin_avg)}</div>
                <div className="kpi-sub">(bénéfice brut / CA) × 100</div>
              </div>
              {/* Produits Rentables */}
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: 'var(--color-warning)' }} />
                <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,.1)', color: 'var(--color-warning)' }}>{Icon.check}</div>
                <div className="kpi-label">Produits Rentables</div>
                <div className="kpi-value">{globalData.profitable_count}</div>
                <div className="kpi-sub">bénéfice brut &gt; 0</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ═══ SECTION B: TABLEAU ═══ */}
        <div>
          <div className="section-header">
            <h2>Détail par produit</h2>
            <div className="section-header-line" />
          </div>

          {/* FILTERS */}
          <div className="filters-bar">
            <div className="filter-group">
              {Icon.search}
              <input type="text" className="filter-input filter-search" placeholder="Rechercher nom ou code…" value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Catégorie</label>
              <select className="filter-input" value={category} onChange={(e) => { setCategory(e.target.value); handleFilterChange(); }}>
                <option value="">Toutes</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-period">
              <label className="filter-label">Du</label>
              <input type="date" className="filter-input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }} />
              <span className="filter-sep">au</span>
              <input type="date" className="filter-input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }} />
            </div>
            <div className="filters-right">
              <button className="btn btn-sm btn-outline" onClick={resetFilters}>{Icon.x} Réinitialiser</button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-wrapper">
            <div className="results-bar">
              <span><strong>{loading ? '…' : total}</strong> produit(s) affiché(s)</span>
              <span className="sort-info">Trié par {sortCol} {sortDir === 'desc' ? '↓' : '↑'}</span>
            </div>

            {error && (
              <div className="error-banner">
                {Icon.x}
                <span>{error}</span>
                <button onClick={fetchData}>Réessayer</button>
              </div>
            )}

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      ['id', 'Code'], ['name', 'Produit'], ['category', 'Catégorie'],
                      ['purchase_price', 'Prix Achat'], ['selling_price_ttc', 'Prix Vente'],
                      ['total_sold', 'Qté Vendue'], ['ca', 'CA'], ['cost', 'Coût'],
                      ['benefit', 'Bénéfice'], ['margin_pct', 'Marge %'],
                    ].map(([col, label]) => (
                      <th key={col} className={`sortable${sortCol === col ? ' ' + sortDir : ''}`} style={['purchase_price', 'selling_price_ttc', 'total_sold', 'ca', 'cost', 'benefit'].includes(col) ? { textAlign: 'right' } : {}}
                        onClick={() => handleSort(col)}>
                        {label}<span className="sort-icon" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && products.length === 0 ? (
                    <tr><td colSpan={10}><div className="empty-state">Chargement…</div></td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan={10}><div className="empty-state">{Icon.search}<p>Aucun produit ne correspond aux critères de recherche.</p></div></td></tr>
                  ) : (
                    products.map((p) => {
                      const benefitClass = p.benefit > 0 ? 'val-positive' : p.benefit < 0 ? 'val-negative' : 'val-neutral';
                      const mClass = marginClass(p.margin_pct);
                      const marginFillW = Math.min(Math.abs(p.margin_pct), 100);
                      const cColors = catColors(p.category);
                      return (
                        <tr key={p.id} style={{ '--cat-bg': cColors.bg }}>
                          <td className="val-mono muted">{p.id}</td>
                          <td className="td-name" title={p.name}>{p.name}</td>
                          <td>{p.category ? <span className="cat-badge" style={{ background: cColors.bg, color: cColors.text }}>{p.category}</span> : <span className="cat-badge cat-default">—</span>}</td>
                          <td className="val-mono right">{fmtDT(p.purchase_price)}</td>
                          <td className="val-mono right">{fmtDT(p.selling_price_ttc)}</td>
                          <td className="val-mono right">{fmtInt(p.total_sold)}</td>
                          <td className="val-mono right">{p.ca > 0 ? fmtDT(p.ca) : <span className="muted">—</span>}</td>
                          <td className="val-mono right">{p.cost > 0 ? fmtDT(p.cost) : <span className="muted">—</span>}</td>
                          <td className={`right ${benefitClass}`}>{fmtDT(p.benefit)}</td>
                          <td>
                            <div className={`margin-cell ${mClass}`}>
                              <div className="margin-track"><div className="margin-fill" style={{ width: marginFillW + '%' }} /></div>
                              <span className="margin-pct">{fmtPct(p.margin_pct)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {products.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="total-label">TOTAL — {products.length} produit(s)</td>
                      <td className="val-mono right">{fmtDT(totalCA)}</td>
                      <td className="val-mono right">{fmtDT(totalCost)}</td>
                      <td className={`right ${totalBenefit >= 0 ? 'val-positive' : 'val-negative'}`}>{fmtDT(totalBenefit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* PAGINATION */}
            {showPagination && (
              <div className="pagination">
                <span className="pagination-info">Affichage <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> sur <strong>{total}</strong></span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1).map((n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) return <><span key={'ell' + n} className="page-ell">…</span><button key={n} className={'page-btn' + (n === page ? ' active' : '')} onClick={() => setPage(n)}>{n}</button></>;
                    return <button key={n} className={'page-btn' + (n === page ? ' active' : '')} onClick={() => setPage(n)}>{n}</button>;
                  })}
                  <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION C: CHART ═══ */}
        {products.length > 0 && (
          <div>
            <div className="section-header">
              <h2>Top 15 produits par bénéfice</h2>
              <div className="section-header-line" />
            </div>
            <div className="chart-card">
              <div className="chart-card-header">
                <h3>Classement des produits les plus rentables</h3>
                <span>Couleur par catégorie de produit</span>
              </div>
              <div className="chart-wrap">
                <canvas id="benefit-chart" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
