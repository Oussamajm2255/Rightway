import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiGet } from '../lib/api';
import { formatDateTime, formatDate } from '../lib/utils';
import './DistributionPage.css';

/* ═══════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════ */
const STATUS_LABELS = {
  EN_ATTENTE_COMMERCIAL: 'En attente',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  EN_RETOUR: 'En retour',
  EN_ATTENTE_ANNULATION: 'Annulation dem.',
  ANNULE: 'Annulé',
  CLOTURE: 'Clôturé',
};

const STATUS_ACCENT = {
  EN_ATTENTE_COMMERCIAL: 'pending',
  CONFIRME: 'info',
  EN_COURS: 'active',
  EN_RETOUR: 'warning',
  EN_ATTENTE_ANNULATION: 'warning',
  ANNULE: 'warning',
  CLOTURE: 'closed',
};

const AVATAR_PALETTE = ['#047857', '#0B3B2E', '#14543F', '#10B981', '#556059', '#93A099', '#2a78d6', '#7c3aed'];

const PAGE_SIZE = 50;

/* ═══════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════ */
function getAvatar(name) {
  const str = (name || '?').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  const bg = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  const words = str.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : (words[0]?.[0] || '?').toUpperCase();
  return { bg, initials };
}

function getSellThroughColor(pct) {
  if (pct >= 80) return '#0f9e6a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function formatNum(v) {
  return Number(v || 0);
}

/* ═══════════════════════════════════════════════
   SVG Icon components
═══════════════════════════════════════════════ */
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v8l-8 4-8-4V6l8-4z" /><path d="M12 22V12" /><path d="M4 6l8 6 8-6" />
    </svg>
  );
}

function IconSales() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTimeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M2 7h20M6 3v4M18 3v4M6 11h3M6 14h5" />
    </svg>
  );
}

function IconLog() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconEmpty() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6l9-4 9 4-9 4-9-4z" /><path d="M3 6v10l9 4M21 6v10l-9 4" /><path d="M12 10v10" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const accent = STATUS_ACCENT[status] || 'closed';
  return (
    <span className={`dist-badge badge-status-${accent}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* ─── Skeleton for list item ─── */
function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="dist-skeleton-item">
          <div className="dist-skel-row">
            <div className="dist-skel" style={{ width: 90, height: 13, borderRadius: 4 }} />
            <div className="dist-skel" style={{ width: 60, height: 13, borderRadius: 4, marginLeft: 'auto' }} />
          </div>
          <div className="dist-skel-row">
            <div className="dist-skel" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
            <div className="dist-skel" style={{ width: 120, height: 12, borderRadius: 4 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8 }}>
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="dist-skel" style={{ height: 38, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ─── Single list item ─── */
function ListItem({ livraison, selected, onClick }) {
  const avatar = getAvatar(livraison.commercial_name);
  const accent = STATUS_ACCENT[livraison.status] || 'closed';
  const charged = formatNum(livraison.total_qte_chargee);
  const sold = formatNum(livraison.total_qte_vendue);
  const remaining = charged - sold;
  const pct = charged > 0 ? Math.round((sold / charged) * 100) : 0;
  const color = getSellThroughColor(pct);

  return (
    <div
      className={`dist-list-item accent-${accent}${selected ? ' selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="dist-item-top">
        <span className="dist-item-ref">{livraison.reference}</span>
        <StatusBadge status={livraison.status} />
      </div>

      <div className="dist-item-commercial">
        <div className="dist-avatar" style={{ background: avatar.bg }}>{avatar.initials}</div>
        <div>
          <div className="dist-item-name">{livraison.commercial_name}</div>
          <div className="dist-item-meta">{formatDate(livraison.created_at)}</div>
        </div>
      </div>

      <div className="dist-item-stats">
        <div className="dist-item-stat">
          <span className="dist-item-stat-label">Chargé</span>
          <span className="dist-item-stat-value">{charged}</span>
        </div>
        <div className="dist-item-stat">
          <span className="dist-item-stat-label">Vendu</span>
          <span className="dist-item-stat-value sold">{sold}</span>
        </div>
        <div className="dist-item-stat">
          <span className="dist-item-stat-label">Restant</span>
          <span className="dist-item-stat-value rem">{remaining}</span>
        </div>
        <div className="dist-item-stat">
          <span className="dist-item-stat-label">Décl.</span>
          <span className="dist-item-stat-value decl">{formatNum(livraison.sales_log_count)}</span>
        </div>
      </div>

      <div className="dist-item-progress">
        <div className="dist-progress-track">
          <div
            className="dist-progress-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <span className="dist-progress-pct" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

/* ─── Detail loading skeleton ─── */
function DetailSkeleton() {
  return (
    <div className="dist-detail-skel">
      <div className="dist-detail-skel-header" />
      <div className="dist-detail-skel-kpi" />
      <div className="dist-detail-skel-section" />
      <div className="dist-detail-skel-section" style={{ height: 160 }} />
    </div>
  );
}

/* ─── Build chronological timeline from dossier data ─── */
function buildTimeline(livraison, salesLog) {
  const events = [];

  if (livraison.created_at) {
    events.push({
      type: 'created',
      date: livraison.created_at,
      label: 'Livraison créée',
      detail: `Par ${livraison.admin_name || '—'}`,
    });
  }

  if (livraison.confirmed_by_commercial_at) {
    events.push({
      type: 'confirmed',
      date: livraison.confirmed_by_commercial_at,
      label: 'Bon de sortie confirmé',
      detail: `${livraison.commercial_name} a confirmé — stock déduit`,
    });
  }

  if (livraison.returned_to_creation_at) {
    events.push({
      type: 'retour',
      date: livraison.returned_to_creation_at,
      label: 'Retour à la création',
      detail: livraison.return_reason || 'Retour demandé',
    });
  }

  // Insert each sales-log entry
  for (const entry of salesLog || []) {
    events.push({
      type: 'sale',
      date: entry.logged_at,
      label: 'Déclaration de vente',
      product_name: entry.product_name,
      delta: entry.delta,
    });
  }

  if (livraison.end_declared_at) {
    events.push({
      type: 'ended',
      date: livraison.end_declared_at,
      label: 'Fin de tournée déclarée',
      detail: `${livraison.commercial_name} a déclaré la fin`,
    });
  }

  if (livraison.retour_confirmed_by_admin_at || livraison.retour_confirmed_by_commercial_at) {
    const bothDone = livraison.retour_confirmed_by_admin_at && livraison.retour_confirmed_by_commercial_at;
    const confirmDate =
      livraison.retour_confirmed_by_admin_at || livraison.retour_confirmed_by_commercial_at;
    events.push({
      type: 'retour',
      date: confirmDate,
      label: 'Bon de retour confirmé',
      detail: bothDone
        ? 'Les deux parties ont confirmé'
        : 'En attente de l\'autre confirmation',
    });
  }

  if (livraison.annulation_requested_at) {
    events.push({
      type: 'cancelled',
      date: livraison.annulation_requested_at,
      label: 'Annulation demandée',
      detail: `Par ${livraison.commercial_name}`,
    });
  }

  if (livraison.closed_at) {
    const isCancelled = livraison.status === 'ANNULE';
    events.push({
      type: isCancelled ? 'cancelled' : 'closed',
      date: livraison.closed_at,
      label: isCancelled ? 'Livraison annulée' : 'Livraison clôturée',
      detail: isCancelled ? 'Stock restauré' : 'Stock retourné au dépôt',
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

/* ─── Timeline icon by type ─── */
function TimelineDot({ type }) {
  const icons = {
    created: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    confirmed: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    sale: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      </svg>
    ),
    ended: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    closed: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    cancelled: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    retour: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      </svg>
    ),
  };
  return (
    <div className={`dist-tl-dot ${type}`}>
      {icons[type] || icons.created}
    </div>
  );
}

/* ─── Detail panel full view ─── */
function DetailPanel({ dossier, onBack }) {
  const { livraison, sales_log, financials } = dossier;
  const items = livraison.items || [];
  const avatar = getAvatar(livraison.commercial_name);

  const totalCharged = items.reduce((s, i) => s + Number(i.qte_chargee || 0), 0);
  const totalSold    = items.reduce((s, i) => s + Number(i.qte_vendue  || 0), 0);
  const totalRem     = totalCharged - totalSold;
  const pct = totalCharged > 0 ? Math.round((totalSold / totalCharged) * 100) : 0;
  const sellColor = getSellThroughColor(pct);

  const timeline = useMemo(() => buildTimeline(livraison, sales_log), [livraison, sales_log]);

  return (
    <div className="dist-fade-in">
      {/* ── Mobile back navigation bar ── */}
      <div className="dist-mobile-back-bar">
        <button type="button" className="dist-mobile-back-btn" onClick={onBack}>
          <IconChevronLeft />
          <span>Retour aux livraisons</span>
        </button>
      </div>

      {/* ── Header ── */}
      <div className="dist-detail-header">
        <div className="dist-detail-header-top">
          <div>
            <div className="dist-detail-ref">{livraison.reference}</div>
            <div className="dist-detail-created">Créé le {formatDateTime(livraison.created_at)}</div>
          </div>
          <StatusBadge status={livraison.status} />
        </div>

        <div className="dist-detail-header-commercial">
          <div className="dist-detail-avatar" style={{ background: avatar.bg }}>
            {avatar.initials}
          </div>
          <div>
            <div className="dist-detail-comm-name">{livraison.commercial_name}</div>
            <div className="dist-detail-comm-vehicle">
              {livraison.vehicle_name}
              {livraison.vehicle_plate && ` · ${livraison.vehicle_plate}`}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="dist-kpi-grid">
        <div className="dist-kpi-cell">
          <div className="dist-kpi-cell-label">Chargé</div>
          <div className="dist-kpi-cell-value">{totalCharged}</div>
        </div>
        <div className="dist-kpi-cell">
          <div className="dist-kpi-cell-label">Vendu</div>
          <div className="dist-kpi-cell-value green">{totalSold}</div>
        </div>
        <div className="dist-kpi-cell">
          <div className="dist-kpi-cell-label">Restant</div>
          <div className="dist-kpi-cell-value orange">{totalRem}</div>
        </div>
        <div className="dist-kpi-cell">
          <div className="dist-kpi-cell-label">CA Total</div>
          <div className="dist-kpi-cell-value blue">
            {Number(financials?.ca_total || 0).toFixed(3)} DT
          </div>
        </div>
        <div className="dist-kpi-cell">
          <div className="dist-kpi-cell-label">Déclarations</div>
          <div className="dist-kpi-cell-value purple">{(sales_log || []).length}</div>
        </div>
      </div>

      {/* ── Sell-through bar ── */}
      <div className="dist-sell-through-banner">
        <span className="dist-sell-through-label">Taux de vente</span>
        <div className="dist-sell-through-track">
          <div
            className="dist-sell-through-fill"
            style={{ width: `${pct}%`, background: sellColor }}
          />
        </div>
        <span className="dist-sell-through-pct" style={{ color: sellColor }}>{pct}%</span>
      </div>

      <div className="dist-detail-sections">
        {/* ── Products breakdown ── */}
        <div className="dist-section">
          <div className="dist-section-header">
            <div className="dist-section-icon green"><IconBox /></div>
            <span className="dist-section-title">Produits distribués</span>
            <span className="dist-section-count">{items.length} produit{items.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Desktop Table View */}
          <div className="dist-products-table-wrap">
            <table className="dist-products-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="right">Chargé</th>
                  <th className="right">Vendu</th>
                  <th className="right">Restant</th>
                  <th className="right">CA</th>
                  <th className="right">%</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const charged = Number(item.qte_chargee || 0);
                  const sold    = Number(item.qte_vendue  || 0);
                  const rem     = charged - sold;
                  const pct     = charged > 0 ? Math.round((sold / charged) * 100) : 0;
                  const ca      = (sold * Number(item.prix_ttc || 0)).toFixed(3);
                  const barColor = getSellThroughColor(pct);
                  return (
                    <tr key={item.id || item.product_id}>
                      <td>
                        <div className="dist-prod-name">{item.product_name}</div>
                        {item.category && <div className="dist-prod-cat">{item.category}</div>}
                        <div className="dist-prod-bar">
                          <div className="dist-prod-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </td>
                      <td className="td-right td-mono">{charged}</td>
                      <td className="td-right td-mono td-green">{sold}</td>
                      <td className={`td-right td-mono ${rem > 0 ? 'td-orange' : 'td-muted'}`}>{rem}</td>
                      <td className="td-right td-mono td-blue">{ca} DT</td>
                      <td className="td-right td-mono" style={{ color: barColor }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="dist-mobile-prod-cards">
            {items.map((item) => {
              const charged = Number(item.qte_chargee || 0);
              const sold    = Number(item.qte_vendue  || 0);
              const rem     = charged - sold;
              const pct     = charged > 0 ? Math.round((sold / charged) * 100) : 0;
              const ca      = (sold * Number(item.prix_ttc || 0)).toFixed(3);
              const barColor = getSellThroughColor(pct);
              return (
                <div key={item.id || item.product_id} className="dist-mp-card">
                  <div className="dist-mp-top">
                    <div>
                      <div className="dist-mp-name">{item.product_name}</div>
                      {item.category && <div className="dist-mp-cat">{item.category}</div>}
                    </div>
                    <span className="dist-mp-pct-badge" style={{ color: barColor, background: `${barColor}15` }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="dist-mp-bar">
                    <div className="dist-mp-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <div className="dist-mp-stats">
                    <div className="dist-mp-stat">
                      <span className="lbl">Chargé</span>
                      <span className="val">{charged}</span>
                    </div>
                    <div className="dist-mp-stat">
                      <span className="lbl">Vendu</span>
                      <span className="val green">{sold}</span>
                    </div>
                    <div className="dist-mp-stat">
                      <span className="lbl">Restant</span>
                      <span className="val orange">{rem}</span>
                    </div>
                    <div className="dist-mp-stat">
                      <span className="lbl">CA</span>
                      <span className="val blue">{ca} DT</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="dist-section">
          <div className="dist-section-header">
            <div className="dist-section-icon blue"><IconTimeline /></div>
            <span className="dist-section-title">Chronologie</span>
            <span className="dist-section-count">{timeline.length} événement{timeline.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="dist-timeline">
            {timeline.map((ev, idx) => (
              <div key={idx} className="dist-timeline-item">
                <div className="dist-tl-dot-wrap">
                  <TimelineDot type={ev.type} />
                </div>
                <div className="dist-tl-content">
                  <div className="dist-tl-event">{ev.label}</div>
                  {ev.type === 'sale' ? (
                    <div className="dist-tl-detail">
                      <span className={`${ev.delta >= 0 ? 'tl-delta-pos' : 'tl-delta-neg'}`}>
                        {formatDelta(ev.delta)} unité{Math.abs(ev.delta) !== 1 ? 's' : ''}
                      </span>
                      {' — '}
                      <span className="tl-product">{ev.product_name}</span>
                    </div>
                  ) : (
                    ev.detail && <div className="dist-tl-detail">{ev.detail}</div>
                  )}
                  <div className="dist-tl-time">{formatDateTime(ev.date)}</div>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <div className="dist-list-empty" style={{ padding: '24px' }}>
                <p>Aucun événement enregistré.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Sales declarations log ── */}
        {(sales_log || []).length > 0 && (
          <div className="dist-section">
            <div className="dist-section-header">
              <div className="dist-section-icon purple"><IconLog /></div>
              <span className="dist-section-title">Journal des déclarations</span>
              <span className="dist-section-count">{sales_log.length} entrée{sales_log.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Desktop Table */}
            <div className="dist-log-table-wrap">
              <table className="dist-log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produit</th>
                    <th>Delta</th>
                    <th>Horodatage</th>
                  </tr>
                </thead>
                <tbody>
                  {sales_log.map((entry, idx) => (
                    <tr key={entry.id}>
                      <td className="dist-log-seq">#{idx + 1}</td>
                      <td className="dist-log-product">{entry.product_name}</td>
                      <td>
                        <span className={entry.delta >= 0 ? 'dist-log-delta-pos' : 'dist-log-delta-neg'}>
                          {formatDelta(entry.delta)}
                        </span>
                      </td>
                      <td className="dist-log-time">{formatDateTime(entry.logged_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards / List */}
            <div className="dist-mobile-log-list">
              {sales_log.map((entry, idx) => (
                <div key={entry.id} className="dist-ml-item">
                  <div className="dist-ml-top">
                    <span className="dist-ml-seq">#{idx + 1}</span>
                    <span className="dist-ml-product">{entry.product_name}</span>
                    <span className={entry.delta >= 0 ? 'dist-log-delta-pos' : 'dist-log-delta-neg'}>
                      {formatDelta(entry.delta)}
                    </span>
                  </div>
                  <div className="dist-ml-time">{formatDateTime(entry.logged_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main page component
═══════════════════════════════════════════════ */
function DistributionPage() {
  // ── Filter state ──
  const [reference, setReference]   = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');

  // ── List state ──
  const [livraisons, setLivraisons]     = useState([]);
  const [commercials, setCommercials]   = useState([]);
  const [total, setTotal]               = useState(0);
  const [pages, setPages]               = useState(1);
  const [page, setPage]                 = useState(1);
  const [listLoading, setListLoading]   = useState(true);
  const [listError, setListError]       = useState('');

  // ── Detail state ──
  const [selectedId, setSelectedId]     = useState(null);
  const [dossier, setDossier]           = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]   = useState('');

  // ── Debounce reference search ──
  const referenceDebounceRef = useRef(null);
  const [debouncedRef, setDebouncedRef] = useState('');

  useEffect(() => {
    clearTimeout(referenceDebounceRef.current);
    referenceDebounceRef.current = setTimeout(() => {
      setDebouncedRef(reference);
      setPage(1);
    }, 300);
    return () => clearTimeout(referenceDebounceRef.current);
  }, [reference]);

  // ── Counts for chips (derived from current result set) ──
  const counts = useMemo(() => {
    const c = { ALL: total };
    for (const l of livraisons) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [livraisons, total]);

  // ── Fetch list ──
  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams();
      if (debouncedRef)   params.set('reference',    debouncedRef);
      if (commercialId)   params.set('commercial_id', commercialId);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (dateFrom)       params.set('date_from',    dateFrom);
      if (dateTo)         params.set('date_to',      dateTo + 'T23:59:59');
      params.set('page',  String(page));
      params.set('limit', String(PAGE_SIZE));

      const data = await apiGet(`/livraisons/distribution?${params.toString()}`);
      setLivraisons(data.livraisons || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      if (data.commercials && data.commercials.length > 0) {
        setCommercials(data.commercials);
      }
    } catch (err) {
      setListError(err.message || 'Erreur de chargement');
    } finally {
      setListLoading(false);
    }
  }, [debouncedRef, commercialId, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Reset to page 1 when filters change (except page itself)
  useEffect(() => { setPage(1); }, [debouncedRef, commercialId, statusFilter, dateFrom, dateTo]);

  // ── Fetch detail (dossier) ──
  const fetchDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError('');
    setDossier(null);
    try {
      const data = await apiGet(`/livraisons/${id}/dossier`);
      setDossier(data.dossier);
    } catch (err) {
      setDetailError(err.message || 'Erreur de chargement');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleSelectLivraison(id) {
    setSelectedId(id);
    fetchDetail(id);
  }

  function clearFilters() {
    setReference('');
    setCommercialId('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const hasFilters = reference || commercialId || statusFilter !== 'ALL' || dateFrom || dateTo;

  return (
    <div className="dist-page">
      {/* ── Masthead ── */}
      <div className="dist-masthead">
        <div className="dist-masthead-left">
          <h1>Distribution</h1>
          <p>Historique complet des livraisons et déclarations commerciales</p>
        </div>
        <div className="dist-masthead-badge">
          <div className="dist-masthead-badge-dot" />
          <span className="dist-masthead-badge-text">Temps réel</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="dist-filters">
        {/* Reference search */}
        <div className="dist-search-wrap">
          <span className="dist-search-icon"><IconSearch /></span>
          <input
            id="dist-ref-search"
            className="dist-search-input"
            type="text"
            placeholder="Référence (ex: LIV-20260915-001)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        {/* Commercial selector */}
        <select
          id="dist-commercial-select"
          className="dist-select"
          style={{ flex: '1 1 180px', minWidth: 140 }}
          value={commercialId}
          onChange={(e) => { setCommercialId(e.target.value); setPage(1); }}
        >
          <option value="">Tous les commerciaux</option>
          {commercials.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>

        {/* Date range */}
        <div className="dist-filter-group" style={{ flex: '0 0 auto', gap: 6 }}>
          <span className="dist-filter-label">Du</span>
          <input
            id="dist-date-from"
            type="date"
            className="dist-date-input"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <span className="dist-filter-label">au</span>
          <input
            id="dist-date-to"
            type="date"
            className="dist-date-input"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>

        {hasFilters && (
          <button className="dist-filter-clear" onClick={clearFilters}>
            Effacer filtres
          </button>
        )}
      </div>

      {/* ── Status chips ── */}
      <div className="dist-chip-row">
        <button
          id="dist-chip-all"
          type="button"
          className={`dist-chip${statusFilter === 'ALL' ? ' active' : ''}`}
          onClick={() => { setStatusFilter('ALL'); setPage(1); }}
        >
          Tous <span className="dist-chip-count">{total}</span>
        </button>
        {Object.entries(STATUS_LABELS).map(([value, label]) => {
          const cnt = livraisons.filter((l) => l.status === value).length;
          return (
            <button
              id={`dist-chip-${value.toLowerCase()}`}
              key={value}
              type="button"
              className={`dist-chip${statusFilter === value ? ' active' : ''}`}
              onClick={() => { setStatusFilter(value); setPage(1); }}
            >
              {label} <span className="dist-chip-count">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* ── Split body ── */}
      <div className={`dist-body${selectedId ? ' has-selected' : ''}`}>
        {/* ── Left: list panel ── */}
        <div className="dist-list-panel">
          {listError && (
            <div className="dist-error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {listError}
            </div>
          )}

          {listLoading ? (
            <ListSkeleton />
          ) : livraisons.length === 0 ? (
            <div className="dist-list-empty">
              <IconEmpty />
              <p>
                {hasFilters
                  ? 'Aucune livraison correspondant à ces filtres.'
                  : 'Aucune livraison trouvée.'}
              </p>
            </div>
          ) : (
            livraisons.map((l) => (
              <ListItem
                key={l.id}
                livraison={l}
                selected={selectedId === l.id}
                onClick={() => handleSelectLivraison(l.id)}
              />
            ))
          )}

          {/* Pagination */}
          {!listLoading && pages > 1 && (
            <div className="dist-pagination">
              <button
                className="dist-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Page précédente"
              >
                <IconChevronLeft />
              </button>
              <span className="dist-page-info">
                {page} / {pages} &nbsp;·&nbsp; {total} résultat{total !== 1 ? 's' : ''}
              </span>
              <button
                className="dist-page-btn"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                aria-label="Page suivante"
              >
                <IconChevronRight />
              </button>
            </div>
          )}

          {!listLoading && pages <= 1 && total > 0 && (
            <div className="dist-pagination">
              <span className="dist-page-info">{total} résultat{total !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* ── Right: detail panel ── */}
        <div className="dist-detail-panel">
          {!selectedId ? (
            <div className="dist-detail-empty">
              <div className="dist-detail-empty-icon">
                <IconTruck />
              </div>
              <h3>Sélectionner une livraison</h3>
              <p>
                Cliquez sur une livraison dans la liste pour afficher l'historique complet
                de sa distribution et les déclarations commerciales.
              </p>
            </div>
          ) : detailLoading ? (
            <DetailSkeleton />
          ) : detailError ? (
            <div className="dist-error-banner" style={{ margin: 24 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {detailError}
            </div>
          ) : dossier ? (
            <DetailPanel dossier={dossier} onBack={() => setSelectedId(null)} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DistributionPage;
