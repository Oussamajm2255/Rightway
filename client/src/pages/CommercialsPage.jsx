import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { Chart } from 'chart.js/auto';
import './CommercialsPage.css';

/* ─── Brand Palette ─── */
const PALETTE = [
  '#0F172A',  // ink
  '#E10600',  // red
  '#1E293B',  // ink-soft
];

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];

/* ─── Formatters ─── */
function fmtDT(v) {
  return parseFloat(v).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
}
function fmtDTShort(v) {
  const n = parseFloat(v);
  if (n >= 1000) return (n / 1000).toLocaleString('fr-TN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' k DT';
  return n.toLocaleString('fr-TN', { minimumFractionDigits: 3 }) + ' DT';
}
function fmtPct(v) {
  return parseFloat(v).toFixed(0) + ' %';
}
function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ─── Status helpers ─── */
function statusLabel(s) {
  const map = { EN_COURS: 'En tournée', EN_RETOUR: 'En retour', INACTIVE: 'Inactif', CLOTURE: 'Clôturée', ANNULE: 'Annulée' };
  return map[s] || s;
}
function statusBadgeClass(s) {
  const m = { EN_COURS: 'comm-badge-green', EN_RETOUR: 'comm-badge-orange', INACTIVE: 'comm-badge-gray', CLOTURE: 'comm-badge-blue', ANNULE: 'comm-badge-red' };
  return m[s] || 'comm-badge-gray';
}

/* ─── Simple SVG Icons ─── */
function SvgUsers() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M1 17c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M12 13c1.5 0 2.935.553 4 1.458V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgTruck() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M1 14h13M5 14V5l3-3h7v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 14v3h3M14 14v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="5" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function SvgCurrency() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 7.5c0-.828.895-1.5 2-1.5s2 .672 2 1.5c0 .828-.895 1.5-2 1.5s-2 .672-2 1.5c0 .828.895 1.5 2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 4v1M10 15v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgPercent() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="13" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="m13 7-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgChartPie() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 3a7 7 0 017 7h-7V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}
function SvgSearch() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgGrid() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function SvgList() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgEye() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function SvgChartBar() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><rect x="8.5" y="6" width="3" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="3" height="14" rx="0.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function SvgDonut() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 3a7 7 0 016.062 3.5H10V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function SvgCompare() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 3v14M3 7l4-4 4 4M13 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function SvgClock() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function SvgCar() {
  return <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 10h14l-1.4-4.2A1 1 0 0014.65 5H5.35a1 1 0 00-.95.8L3 10zm0 0h14v3a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" stroke="currentColor" strokeWidth="1.3"/><circle cx="5.5" cy="14" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="14.5" cy="14" r="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function SvgCalendar() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 7h16M6 3v4M14 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgFilter() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 4h14l-5.5 6v4l-3 2v-6L3 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}
function SvgUser() {
  return <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function SvgDownload() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 9l4 4 4-4M3 15v2h14v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function CommercialsPage() {
  const navigate = useNavigate();
  const [commercials, setCommercials] = useState([]);
  const [globals, setGlobals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState('performances');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('ca');
  const [searchQuery, setSearchQuery] = useState('');

  /* Historique state */
  const [histCommercialId, setHistCommercialId] = useState('all');
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [histStatus, setHistStatus] = useState('all');
  const [historyData, setHistoryData] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  /* Compare state */
  const [selectedCompare, setSelectedCompare] = useState([]);

  /* Chart refs */
  const monthlyChartRef = useRef(null);
  const monthlyChartInstance = useRef(null);
  const statusChartRef = useRef(null);
  const statusChartInstance = useRef(null);
  const compareChartRef = useRef(null);
  const compareChartInstance = useRef(null);
  const clockInterval = useRef(null);

  /* Assign colors to commercials cyclically */
  const commercialsWithColor = useMemo(() => {
    return commercials.map((c, i) => ({
      ...c,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [commercials]);

  /* Fetch all commercials data */
  const fetchCommercials = useCallback(async () => {
    try {
      const data = await apiGet('/commercials');
      setCommercials(data.commercials || []);
      setGlobals(data.globals || null);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Fetch history data */
  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams();
      if (histCommercialId && histCommercialId !== 'all') params.set('commercial_id', histCommercialId);
      if (histDateFrom) params.set('date_from', new Date(histDateFrom).toISOString());
      if (histDateTo) params.set('date_to', new Date(new Date(histDateTo).setHours(23, 59, 59, 999)).toISOString());
      if (histStatus && histStatus !== 'all') params.set('status', histStatus);
      const qs = params.toString();
      const data = await apiGet(`/commercials/history${qs ? '?' + qs : ''}`);
      setHistoryData(data.history || []);
    } catch (err) {
      console.error('fetchHistory error:', err);
    } finally {
      setHistLoading(false);
    }
  }, [histCommercialId, histDateFrom, histDateTo, histStatus]);

  /* Clock */
  const updateClock = useCallback(() => {
    const now = new Date();
    setClock(
      now.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short' }) +
      '  ' +
      now.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }, []);

  /* Initialize */
  useEffect(() => {
    fetchCommercials();
    updateClock();
    clockInterval.current = setInterval(updateClock, 1000);
    return () => {
      if (clockInterval.current) clearInterval(clockInterval.current);
    };
  }, [fetchCommercials, updateClock]);

  /* Fetch history when tab or filters change */
  useEffect(() => {
    if (activeTab === 'historique') {
      fetchHistory();
    }
  }, [activeTab, histCommercialId, histDateFrom, histDateTo, histStatus, fetchHistory]);

  /* Cleanup charts on unmount */
  useEffect(() => {
    return () => {
      if (monthlyChartInstance.current) { monthlyChartInstance.current.destroy(); monthlyChartInstance.current = null; }
      if (statusChartInstance.current) { statusChartInstance.current.destroy(); statusChartInstance.current = null; }
      if (compareChartInstance.current) { compareChartInstance.current.destroy(); compareChartInstance.current = null; }
    };
  }, []);

  /* ─── Sorting & Filtering ─── */
  const sortedCommercials = useMemo(() => {
    let arr = [...commercialsWithColor];
    const q = searchQuery.trim().toLowerCase();
    if (q) arr = arr.filter(c => c.full_name.toLowerCase().includes(q));
    const fns = {
      ca: (a, b) => b.ca_total - a.ca_total,
      name: (a, b) => a.full_name.localeCompare(b.full_name, 'fr'),
      completion: (a, b) => b.completion - a.completion,
      ecoulement: (a, b) => b.ecoulement - a.ecoulement,
      livraisons: (a, b) => b.livraisons_total - a.livraisons_total,
    };
    arr.sort(fns[sortBy] || fns.ca);
    return arr;
  }, [commercialsWithColor, sortBy, searchQuery]);

  /* ─── Charts ─── */
  useEffect(() => {
    if (activeTab !== 'historique' || historyData.length === 0) return;

    /* --- Monthly CA Bar Chart --- */
    const ctxMonthly = monthlyChartRef.current;
    if (ctxMonthly) {
      if (monthlyChartInstance.current) { monthlyChartInstance.current.destroy(); monthlyChartInstance.current = null; }

      // Aggregate monthly CA from history
      const monthlyMap = {};
      historyData.forEach(h => {
        const d = new Date(h.date);
        const key = d.getMonth(); // 0-11
        monthlyMap[key] = (monthlyMap[key] || 0) + h.ca;
      });
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const now = new Date();
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1).getMonth();
        return Number((monthlyMap[targetMonth] || 0).toFixed(3));
      });

      const selColor = histCommercialId !== 'all'
        ? (commercialsWithColor.find(c => c.id === histCommercialId)?.color || PALETTE[0])
        : PALETTE[0];

      monthlyChartInstance.current = new Chart(ctxMonthly, {
        type: 'bar',
        data: {
          labels: MONTH_LABELS,
          datasets: [{
            label: 'CA (DT)',
            data: monthlyData,
            backgroundColor: hexAlpha(selColor, 0.7),
            borderColor: selColor,
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1,
              titleColor: '#52566a', bodyColor: '#111318', padding: 10, cornerRadius: 8,
              callbacks: { label: (ctx) => ' ' + fmtDT(ctx.raw) },
            },
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A0AE', font: { family: 'Inter', size: 11 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, ticks: { color: '#94A0AE', font: { family: 'JetBrains Mono', size: 10 }, callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v } },
          },
        },
      });
    }

    /* --- Status Donut Chart --- */
    const ctxStatus = statusChartRef.current;
    if (ctxStatus) {
      if (statusChartInstance.current) { statusChartInstance.current.destroy(); statusChartInstance.current = null; }

      const sCloture = historyData.filter(h => h.status === 'CLOTURE').length;
      const sAnnule = historyData.filter(h => h.status === 'ANNULE').length;
      const sEnCours = historyData.filter(h => h.status === 'EN_COURS').length;
      const sEnRetour = historyData.filter(h => h.status === 'EN_RETOUR').length;

      statusChartInstance.current = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Clôturée', 'Annulée', 'En cours', 'En retour'],
          datasets: [{
            data: [sCloture, sAnnule, sEnCours, sEnRetour],
            backgroundColor: ['#0f9e6a', '#dc2626', '#2a78d6', '#d95926'],
            borderWidth: 2, borderColor: '#fff',
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, color: '#52566a', padding: 12, boxWidth: 10, borderRadius: 3 } },
            tooltip: { backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1, titleColor: '#52566a', bodyColor: '#111318', padding: 10, cornerRadius: 8 },
          },
        },
      });
    }

    /* --- Compare Chart --- */
    const ctxCompare = compareChartRef.current;
    if (ctxCompare && selectedCompare.length >= 2) {
      if (compareChartInstance.current) { compareChartInstance.current.destroy(); compareChartInstance.current = null; }

      const selComms = commercialsWithColor.filter(c => selectedCompare.includes(c.id));
      compareChartInstance.current = new Chart(ctxCompare, {
        type: 'bar',
        data: {
          labels: MONTH_LABELS,
          datasets: selComms.map(c => ({
            label: c.full_name,
            data: c.monthly_ca || Array(6).fill(0),
            backgroundColor: hexAlpha(c.color, 0.7),
            borderColor: c.color,
            borderWidth: 1.5,
            borderRadius: 4,
          })),
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, color: '#52566a', padding: 12, boxWidth: 10, borderRadius: 3 } },
            tooltip: { backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1, titleColor: '#52566a', bodyColor: '#111318', padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + fmtDT(ctx.raw) } },
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A0AE', font: { family: 'Inter', size: 10 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, ticks: { color: '#94A0AE', font: { family: 'JetBrains Mono', size: 10 }, callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v } },
          },
        },
      });
    }
  }, [activeTab, historyData, histCommercialId, selectedCompare, commercialsWithColor]);

  /* Compare selection */
  useEffect(() => {
    if (commercialsWithColor.length >= 2 && selectedCompare.length === 0) {
      setSelectedCompare([commercialsWithColor[0].id, commercialsWithColor[1].id]);
    }
  }, [commercialsWithColor, selectedCompare.length]);

  function toggleCompare(id) {
    setSelectedCompare(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // minimum 2
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) return prev; // maximum 5
      return [...prev, id];
    });
  }

  function viewHistorique(id) {
    setHistCommercialId(id);
    setActiveTab('historique');
  }

  /* ─── History Summary Computations ─── */
  const historySummary = useMemo(() => {
    const clôturéesOnly = historyData.filter(h => h.status === 'CLOTURE');
    const totalCA = clôturéesOnly.reduce((a, h) => a + h.ca, 0);
    const totalLivs = historyData.length;
    const totalCloture = clôturéesOnly.length;
    const compl = totalLivs > 0 ? Math.round((totalCloture / totalLivs) * 100) : 0;
    // SALAIRE commercials earn no commission — never sum theirs into the total,
    // even if a stale/legacy row carries a non-zero commission value.
    const totalComm = clôturéesOnly.reduce((a, h) => a + (h.commercial_remuneration_type === 'SALAIRE' ? 0 : (h.commission || 0)), 0);
    const totalAvances = historyData.reduce((a, h) => a + (h.avances || 0), 0);
    const totalNet = totalCA - totalComm - totalAvances;

    const selComm = histCommercialId !== 'all' ? commercialsWithColor.find(c => c.id === histCommercialId) : null;
    return { totalCA, totalLivs, compl, totalComm, totalAvances, totalNet, selComm };
  }, [historyData, histCommercialId, commercialsWithColor]);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="comm-page">
        <div className="brand-masthead">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="comm-live-badge"><span className="comm-live-dot" />Live</span>
            <h1 className="page-title">Performances Commerciaux</h1>
          </div>
        </div>
        <p style={{ color: 'var(--color-text-tertiary)' }}>Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="comm-page">
        <p style={{ color: 'var(--color-danger)' }}>Erreur: {error}</p>
      </div>
    );
  }

  const hs = historySummary;

  return (
    <div className="comm-page">
      {/* ══ TOP BAR ══ */}
      <div className="brand-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className="comm-live-badge"><span className="comm-live-dot" />Live</span>
          <div>
            <h1 className="page-title">Performances Commerciaux</h1>
            <p className="page-subtitle">
              {globals?.agents || 0} commerciaux actifs · CA global: {globals ? fmtDTShort(globals.ca_global) : '—'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="btn btn-outline btn-sm" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', gap: '6px', display: 'flex', alignItems: 'center' }}>
            <SvgClock /> <span>{clock || '—'}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { /* export */ }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SvgDownload /> Exporter
          </button>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="comm-tabs">
        <button className={`comm-tab ${activeTab === 'performances' ? 'active' : ''}`} onClick={() => setActiveTab('performances')}>
          <SvgChartBar /> Performances
        </button>
        <button className={`comm-tab ${activeTab === 'historique' ? 'active' : ''}`} onClick={() => setActiveTab('historique')}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 7h16" stroke="currentColor" strokeWidth="1.5"/><path d="M6 3v4M14 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Historique
        </button>
      </div>

      {/* ══════════════════════════════════════
           TAB 1 — PERFORMANCES
      ══════════════════════════════════════════ */}
      <div className={`comm-tab-content ${activeTab === 'performances' ? 'active' : ''}`}>

        {/* KPI ROW */}
        <div className="comm-kpi-grid">
          <div className="comm-kpi-card" style={{ '--accent': PALETTE[0] }}>
            <div className="comm-kpi-icon" style={{ background: hexAlpha(PALETTE[0], 0.1), color: PALETTE[0] }}><SvgUsers /></div>
            <div className="comm-kpi-label">Commerciaux actifs</div>
            <div className="comm-kpi-val">{globals?.agents ?? '—'}</div>
            <div className="comm-kpi-sub">comptes activés</div>
          </div>
          <div className="comm-kpi-card" style={{ '--accent': PALETTE[5 % PALETTE.length] }}>
            <div className="comm-kpi-icon" style={{ background: hexAlpha(PALETTE[5 % PALETTE.length], 0.1), color: PALETTE[5 % PALETTE.length] }}><SvgTruck /></div>
            <div className="comm-kpi-label">Livraisons en cours</div>
            <div className="comm-kpi-val">{globals?.encours ?? '—'}</div>
            <div className="comm-kpi-sub">EN_COURS + EN_RETOUR</div>
          </div>
          <div className="comm-kpi-card" style={{ '--accent': PALETTE[2] }}>
            <div className="comm-kpi-icon" style={{ background: hexAlpha(PALETTE[2], 0.1), color: PALETTE[2] }}><SvgCurrency /></div>
            <div className="comm-kpi-label">CA Global TTC</div>
            <div className="comm-kpi-val" style={{ fontSize: '18px' }}>{globals ? fmtDTShort(globals.ca_global) : '—'}</div>
            <div className="comm-kpi-sub">livraisons clôturées</div>
          </div>
          <div className="comm-kpi-card" style={{ '--accent': PALETTE[1] }}>
            <div className="comm-kpi-icon" style={{ background: hexAlpha(PALETTE[1], 0.1), color: PALETTE[1] }}><SvgPercent /></div>
            <div className="comm-kpi-label">Commissions</div>
            <div className="comm-kpi-val" style={{ fontSize: '18px' }}>{globals ? fmtDTShort(globals.commissions) : '—'}</div>
            <div className="comm-kpi-sub">10% du CA (hors salariés)</div>
          </div>
          <div className="comm-kpi-card" style={{ '--accent': PALETTE[3 % PALETTE.length] }}>
            <div className="comm-kpi-icon" style={{ background: hexAlpha(PALETTE[3 % PALETTE.length], 0.1), color: PALETTE[3 % PALETTE.length] }}><SvgChartPie /></div>
            <div className="comm-kpi-label">Taux de complétion</div>
            <div className="comm-kpi-val">{globals ? fmtPct(globals.completion_avg) : '—'}</div>
            <div className="comm-kpi-sub">moyenne tous commerciaux</div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="comm-toolbar">
          <div className="comm-search-wrap">
            <SvgSearch />
            <input type="text" className="comm-search-input" placeholder="Rechercher un commercial…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="comm-select-wrap">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="ca">Trier par : CA ↓</option>
              <option value="name">Nom A→Z</option>
              <option value="completion">Taux complétion</option>
              <option value="ecoulement">Taux d'écoulement</option>
            </select>
          </div>
          <div className="comm-view-toggle">
            <button className={`comm-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grille"><SvgGrid /></button>
            <button className={`comm-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="Liste"><SvgList /></button>
          </div>
        </div>

        {/* CARD GRID */}
        <div className="comm-section-label">Commerciaux</div>
        {viewMode === 'grid' ? (
          <div className="comm-grid">
            {sortedCommercials.length === 0 ? (
              <div className="comm-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                <br/>Aucun commercial trouvé
              </div>
            ) : sortedCommercials.map(c => (
              <div key={c.id} className="comm-card comm-fade-in" style={{ '--cc': c.color }}>
                <div className="cc-top">
                  <div className="cc-avatar" style={{ background: c.color }}>{c.initials}</div>
                  <div className="cc-info">
                    <div className="cc-name">{c.full_name}</div>
                    <div className="cc-vehicle"><SvgCar />{c.vehicle_name} · {c.vehicle_plate}</div>
                  </div>
                  <span className={`comm-badge ${statusBadgeClass(c.status)}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    {c.status === 'EN_COURS' && <span className="comm-status-dot" style={{ background: '#0f9e6a' }} />}
                    {statusLabel(c.status)}
                  </span>
                </div>
                <div className="cc-kpis">
                  <div className="cc-kpi">
                    <span className="cc-kpi-val">{c.livraisons_total}</span>
                    <span className="cc-kpi-lbl">Livraisons</span>
                  </div>
                  <div className="cc-kpi">
                    <span className="cc-kpi-val" style={{ color: c.color }}>{c.ecoulement}%</span>
                    <span className="cc-kpi-lbl">Écoulement</span>
                  </div>
                  <div className="cc-kpi">
                    <span className="cc-kpi-val" style={{ color: '#0f9e6a' }}>{c.completion}%</span>
                    <span className="cc-kpi-lbl">Complétion</span>
                  </div>
                </div>
                <div className="cc-bar-outer"><div className="cc-bar-inner" style={{ width: `${c.ecoulement}%`, background: c.color }} /></div>
                <div className="cc-footer">
                  <div>
                    <div className="cc-ca" style={{ color: c.color }}>{fmtDTShort(c.ca_total)}</div>
                    <div className="cc-rate-lbl">Net: {fmtDTShort(Math.max(0, c.net_a_reverser))}</div>
                    {c.prelevements_total > 0 && (
                      <div className="cc-rate-lbl" style={{ color: '#c2410c' }}>Prélèvements: {fmtDTShort(c.prelevements_total)}</div>
                    )}
                  </div>
                  <button className="cc-detail-btn" style={{ color: c.color, borderColor: hexAlpha(c.color, 0.3) }} onClick={() => viewHistorique(c.id)}>
                    <SvgEye /> Détail
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="comm-table-wrap">
            <div className="comm-scroll-x">
              <table className="comm-data-table">
                <thead>
                  <tr>
                    <th className="comm-sortable" onClick={() => setSortBy('name')}><div className="comm-th-inner">Commercial <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M7 3v14M3 7l4-4 4 4M13 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div></th>
                    <th>Véhicule</th>
                    <th className="comm-sortable" onClick={() => setSortBy('livraisons')}><div className="comm-th-inner">Livraisons <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M7 3v14M3 7l4-4 4 4M13 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div></th>
                    <th>Actives</th>
                    <th className="comm-sortable" onClick={() => setSortBy('ca')}><div className="comm-th-inner">CA Total <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M7 3v14M3 7l4-4 4 4M13 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div></th>
                    <th>Commission</th>
                    <th className="comm-sortable" onClick={() => setSortBy('completion')}><div className="comm-th-inner">Complétion <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M7 3v14M3 7l4-4 4 4M13 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div></th>
                    <th>Avances</th>
                    <th>Prélèvements</th>
                    <th>Net à reverser</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCommercials.map(c => (
                    <tr key={c.id} onClick={() => viewHistorique(c.id)}>
                      <td>
                        <div className="comm-agent-cell">
                          <div className="comm-avatar-sm" style={{ background: c.color }}>{c.initials}</div>
                          <span style={{ fontWeight: 500 }}>{c.full_name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>{c.vehicle_name}<br/><span style={{ color: 'var(--color-text-tertiary)' }}>{c.vehicle_plate}</span></td>
                      <td className="comm-mono">{c.livraisons_total}</td>
                      <td><span className={`comm-badge ${statusBadgeClass(c.status)}`}>{c.livraisons_actives || 0}</span></td>
                      <td className="comm-mono" style={{ color: c.color, fontWeight: 600 }}>{fmtDTShort(c.ca_total)}</td>
                      <td className="comm-mono" style={{ color: '#0f9e6a' }}>{c.remuneration_type === 'SALAIRE' ? <em style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>Salaire</em> : fmtDTShort(c.commission)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="comm-mini-bar"><div className="comm-mini-bar-inner" style={{ width: `${c.completion}%`, background: '#0f9e6a' }} /></div>
                          <span className="comm-mono" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{c.completion}%</span>
                        </div>
                      </td>
                      <td className="comm-mono">{c.avances_total > 0 ? fmtDTShort(c.avances_total) : '—'}</td>
                      <td className="comm-mono" style={{ color: c.prelevements_total > 0 ? '#c2410c' : undefined }}>{c.prelevements_total > 0 ? fmtDTShort(c.prelevements_total) : '—'}</td>
                      <td className="comm-mono" style={{ color: PALETTE[0], fontWeight: 600 }}>{fmtDTShort(Math.max(0, c.net_a_reverser))}</td>
                      <td><span className={`comm-badge ${statusBadgeClass(c.status)}`}>{statusLabel(c.status)}</span></td>
                    </tr>
                  ))}
                  {sortedCommercials.length === 0 && (
                    <tr><td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-tertiary)' }}>Aucun commercial trouvé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>{/* /tab performances */}

      {/* ══════════════════════════════════════
           TAB 2 — HISTORIQUE
      ══════════════════════════════════════════ */}
      <div className={`comm-tab-content ${activeTab === 'historique' ? 'active' : ''}`}>

        {/* FILTERS */}
        <div className="comm-hist-filters">
          <div className="comm-filter-group" style={{ maxWidth: 220 }}>
            <div className="comm-filter-label"><SvgUser /> Commercial</div>
            <select className="comm-filter-select" value={histCommercialId} onChange={e => setHistCommercialId(e.target.value)}>
              <option value="all">Tous les commerciaux</option>
              {commercialsWithColor.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="comm-filter-group" style={{ maxWidth: 160 }}>
            <div className="comm-filter-label"><SvgCalendar /> Du</div>
            <input type="date" className="comm-filter-input" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)} />
          </div>
          <div className="comm-filter-group" style={{ maxWidth: 160 }}>
            <div className="comm-filter-label"><SvgCalendar /> Au</div>
            <input type="date" className="comm-filter-input" value={histDateTo} onChange={e => setHistDateTo(e.target.value)} />
          </div>
          <div className="comm-filter-group" style={{ maxWidth: 180 }}>
            <div className="comm-filter-label"><SvgFilter /> Statut</div>
            <select className="comm-filter-select" value={histStatus} onChange={e => setHistStatus(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="CLOTURE">Clôturée</option>
              <option value="EN_COURS">En cours</option>
              <option value="EN_RETOUR">En retour</option>
              <option value="ANNULE">Annulée</option>
            </select>
          </div>
          <button className="comm-btn comm-btn-primary comm-btn-sm" onClick={fetchHistory} disabled={histLoading}>
            <SvgSearch /> Filtrer
          </button>
        </div>

        {histLoading ? (
          <p style={{ color: 'var(--color-text-tertiary)', padding: '20px 0' }}>Chargement...</p>
        ) : (
          <>
            {/* SUMMARY CARD */}
            <div className="comm-summary-card">
              <div className="comm-summary-header">
                <div className="comm-summary-avatar" style={{ background: hs.selComm?.color || PALETTE[0] }}>
                  {hs.selComm?.initials || 'ΣΣ'}
                </div>
                <div>
                  <div className="comm-summary-title">{hs.selComm?.full_name || 'Tous les commerciaux'}</div>
                  <div className="comm-summary-period">
                    {histDateFrom ? new Date(histDateFrom).toLocaleDateString('fr-TN', { month: 'short', year: 'numeric' }) : '—'} → {histDateTo ? new Date(histDateTo).toLocaleDateString('fr-TN', { month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>
              </div>
              <div className="comm-summary-grid">
                <div className="comm-sum-item"><span className="comm-sum-val" style={{ color: PALETTE[2] }}>{fmtDT(hs.totalCA)}</span><span className="comm-sum-lbl">CA période</span></div>
                <div className="comm-sum-item"><span className="comm-sum-val">{hs.totalLivs}</span><span className="comm-sum-lbl">Livraisons</span></div>
                <div className="comm-sum-item"><span className="comm-sum-val">{fmtPct(hs.compl)}</span><span className="comm-sum-lbl">Complétion</span></div>
                <div className="comm-sum-item"><span className="comm-sum-val" style={{ color: PALETTE[1] }}>{hs.selComm?.remuneration_type === 'SALAIRE' ? <em style={{ fontSize: '13px', fontStyle: 'normal', color: 'var(--color-text-tertiary)' }}>Salaire</em> : fmtDT(hs.totalComm)}</span><span className="comm-sum-lbl">Commission</span></div>
                <div className="comm-sum-item"><span className="comm-sum-val">{fmtDT(hs.totalAvances)}</span><span className="comm-sum-lbl">Avances</span></div>
                <div className="comm-sum-item"><span className="comm-sum-val" style={{ color: PALETTE[0] }}>{fmtDT(Math.max(0, hs.totalNet))}</span><span className="comm-sum-lbl">Net reversé</span></div>
              </div>
            </div>

            {/* CHARTS ROW */}
            <div className="comm-charts-row">
              <div className="comm-chart-panel">
                <div className="comm-chart-title"><SvgChartBar /> CA mensuel (DT)</div>
                <div className="comm-chart-wrap" style={{ height: 220 }}><canvas ref={monthlyChartRef} /></div>
              </div>
              <div className="comm-chart-panel">
                <div className="comm-chart-title"><SvgDonut /> Répartition statuts</div>
                <div className="comm-chart-wrap" style={{ height: 220 }}><canvas ref={statusChartRef} /></div>
              </div>
            </div>

            {/* COMPARE SECTION */}
            <div className="comm-compare-section">
              <div className="comm-compare-header">
                <div className="comm-compare-title"><SvgCompare /> Comparaison multi-commerciaux</div>
                <div className="comm-compare-hint">Sélectionnez 2 à 5 commerciaux à comparer</div>
              </div>
              <div className="comm-compare-chips">
                {commercialsWithColor.map(c => {
                  const sel = selectedCompare.includes(c.id);
                  return (
                    <span key={c.id} className={`comm-chip ${sel ? 'selected' : ''}`}
                      style={{ color: c.color, background: hexAlpha(c.color, 0.08) }}
                      onClick={() => toggleCompare(c.id)}>
                      <span className="comm-chip-avatar" style={{ background: c.color }}>{c.initials}</span>
                      {c.full_name}
                    </span>
                  );
                })}
              </div>
              {selectedCompare.length >= 2 && (
                <>
                  <div className="comm-compare-table-wrap">
                    <table className="comm-compare-table">
                      <thead>
                        <tr>
                          <th style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', padding: '8px 12px' }}>Indicateur</th>
                          {commercialsWithColor.filter(c => selectedCompare.includes(c.id)).map(c => (
                            <th key={c.id} style={{ color: c.color, fontSize: '10px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />{c.full_name}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'CA Total', fn: c => fmtDTShort(c.ca_total) },
                          { label: 'Commission (10%)', fn: c => c.remuneration_type === 'SALAIRE' ? 'Salaire' : fmtDTShort(c.commission) },
                          { label: 'Livraisons totales', fn: c => c.livraisons_total },
                          { label: 'Clôturées', fn: c => c.livraisons_cloturees },
                          { label: 'Annulées', fn: c => c.livraisons_annulees },
                          { label: 'Taux complétion', fn: c => fmtPct(c.completion) },
                          { label: "Taux d'écoulement", fn: c => fmtPct(c.ecoulement) },
                          { label: 'Avances', fn: c => c.avances_total > 0 ? fmtDTShort(c.avances_total) : '—' },
                          { label: 'Prélèvements', fn: c => c.prelevements_total > 0 ? fmtDTShort(c.prelevements_total) : '—' },
                          { label: 'Net à reverser', fn: c => fmtDTShort(Math.max(0, c.net_a_reverser)) },
                        ].map((m, i) => (
                          <tr key={m.label}>
                            <td style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', padding: '10px 12px', background: i % 2 === 0 ? 'var(--color-surface-hover)' : 'var(--color-surface)' }}>{m.label}</td>
                            {commercialsWithColor.filter(c => selectedCompare.includes(c.id)).map(c => (
                              <td key={c.id} className="comm-mono" style={{ background: i % 2 === 0 ? 'var(--color-surface-hover)' : 'var(--color-surface)', padding: '10px 12px' }}>{m.fn(c)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="comm-compare-chart-wrap"><canvas ref={compareChartRef} /></div>
                </>
              )}
            </div>

            {/* HISTORIQUE TABLE */}
            <div className="comm-hist-table-wrap">
              <div className="comm-hist-table-header">
                <div className="comm-hist-table-title">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M6 11h3M6 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Historique des livraisons
                </div>
                <span className="comm-badge comm-badge-gray">{historyData.length} livraison{historyData.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="comm-scroll-x">
                <table className="comm-data-table">
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Commercial</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Chargé</th>
                      <th>Vendu</th>
                      <th>Écoulement</th>
                      <th>CA</th>
                      <th>Commission</th>
                      <th>Avances</th>
                      <th>Net reversé</th>
                      <th>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.length === 0 ? (
                      <tr><td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-tertiary)' }}>Aucune livraison trouvée</td></tr>
                    ) : historyData.map(h => {
                      const commColor = commercialsWithColor.find(c => c.id === h.commercial_id)?.color || PALETTE[0];
                      const commInitials = (h.commercial_name || '').trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                      return (
                        <tr key={h.id} onClick={() => navigate(`/livraisons/${h.id}`)}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: PALETTE[0], fontWeight: 500 }}>{h.reference}</td>
                          <td>
                            <div className="comm-agent-cell">
                              <div className="comm-avatar-sm" style={{ background: commColor, width: 26, height: 26, fontSize: 10 }}>{commInitials}</div>
                              <span style={{ fontSize: '12px' }}>{h.commercial_name}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {new Date(h.date).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td><span className={`comm-badge ${statusBadgeClass(h.status)}`} style={{ fontSize: '10px', padding: '3px 8px' }}>{statusLabel(h.status)}</span></td>
                          <td className="comm-mono">{h.charge}</td>
                          <td className="comm-mono" style={{ color: commColor, fontWeight: 600 }}>{h.vendu}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.07)', borderRadius: 4, minWidth: 36 }}>
                                <div style={{ height: '100%', width: `${h.ecoulement}%`, background: commColor, borderRadius: 4 }} />
                              </div>
                              <span className="comm-mono" style={{ fontSize: '11px' }}>{h.ecoulement}%</span>
                            </div>
                          </td>
                          <td className="comm-mono" style={{ fontWeight: 600 }}>{fmtDT(h.ca)}</td>
                          <td className="comm-mono" style={{ color: '#0f9e6a' }}>{h.commercial_remuneration_type === 'SALAIRE' ? <em style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>Salaire</em> : fmtDT(h.commission)}</td>
                          <td className="comm-mono">{fmtDT(h.avances)}</td>
                          <td className="comm-mono" style={{ color: PALETTE[0] }}>{fmtDT(Math.max(0, h.net_a_reverser))}</td>
                          <td className="comm-mono">{h.duree}j</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>{/* /tab historique */}

    </div>
  );
}
