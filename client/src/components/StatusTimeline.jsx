import { useRef, useEffect } from 'react';
import './StatusTimeline.css';

/* ── Step Icons (inline SVG, 20×20) ── */

function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}

function IconCheckBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

function IconXCirlce() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

const STEP_ICONS = {
  created: IconClipboard,
  confirmed: IconCheckBadge,
  en_cours: IconTruck,
  retour: IconRefresh,
  cloture: IconLock,
};

/* ── Helpers ── */

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function deriveSteps(livraison) {
  const isAnnule = livraison?.status === 'ANNULE';
  const isCloture = livraison?.status === 'CLOTURE';
  const isEnRetour = livraison?.status === 'EN_RETOUR';
  const isEnCours = livraison?.status === 'EN_COURS';
  const isEnAttenteAnnulation = livraison?.status === 'EN_ATTENTE_ANNULATION';

  const enCoursOrLater = isEnCours || isEnRetour || isEnAttenteAnnulation || isAnnule || isCloture;
  const retourOrLater = isEnRetour || isCloture || (isAnnule && !!livraison.end_declared_at);
  const clotureOrCancelled = isAnnule || isCloture;

  const raw = [
    { id: 'created',  label: 'Créé',       date: livraison.created_at,                        done: true },
    { id: 'confirmed',label: 'Confirmé',   date: livraison.confirmed_by_commercial_at,         done: !!livraison.confirmed_by_commercial_at },
    { id: 'en_cours', label: 'En cours',   date: null,                                         done: enCoursOrLater },
    { id: 'retour',   label: 'Retour',     date: livraison.end_declared_at,                    done: retourOrLater },
    { id: 'cloture',  label: isAnnule ? 'Annulé' : 'Clôturé', date: isAnnule ? null : livraison.closed_at, done: clotureOrCancelled },
  ];

  // First non-done step is active; if all done, none are active
  const activeIdx = raw.findIndex(s => !s.done);

  return raw.map((s, i) => {
    let state;
    if (isAnnule && s.id === 'cloture') {
      state = 'cancelled';
    } else if (s.done && (activeIdx === -1 || i < activeIdx)) {
      state = 'completed';
    } else if (i === activeIdx) {
      state = 'active';
    } else {
      state = 'pending';
    }
    return { ...s, state };
  });
}

/* ═══════════════════════════════════════════
   StatusTimeline
   ═══════════════════════════════════════════ */

export default function StatusTimeline({ livraison }) {
  const mounted = useRef(false);

  useEffect(() => {
    // Small delay so the CSS picks up the initial render for entrance animations
    const t = setTimeout(() => { mounted.current = true; }, 50);
    return () => clearTimeout(t);
  }, []);

  if (!livraison) return null;

  const steps = deriveSteps(livraison);
  const animClass = mounted.current ? 'st-animated' : '';

  return (
    <div className={`status-timeline ${animClass}`}>
      {/* Mobile: left progress rail */}
      <div className="st-rail" aria-hidden="true">
        {steps.map((s, i) => (
          <div key={s.id} className={`st-rail-segment ${i < steps.length - 1 ? '' : 'st-rail-segment--last'}`}>
            <span className={`st-dot st-dot--${s.state}`} />
            {i < steps.length - 1 && (
              <span className={`st-rail-line ${s.state === 'completed' ? 'st-rail-line--done' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div className="st-cards">
        {steps.map((s, i) => {
          const Icon = s.id === 'cloture' && s.state === 'cancelled'
            ? IconXCirlce
            : STEP_ICONS[s.id] || STEP_ICONS.created;

          return (
            <div key={s.id} className={`st-card st-card--${s.state}`} style={{ animationDelay: `${i * 0.1}s` }}>
              {/* Desktop connector line between cards */}
              {i < steps.length - 1 && (
                <span
                  className={`st-connector ${s.state === 'completed' ? 'st-connector--done' : ''}`}
                  style={{ animationDelay: `${(i + 1) * 0.1 + 0.15}s` }}
                />
              )}

              <div className="st-card-inner">
                <span className={`st-icon st-icon--${s.state}`}>
                  <Icon />
                </span>
                <span className="st-body">
                  <span className="st-label">{s.label}</span>
                  {s.date ? (
                    <span className="st-date">{formatDate(s.date)}</span>
                  ) : s.state === 'active' ? (
                    <span className="st-date st-date--active">Actif</span>
                  ) : s.state === 'pending' ? (
                    <span className="st-date st-date--pending">En attente</span>
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
