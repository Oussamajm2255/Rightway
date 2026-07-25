import { useState, useEffect } from 'react';
import './StockHero.css';

/*
 * StockHero — live inventory valuation "hero": Dépôt + Chargé fused into a
 * donut ring with a running total (count-up). Shared by the Dashboard and the
 * Bénéfices pages so the two presentations never drift.
 *
 * Colours follow the brand: deep green (dépôt) + gold (chargé).
 */
const DEPOT_COLOR = '#0B3B2E';
const CHARGE_COLOR = '#F59E0B';
const HERO_RING_C = 2 * Math.PI * 62; // r = 62

const ICONS = {
  package: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  truck:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 17h16M6 17V6l4-4h8v15" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/></svg>,
  chevRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>,
  chevLeft:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>,
};

function hexAlpha(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

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

// Count-up animation hook (eased) — drives the value roll-in.
function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const to = Number(target);
    if (target === null || target === undefined || Number.isNaN(to)) { setVal(0); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export default function StockHero({ depot, charge, navigate, depotHref = '/stock', chargeHref = '/livraisons' }) {
  const d = Number(depot) || 0;
  const c = Number(charge) || 0;
  const total = d + c;
  const aTotal = useCountUp(total, 1300);
  const aDepot = useCountUp(d, 1100);
  const aCharge = useCountUp(c, 1100);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const depotFrac = total > 0 ? d / total : 0;
  const chargeFrac = total > 0 ? c / total : 0;
  const go = (href) => { if (typeof navigate === 'function') navigate(href); };

  return (
    <div className="stock-hero">
      <div className="stock-hero-accent" />

      <button type="button" className="stock-hero-side" onClick={() => go(depotHref)}>
        <span className="stock-hero-icon" style={{ background: hexAlpha(DEPOT_COLOR, 0.12), color: DEPOT_COLOR }}>{ICONS.package}</span>
        <span className="stock-hero-label">CA Stock Depot</span>
        <span className="stock-hero-val">{fmtDT(aDepot)}</span>
        <span className="stock-hero-sub"><span className="stock-hero-dot" style={{ background: DEPOT_COLOR }} />valeur au prix de vente</span>
      </button>

      <div className="stock-hero-link" aria-hidden="true">{ICONS.chevRight}</div>

      <div className="stock-hero-center">
        <div className="stock-hero-ring">
          <span className="stock-hero-glow" />
          <svg viewBox="0 0 150 150" className="stock-hero-svg">
            <circle cx="75" cy="75" r="62" className="ring-track" />
            <circle
              cx="75" cy="75" r="62" className="ring-arc"
              stroke={DEPOT_COLOR}
              strokeDasharray={HERO_RING_C}
              strokeDashoffset={drawn ? HERO_RING_C * (1 - depotFrac) : HERO_RING_C}
            />
            <circle
              cx="75" cy="75" r="62" className="ring-arc ring-arc-charge"
              stroke={CHARGE_COLOR}
              transform={`rotate(${360 * depotFrac} 75 75)`}
              strokeDasharray={HERO_RING_C}
              strokeDashoffset={drawn ? HERO_RING_C * (1 - chargeFrac) : HERO_RING_C}
            />
          </svg>
          <div className="stock-hero-ring-center">
            <span className="stock-hero-ring-label">Patrimoine</span>
            <span className="stock-hero-ring-val">{fmtDTShort(aTotal)}</span>
            <span className="stock-hero-ring-unit">total marchandise</span>
          </div>
        </div>
        <div className="stock-hero-legend">
          <span><span className="stock-hero-dot" style={{ background: DEPOT_COLOR }} />Dépôt <b>{Math.round(depotFrac * 100)}%</b></span>
          <span><span className="stock-hero-dot" style={{ background: CHARGE_COLOR }} />Chargé <b>{Math.round(chargeFrac * 100)}%</b></span>
        </div>
      </div>

      <div className="stock-hero-link" aria-hidden="true">{ICONS.chevLeft}</div>

      <button type="button" className="stock-hero-side right" onClick={() => go(chargeHref)}>
        <span className="stock-hero-icon" style={{ background: hexAlpha(CHARGE_COLOR, 0.12), color: CHARGE_COLOR }}>{ICONS.truck}</span>
        <span className="stock-hero-label">CA Stock Chargé</span>
        <span className="stock-hero-val">{fmtDT(aCharge)}</span>
        <span className="stock-hero-sub"><span className="stock-hero-dot" style={{ background: CHARGE_COLOR }} />marchandise en tournée</span>
      </button>
    </div>
  );
}
