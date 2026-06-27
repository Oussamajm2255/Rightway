import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import { Chart } from 'chart.js/auto';
import './DashboardPage.css';

// ─── Palette ───
const PALETTE = {
  blue: '#2a78d6', green: '#0f9e6a', amber: '#c98500', purple: '#7c3aed',
  red: '#dc2626', pink: '#db2777', orange: '#d95926', emerald: '#16a34a',
  cyan: '#0891b2', violet: '#9333ea', rose: '#e11d48', lime: '#65a30d',
};
const DONUT_COLORS = [PALETTE.emerald, PALETTE.red, PALETTE.blue, PALETTE.orange];
const DONUT_LABELS = ['Clôturée', 'Annulée', 'En cours', 'En retour'];

// ─── Helpers ───
function fmtDT(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
}
function fmtDTShort(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k DT';
  return fmtDT(n);
}
function fmtInt(v) { return v === null || v === undefined ? '—' : Number(v).toString(); }

const MONTH_NAMES = ['Janv', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// ─── SVG Icons ───
const Icons = {
  users:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="17" cy="7" r="3"/><path d="M15 15a4 4 0 014 4v2"/></svg>,
  package: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  truck:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 17h16M6 17V6l4-4h8v15" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/></svg>,
  dollar:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  percent: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="3"/><path d="M20 4L4 20"/><circle cx="17" cy="17" r="3"/></svg>,
  alert:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><circle cx="12" cy="17" r="1"/></svg>,
  clock:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  pie:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0110 10H12V2z"/></svg>,
  wallet:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M16 12h2"/></svg>,
  download:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v14M7 12l5 5 5-5"/><path d="M4 20h16"/></svg>,
  plus:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  edit:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>,
  monit:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  circleCheck: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>,
  adjust: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="6" r="2"/><path d="M7 6h14M3 12h14"/><circle cx="19" cy="12" r="2"/><path d="M3 18h14"/><circle cx="19" cy="18" r="2"/></svg>,
};

// ─── KPI Card ───
function KpiCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div
      className={`kpi-card${onClick ? ' kpi-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      <div className="kpi-accent" style={{ background: color || PALETTE.blue }} />
      <div className="kpi-icon-wrap" style={{ background: hexAlpha(color || PALETTE.blue, 0.12) }}>
        <span style={{ color: color || PALETTE.blue }}>{icon}</span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={label.length > 14 ? { fontSize: '15px' } : {}}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Section Header ───
function SectionHeader({ title }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <div className="section-header-line" />
    </div>
  );
}

// ─── Progress Bar ───
function ProgressBar({ pct, color, large }) {
  const c = pct === 100 ? PALETTE.emerald : pct > 70 ? PALETTE.blue : PALETTE.amber;
  return (
    <div className="progress-wrap">
      <div className={`progress-track${large ? ' lg' : ''}`}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color || c }} />
      </div>
      <span className="progress-pct">{pct}%</span>
    </div>
  );
}

// ─── Status Badge ───
const STATUS_MAP = {
  EN_COURS: { cls: 'badge-encours', label: 'EN COURS', dot: PALETTE.blue },
  EN_RETOUR: { cls: 'badge-retour', label: 'EN RETOUR', dot: PALETTE.orange },
  CLOTURE: { cls: 'badge-cloture', label: 'CLÔTURÉ', dot: PALETTE.emerald },
  ANNULE: { cls: 'badge-annule', label: 'ANNULE', dot: PALETTE.red },
  EN_ATTENTE_COMMERCIAL: { cls: 'badge-attente', label: 'EN ATTENTE', dot: PALETTE.amber },
  ACTIF: { cls: 'badge-active', label: 'ACTIF', dot: PALETTE.green },
  INACTIVE: { cls: 'badge-inactive', label: 'INACTIF', dot: '#94a0ae' },
};
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.INACTIVE;
  return (
    <span className={`badge-db ${s.cls}`}>
      <span className="badge-dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── Rank Badge ───
function RankBadge({ rank }) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
  return <span className={`rank-badge ${cls}`}>#{rank}</span>;
}

// ─── Avatar ───
function Avatar({ initials, color }) {
  return (
    <span className="avatar" style={{ background: hexAlpha(color || PALETTE.blue, 0.13), color: color || PALETTE.blue }}>
      {initials}
    </span>
  );
}

// ─── Color Utility ───
function hexAlpha(hex, alpha) {
  if (!hex) return `rgba(42,120,214,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchDashboard() {
      try {
        const endpoint = `/dashboard/${user.role === 'SUPER_ADMIN' ? 'super-admin' : user.role === 'ADMIN' ? 'admin' : 'commercial'}`;
        const result = await apiGet(endpoint);
        if (!cancelled) setData(result);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchDashboard();
    return () => { cancelled = true; };
  }, [user.role]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dash-topbar">
          <div className="topbar-left">
            <div className="live-badge"><div className="live-dot" /><span className="live-text">Live</span></div>
            <div className="topbar-title"><h1>Tableau de bord</h1><span>Chargement...</span></div>
          </div>
        </div>
        <div className="dash-content">
          <div className="kpi-grid kpi-grid-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="kpi-card skeleton-card" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {user.role === 'SUPER_ADMIN' && <SuperAdminView data={data} navigate={navigate} user={user} />}
      {user.role === 'ADMIN' && <AdminView data={data} navigate={navigate} user={user} />}
      {user.role === 'COMMERCIAL' && <CommercialView data={data} navigate={navigate} user={user} />}
    </div>
  );
}

// ═══════════════════════════ SUPER ADMIN ═══════════════════════════

function SuperAdminView({ data, navigate, user }) {
  const barRef = useRef(null);
  const donutRef = useRef(null);

  useEffect(() => {
    if (!data?.monthly_ca) return;
    const barCtx = document.getElementById('sa-chart-bar');
    const donutCtx = document.getElementById('sa-chart-donut');
    if (barCtx && barRef.current) barRef.current.destroy();
    if (donutCtx && donutRef.current) donutRef.current.destroy();

    if (barCtx) {
      barRef.current = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: data.monthly_labels || MONTH_NAMES.slice(0, 6),
          datasets: [{
            label: 'CA Global',
            data: data.monthly_ca,
            backgroundColor: PALETTE.blue + 'bb',
            borderColor: PALETTE.blue,
            borderWidth: 1.5,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtDTShort(ctx.parsed.y) } } },
          scales: { x: { grid: { color: '#e1e5ef80' } }, y: { grid: { color: '#e1e5ef80' }, ticks: { callback: (v) => fmtDTShort(v) } } },
        },
      });
    }
    if (donutCtx && data.status_distribution) {
      const dist = data.status_distribution;
      donutRef.current = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: DONUT_LABELS,
          datasets: [{
            data: [dist.CLOTURE || 0, dist.ANNULE || 0, dist.EN_COURS || 0, dist.EN_RETOUR || 0],
            backgroundColor: DONUT_COLORS,
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 4,
          }],
        },
        options: {
          cutout: '68%', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, padding: 14, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } } },
        },
      });
    }
    return () => {
      if (barRef.current) { barRef.current.destroy(); barRef.current = null; }
      if (donutRef.current) { donutRef.current.destroy(); donutRef.current = null; }
    };
  }, [data]);

  return (
    <>
      <DashboardTopbar subtitle="Vue d'ensemble · STE RIGHT WAY FOR TRADING" user={user} showExport />
      <div className="dash-content">
        {/* KPI Row */}
        <div className="kpi-grid kpi-grid-6">
          <KpiCard icon={Icons.users} label="Commerciaux actifs" value={fmtInt(data.users_count)} sub="comptes activés" color={PALETTE.blue} onClick={() => navigate('/commercials')} />
          <KpiCard icon={Icons.package} label="Produits actifs" value={fmtInt(data.products_count)} sub="catalogue" color={PALETTE.emerald} onClick={() => navigate('/products')} />
          <KpiCard icon={Icons.truck} label="Livraisons actives" value={fmtInt(data.active_livraisons)} sub="EN_COURS + EN_RETOUR" color={PALETTE.orange} onClick={() => navigate('/livraisons')} />
          <KpiCard icon={Icons.dollar} label="CA Global TTC" value={fmtDT(data.ca_total)} sub="livraisons clôturées" color={PALETTE.amber} />
          <KpiCard icon={Icons.percent} label="Commissions" value={fmtDT(data.commissions)} sub="10% du CA global" color={PALETTE.green} />
          <KpiCard icon={Icons.alert} label="Alertes stock" value={<span style={{color:PALETTE.red}}>{fmtInt(data.stock_alerts_count)}</span>} sub="produits &lt; 20 unités" color={PALETTE.red} onClick={() => navigate('/stock')} />
        </div>

        {/* Performance Charts */}
        <div>
          <SectionHeader title="Performance" />
          <div className="charts-grid">
            <div className="chart-card">
              <h3>CA mensuel — 6 derniers mois (tous commerciaux)</h3>
              <div className="chart-wrap"><canvas id="sa-chart-bar" /></div>
            </div>
            <div className="chart-card">
              <h3>Répartition statuts livraisons</h3>
              <div className="chart-wrap"><canvas id="sa-chart-donut" /></div>
            </div>
          </div>
        </div>

        {/* Top 5 Commerciaux */}
        {data.top_commerciaux && data.top_commerciaux.length > 0 && (
          <div>
            <SectionHeader title="Top 5 Commerciaux" />
            <div className="table-card">
              <table className="data-table-db">
                <thead>
                  <tr>
                    <th>Rang</th><th>Commercial</th><th>Livraisons</th><th>CA</th><th>Écoulement</th><th>Commission</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_commerciaux.map((c) => (
                    <tr key={c.rank} onClick={() => navigate('/commercials')} className="clickable-row">
                      <td><RankBadge rank={c.rank} /></td>
                      <td>
                        <span className="avatar-name">
                          <Avatar initials={c.initials} color={[PALETTE.blue, PALETTE.green, PALETTE.purple, PALETTE.amber, PALETTE.orange][c.rank - 1]} />
                          {c.full_name}
                        </span>
                      </td>
                      <td className="td-mono">{c.livraisons}</td>
                      <td className="td-mono">{fmtDTShort(c.ca)}</td>
                      <td style={{minWidth:120}}><ProgressBar pct={c.ecoulement} color={[PALETTE.blue, PALETTE.green, PALETTE.purple, PALETTE.amber, PALETTE.orange][c.rank - 1]} /></td>
                      <td className="td-mono">{fmtDTShort(c.commission)}</td>
                      <td><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Feed */}
        {data.activity_feed && data.activity_feed.length > 0 && (
          <div>
            <SectionHeader title="Activité récente" />
            <div className="activity-feed">
              {data.activity_feed.map((e, i) => <FeedItem key={i} event={e} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════ ADMIN ═══════════════════════════

function AdminView({ data, navigate, user }) {
  const barRef = useRef(null);
  const donutRef = useRef(null);

  useEffect(() => {
    if (!data?.monthly_ca) return;
    const barCtx = document.getElementById('admin-chart-bar');
    const donutCtx = document.getElementById('admin-chart-donut');
    if (barCtx && barRef.current) barRef.current.destroy();
    if (donutCtx && donutRef.current) donutRef.current.destroy();

    if (barCtx) {
      barRef.current = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: data.monthly_labels || MONTH_NAMES.slice(0, 6),
          datasets: [{
            label: 'CA Livraisons',
            data: data.monthly_ca,
            backgroundColor: PALETTE.cyan + 'bb',
            borderColor: PALETTE.cyan,
            borderWidth: 1.5,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtDTShort(ctx.parsed.y) } } },
          scales: { x: { grid: { color: '#e1e5ef80' } }, y: { grid: { color: '#e1e5ef80' }, ticks: { callback: (v) => fmtDTShort(v) } } },
        },
      });
    }
    if (donutCtx && data.status_distribution) {
      const dist = data.status_distribution;
      donutRef.current = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: DONUT_LABELS,
          datasets: [{
            data: [dist.CLOTURE || 0, dist.ANNULE || 0, dist.EN_COURS || 0, dist.EN_RETOUR || 0],
            backgroundColor: DONUT_COLORS,
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 4,
          }],
        },
        options: {
          cutout: '68%', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, padding: 14, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } } },
        },
      });
    }
    return () => {
      if (barRef.current) { barRef.current.destroy(); barRef.current = null; }
      if (donutRef.current) { donutRef.current.destroy(); donutRef.current = null; }
    };
  }, [data]);

  return (
    <>
      <DashboardTopbar subtitle="Gestion dépôt" user={user} />
      <div className="dash-content">
        {/* KPI Row */}
        <div className="kpi-grid kpi-grid-5">
          <KpiCard icon={Icons.package} label="Produits en stock" value={fmtInt(data.stock_products)} sub={`${fmtInt(data.stock_total_qty)} unités totales`} color={PALETTE.emerald} onClick={() => navigate('/stock')} />
          <KpiCard icon={Icons.truck} label="Livraisons actives" value={fmtInt(data.active_livraisons)} sub="EN_COURS + EN_RETOUR" color={PALETTE.orange} onClick={() => navigate('/livraisons')} />
          <KpiCard icon={Icons.clock} label="En attente commercial" value={fmtInt(data.pending_livraisons)} sub="confirmation bon de sortie" color={PALETTE.amber} onClick={() => navigate('/livraisons')} />
          <KpiCard icon={Icons.dollar} label="CA période" value={fmtDT(data.ca_period)} sub="ce mois (Juin)" color={PALETTE.blue} />
          <KpiCard icon={Icons.alert} label="Alertes stock" value={<span style={{color:PALETTE.red}}>{fmtInt(data.stock_alerts?.length || 0)}</span>} sub="produits &lt; 20 unités" color={PALETTE.red} onClick={() => navigate('/stock')} />
        </div>

        {/* Charts */}
        <div>
          <SectionHeader title="Mes livraisons en cours" />
          <div className="charts-grid">
            <div className="chart-card">
              <h3>CA mensuel — livraisons clôturées</h3>
              <div className="chart-wrap"><canvas id="admin-chart-bar" /></div>
            </div>
            <div className="chart-card">
              <h3>Répartition statuts</h3>
              <div className="chart-wrap"><canvas id="admin-chart-donut" /></div>
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        {data.stock_alerts && data.stock_alerts.length > 0 && (
          <div>
            <SectionHeader title="Produits en alerte (&lt; 20 unités)" />
            <div className="table-card">
              <table className="data-table-db">
                <thead>
                  <tr>
                    <th>Code</th><th>Produit</th><th>Catégorie</th><th>Stock actuel</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock_alerts.map((s) => (
                    <tr key={s.id} className={s.quantity < 10 ? 'row-stock-low' : ''}>
                      <td className="td-mono td-muted">{s.code || s.id}</td>
                      <td className="td-name">{s.name}</td>
                      <td><span className="badge-db badge-inactive">{s.category || '—'}</span></td>
                      <td><span className="td-mono" style={{color: s.quantity < 10 ? PALETTE.red : PALETTE.amber, fontWeight: 600}}>{s.quantity}</span> unités</td>
                      <td><button className="btn btn-sm btn-outline" onClick={() => navigate(`/stock`)}><Icons.adjust /> Ajuster</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <SectionHeader title="Actions rapides" />
          <div className="actions-row">
            <button className="action-btn action-primary" onClick={() => navigate('/livraisons/nouvelle')}>
              {Icons.plus} Nouvelle livraison
            </button>
            <button className="action-btn action-secondary" onClick={() => navigate('/stock')}>
              {Icons.package} Gérer le stock
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════ COMMERCIAL ═══════════════════════════

function CommercialView({ data, navigate, user }) {
  const barRef = useRef(null);
  const donutRef = useRef(null);

  useEffect(() => {
    if (!data?.monthly_ca) return;
    const barCtx = document.getElementById('com-chart-bar');
    const donutCtx = document.getElementById('com-chart-donut');
    if (barCtx && barRef.current) barRef.current.destroy();
    if (donutCtx && donutRef.current) donutRef.current.destroy();

    if (barCtx) {
      barRef.current = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: data.monthly_labels || MONTH_NAMES.slice(0, 6),
          datasets: [{
            label: 'Mon CA',
            data: data.monthly_ca,
            backgroundColor: PALETTE.purple + 'bb',
            borderColor: PALETTE.purple,
            borderWidth: 1.5,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmtDTShort(ctx.parsed.y) } } },
          scales: { x: { grid: { color: '#e1e5ef80' } }, y: { grid: { color: '#e1e5ef80' }, ticks: { callback: (v) => fmtDTShort(v) } } },
        },
      });
    }
    if (donutCtx && data.status_distribution) {
      const dist = data.status_distribution;
      donutRef.current = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: DONUT_LABELS,
          datasets: [{
            data: [dist.CLOTURE || 0, dist.ANNULE || 0, dist.EN_COURS || 0, dist.EN_RETOUR || 0],
            backgroundColor: DONUT_COLORS,
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 4,
          }],
        },
        options: {
          cutout: '68%', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, padding: 14, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } } },
        },
      });
    }
    return () => {
      if (barRef.current) { barRef.current.destroy(); barRef.current = null; }
      if (donutRef.current) { donutRef.current.destroy(); donutRef.current = null; }
    };
  }, [data]);

  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <>
      <DashboardTopbar subtitle={`Bonjour ${firstName} 👋`} user={user} />
      <div className="dash-content">
        {/* KPI Row */}
        <div className="kpi-grid kpi-grid-5">
          <KpiCard icon={Icons.dollar} label="Mon CA Total" value={fmtDT(data.ca_total)} sub="livraisons clôturées" color={PALETTE.blue} />
          <KpiCard icon={Icons.percent} label="Ma Commission" value={fmtDT(data.commission)} sub="10% du CA" color={PALETTE.green} />
          <KpiCard icon={Icons.pie} label="Taux complétion" value={<span style={{color:PALETTE.purple}}>{data.completion_rate}%</span>} sub={`${data.completion_details?.cloturees || 0} / ${data.completion_details?.total || 0} livraisons`} color={PALETTE.purple} />
          <KpiCard icon={Icons.truck} label="En tournée" value={fmtInt(data.en_tournee)} sub="active" color={PALETTE.orange} onClick={() => navigate('/livraisons')} />
          <KpiCard icon={Icons.wallet} label="Avances acceptées" value={fmtDT(data.avances_acceptees)} sub="total" color={PALETTE.amber} />
        </div>

        {/* Active Delivery Hero */}
        {data.active_livraison && (
          <div>
            <SectionHeader title="Livraison active" />
            <div className="delivery-hero">
              <div className="delivery-status-line">
                <span className="badge-db badge-active" style={{fontSize:11,padding:'5px 12px'}}>
                  <span className="badge-dot" style={{background:PALETTE.green}} />EN TOURNÉE
                </span>
              </div>
              <div className="delivery-ref">{data.active_livraison.reference}</div>
              <div className="delivery-date">Démarrée le {new Date(data.active_livraison.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'})}</div>
              <div className="delivery-progress-section">
                <div className="delivery-progress-labels">
                  <span>Écoulement : <strong>{data.active_livraison.vendu} / {data.active_livraison.charge} produits vendus</strong></span>
                  <strong style={{color:PALETTE.green}}>{data.active_livraison.ecoulement}%</strong>
                </div>
                <ProgressBar pct={data.active_livraison.ecoulement} large gradient />
              </div>
              <div className="delivery-ca">CA en cours : <strong>{fmtDT(data.active_livraison.ca)}</strong></div>
              <div className="delivery-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/ventes/${data.active_livraison.id}`)}>
                  {Icons.edit} Déclarer ventes
                </button>
                <button className="btn btn-outline" onClick={() => navigate(`/livraisons/${data.active_livraison.id}/realtime`)}>
                  {Icons.monit} Suivre en temps réel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Bons */}
        {data.pending_bons && data.pending_bons.length > 0 && (
          <div>
            <SectionHeader title="Bons de sortie en attente de confirmation" />
            <div className="bon-list">
              {data.pending_bons.map((bon) => (
                <div key={bon.id} className="bon-card" onClick={() => navigate(`/livraisons/${bon.id}`)}>
                  <div className="bon-icon"><Icons.check /></div>
                  <div className="bon-info">
                    <div className="bon-ref">{bon.reference}</div>
                    <div className="bon-meta">Créé par {bon.admin_name} le {new Date(bon.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'})}</div>
                  </div>
                  <button className="btn btn-sm btn-success-ghost" onClick={(e) => { e.stopPropagation(); navigate(`/livraisons/${bon.id}`); }}>
                    {Icons.check} Confirmer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Charts */}
        <div>
          <SectionHeader title="Mes performances" />
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Mon CA mensuel — 6 derniers mois</h3>
              <div className="chart-wrap"><canvas id="com-chart-bar" /></div>
            </div>
            <div className="chart-card">
              <h3>Répartition statuts de mes livraisons</h3>
              <div className="chart-wrap"><canvas id="com-chart-donut" /></div>
            </div>
          </div>
        </div>

        {/* Recent History */}
        {data.recent_livraisons && data.recent_livraisons.length > 0 && (
          <div>
            <SectionHeader title="Dernières livraisons" />
            <div className="table-card">
              <table className="data-table-db">
                <thead>
                  <tr>
                    <th>Référence</th><th>Date</th><th>Statut</th><th>Chargé</th><th>Vendu</th><th>Écoulement</th><th>CA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_livraisons.map((l) => (
                    <tr key={l.id} onClick={() => navigate(`/livraisons/${l.id}`)} className="clickable-row">
                      <td className="td-mono td-ref">{l.reference}</td>
                      <td className="td-date">{new Date(l.created_at).toLocaleDateString('fr-FR')}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td className="td-mono">{l.charge}</td>
                      <td className="td-mono">{l.vendu}</td>
                      <td style={{minWidth:100}}><ProgressBar pct={l.ecoulement} /></td>
                      <td className="td-mono" style={{color:PALETTE.blue}}>{l.ca > 0 ? fmtDTShort(l.ca) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════ SHARED COMPONENTS ═══════════════════════════

// ─── Topbar ───
function DashboardTopbar({ subtitle, user, showExport }) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const months = ['Janv','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    function tick() {
      const now = new Date();
      const d = now.getDate().toString().padStart(2, '0');
      const m = months[now.getMonth()];
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const ss = now.getSeconds().toString().padStart(2, '0');
      setClock(`${d} ${m} ${hh}:${mm}:${ss}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="dash-topbar">
      <div className="topbar-left">
        <div className="live-badge">
          <div className="live-dot" />
          <span className="live-text">Live</span>
        </div>
        <div className="topbar-title">
          <h1>Tableau de bord</h1>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="clock">{clock || '— — : — — : — —'}</div>
        {showExport && <button className="btn btn-outline btn-sm">{Icons.download} Export</button>}
      </div>
    </div>
  );
}

// ─── Feed Item ───
const FEED_ICONS = {
  check: Icons.circleCheck,
  cash: Icons.dollar,
  truck: Icons.truck,
  user: Icons.users,
  x: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/></svg>,
  package: Icons.package,
};
const FEED_COLORS = {
  check: { color: PALETTE.emerald, bg: hexAlpha(PALETTE.emerald, 0.12) },
  cash: { color: PALETTE.green, bg: hexAlpha(PALETTE.green, 0.12) },
  truck: { color: PALETTE.blue, bg: hexAlpha(PALETTE.blue, 0.12) },
  user: { color: PALETTE.purple, bg: hexAlpha(PALETTE.purple, 0.12) },
  x: { color: PALETTE.red, bg: hexAlpha(PALETTE.red, 0.12) },
  package: { color: PALETTE.amber, bg: hexAlpha(PALETTE.amber, 0.12) },
};

function FeedItem({ event }) {
  const iconCfg = FEED_COLORS[event.icon] || FEED_COLORS.check;
  return (
    <div className="feed-item">
      <div className="feed-icon" style={{ background: iconCfg.bg }}>
        <span style={{ color: iconCfg.color }}>{FEED_ICONS[event.icon] || FEED_ICONS.check}</span>
      </div>
      <div className="feed-content">
        <div className="feed-text" dangerouslySetInnerHTML={{ __html: event.text }} />
        <div className="feed-time">{event.time}</div>
      </div>
    </div>
  );
}
