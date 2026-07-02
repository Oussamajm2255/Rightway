import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { Chart } from 'chart.js/auto';
import './RealtimeMonitorPage.css';

/* ─── Category Color Palette (12 colors, cycle through) ─── */
const CATEGORY_COLORS = [
  '#2a78d6', '#0f9e6a', '#c98500', '#7c3aed',
  '#dc2626', '#db2777', '#d95926', '#16a34a',
  '#0891b2', '#9333ea', '#e11d48', '#65a30d',
];

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function formatInt(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('fr-TN');
}

function getStatusPill(pct) {
  if (pct >= 100) return { bg: 'rgba(13,123,75,0.12)', color: '#0a7a52', label: 'Épuisé' };
  if (pct >= 80)  return { bg: 'rgba(13,123,75,0.10)', color: '#0a7a52', label: 'Très bon' };
  if (pct >= 50)  return { bg: 'rgba(201,133,0,0.10)',  color: '#946000', label: 'En cours' };
  if (pct >= 20)  return { bg: 'rgba(207,17,36,0.10)',  color: '#b91c1c', label: 'Lent' };
  return { bg: 'rgba(94,111,125,0.08)', color: '#52566a', label: 'Départ' };
}

export default function RealtimeMonitorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState('');
  const [tickFlash, setTickFlash] = useState(false);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const clockInterval = useRef(null);
  const pollInterval = useRef(null);

  /* ─── Fetch realtime data ─── */
  const fetchData = useCallback(async () => {
    try {
      const result = await apiGet(`/livraisons/${id}/realtime`);
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ─── Clock ─── */
  const updateClock = useCallback(() => {
    const now = new Date();
    setClock(
      now.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      '  ' +
      now.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }, []);

  /* ─── Initialize ─── */
  useEffect(() => {
    fetchData();
    updateClock();

    // Poll every 4 seconds
    pollInterval.current = setInterval(() => {
      fetchData();
      setTickFlash(true);
      setTimeout(() => setTickFlash(false), 350);
    }, 4000);

    clockInterval.current = setInterval(updateClock, 1000);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (clockInterval.current) clearInterval(clockInterval.current);
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [fetchData, updateClock]);

  /* ─── Chart.js ─── */
  useEffect(() => {
    if (!data?.categories || data.categories.length === 0) return;

    const categories = data.categories;
    const barCount = categories.length;
    const isMobile = window.innerWidth <= 640;

    // Shorten labels on small screens so every bar fits
    const MAX_LABEL = isMobile ? 16 : 24;
    const labels = categories.map((c) =>
      c.name.length > MAX_LABEL ? c.name.slice(0, MAX_LABEL) + '\u2026' : c.name
    );

    // Dynamic height: each bar needs ~30px; enforce min so labels don't collide
    const chartH = isMobile
      ? Math.max(barCount * 28, 150)
      : Math.max(barCount * 32, 200);

    // Push height onto the wrapper
    const wrap = chartRef.current?.parentElement;
    if (wrap) wrap.style.height = chartH + 'px';

    const colors = categories.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
    const soldData = categories.map((c) => c.sell_through_pct);
    const remData = categories.map((c) => 100 - c.sell_through_pct);

    if (chartInstance.current) {
      // Update existing chart
      chartInstance.current.data.labels = labels;
      chartInstance.current.data.datasets[0].data = soldData;
      chartInstance.current.data.datasets[0].backgroundColor = colors;
      chartInstance.current.data.datasets[1].data = remData;
      chartInstance.current.options.scales.y.ticks.font.size = isMobile ? 10 : 11;
      chartInstance.current.data.datasets[0].barThickness = isMobile ? 14 : 18;
      chartInstance.current.data.datasets[1].barThickness = isMobile ? 14 : 18;
      chartInstance.current.update();
      return;
    }

    // Create new chart
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Vendu %',
            data: soldData,
            backgroundColor: colors,
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            barThickness: isMobile ? 14 : 18,
          },
          {
            label: 'Restant %',
            data: remData,
            backgroundColor: 'rgba(0,0,0,0.06)',
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
            barThickness: isMobile ? 14 : 18,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            titleColor: '#52566a',
            bodyColor: '#111318',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) =>
                ctx.datasetIndex === 0
                  ? ` Vendus: ${ctx.raw}%  (${categories[ctx.dataIndex].sold} / ${categories[ctx.dataIndex].stock} u.)`
                  : ` Restants: ${ctx.raw}%`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            max: 100,
            grid: { color: 'rgba(0,0,0,0.05)' },
            border: { color: 'rgba(0,0,0,0.08)' },
            ticks: {
              color: '#9ea3b5',
              font: { family: "'JetBrains Mono', 'SF Mono', monospace", size: 11 },
              callback: (v) => v + '%',
            },
          },
          y: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              autoSkip: false,
              color: '#52566a',
              font: { family: "'Inter', sans-serif", size: isMobile ? 10 : 11 },
            },
          },
        },
      },
    });
  }, [data]);

  /* ─── Force refresh handler ─── */
  function handleRefresh() {
    fetchData();
    setTickFlash(true);
    setTimeout(() => setTickFlash(false), 350);
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="realtime-shell">
        <div className="realtime-loading">Chargement du dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="realtime-shell">
        <div className="realtime-topbar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/livraisons/${id}`)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M9 2.5L4.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour
          </button>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="realtime-shell">
        <div className="realtime-empty">Aucune donnée disponible pour cette livraison.</div>
      </div>
    );
  }

  const { livraison, overall, categories } = data;

  return (
    <div className="realtime-shell">
      {/* ── TOP BAR ── */}
      <div className="realtime-topbar">
        <div className="realtime-brand">
          <span className="live-badge">
            <span className="live-dot" />
            Live
          </span>
          <div>
            <div className="realtime-title">Real-time Distribution</div>
            <div className="realtime-subtitle">
              Livraison #{livraison.reference} · {categories.length} famille{categories.length !== 1 ? 's' : ''} produit
            </div>
          </div>
        </div>
        <div className="realtime-topbar-right">
          <div className={`realtime-clock ${tickFlash ? 'realtime-ticking' : ''}`}>
            {clock}
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleRefresh}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
            </svg>
            Refresh
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/livraisons/${id}`)}
            style={{ marginLeft: 'var(--space-1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M9 2.5L4.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour
          </button>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="realtime-kpi-grid">
        <div className="kpi-card" style={{ '--kpi-accent': '#2a78d6' }}>
          <div className="kpi-label">Stock livraison</div>
          <div className="kpi-val">{formatInt(overall.total_stock)}</div>
          <div className="kpi-sub">unités expédiées</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-accent': '#0f9e6a' }}>
          <div className="kpi-label">Unités vendues</div>
          <div className="kpi-val" style={{ color: '#0f9e6a' }}>{formatInt(overall.total_sold)}</div>
          <div className="kpi-sub">ventes confirmées</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-accent': '#8b5cf6' }}>
          <div className="kpi-label">Restantes</div>
          <div className="kpi-val">{formatInt(overall.total_remaining)}</div>
          <div className="kpi-sub">en circulation</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-accent': '#eda100' }}>
          <div className="kpi-label">CA Total TTC</div>
          <div className="kpi-val" style={{ color: '#c98500' }}>{formatDT(overall.total_ca)}</div>
          <div className="kpi-sub">Dinars tunisiens</div>
        </div>
        <div className="kpi-card" style={{ '--kpi-accent': '#dc2626' }}>
          <div className="kpi-label">Taux d'écoulement</div>
          <div className="kpi-val" style={{ color: '#dc2626' }}>{overall.sell_through_pct}%</div>
          <div className="kpi-sub">de la livraison totale</div>
        </div>
      </div>

      {/* ── CATEGORY GRID ── */}
      <div className="realtime-cat-grid">
        {categories.map((cat, i) => {
          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          const pct = cat.sell_through_pct;
          const pill = getStatusPill(pct);
          return (
            <div className="cat-card" key={cat.name}>
              <div className="cat-header">
                <div className="cat-left">
                  <div className="cat-dot" style={{ background: color }} />
                  <div>
                    <div className="cat-name">{cat.name}</div>
                    <div className="cat-code">{cat.product_count} produit{cat.product_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <span className="status-pill" style={{ background: pill.bg, color: pill.color }}>
                  {pill.label} {pct}%
                </span>
              </div>
              <div className="cat-bar-outer">
                <div className="cat-bar-inner" style={{ width: pct + '%', background: color }} />
              </div>
              <div className="cat-stats">
                <div className="cat-stat">
                  <span className="cat-stat-val" style={{ color }}>{cat.sold}</span>
                  <span className="cat-stat-lbl">Vendus</span>
                </div>
                <div className="cat-stat">
                  <span className="cat-stat-val">{cat.remaining}</span>
                  <span className="cat-stat-lbl">Restants</span>
                </div>
                <div className="cat-stat">
                  <span className="cat-stat-val">{cat.stock}</span>
                  <span className="cat-stat-lbl">Livraison</span>
                </div>
                <div className="cat-stat">
                  <span className="cat-stat-val" style={{ fontSize: '11px', letterSpacing: '-0.01em' }}>
                    {formatDT(cat.ca)}
                  </span>
                  <span className="cat-stat-lbl">CA</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BAR CHART ── */}
      {categories.length > 0 && (
        <div className="realtime-chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title">Taux d'écoulement par catégorie (live)</div>
            <div className="chart-legend">
              <span className="chart-legend-item">
                <span className="chart-legend-sq" style={{ background: 'rgba(0,0,0,0.25)' }} />
                Vendu
              </span>
              <span className="chart-legend-item">
                <span className="chart-legend-sq" style={{ background: 'rgba(0,0,0,0.07)' }} />
                Restant
              </span>
            </div>
          </div>
          <div className="chart-wrap">
            <canvas ref={chartRef} role="img" aria-label="Barres horizontales empilées du taux d'écoulement par catégorie" />
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="realtime-footer">
        <div className="realtime-footer-note">
          ⟳ Mise à jour automatique toutes les 4 secondes · Snapshot livraison
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate(`/livraisons/${id}`)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Voir détails
        </button>
      </div>
    </div>
  );
}
