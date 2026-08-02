import { useState, useRef, useCallback, useEffect } from 'react';
import './PullToRefresh.css';

/**
 * Pull-to-refresh wrapper for Capacitor Android.
 *
 * Wraps scrollable content and shows a branded refresh indicator when the
 * user pulls down from the top of the page.  Uses native touch events and
 * the compositor-friendly `overscroll-behavior: contain` strategy.
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [state, setState] = useState('idle'); // idle | pulling | ready | refreshing | done
  const [pullDist, setPullDist] = useState(0);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchId = useRef(null);
  const refreshing = useRef(false);

  const reset = useCallback(() => {
    setState('idle');
    setPullDist(0);
    refreshing.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e) => {
      if (refreshing.current) return;
      // Only intercept pulls when the page is scrolled to the very top.
      if (window.scrollY > 2) return;
      // Only track the first finger.
      if (touchId.current !== null) return;
      touchId.current = e.changedTouches[0].identifier;
      touchStartY.current = e.touches[0].clientY;
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (refreshing.current || touchId.current === null) return;
      let touch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchId.current) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;

      const delta = touch.clientY - touchStartY.current;
      if (delta <= 0) {
        setPullDist(0);
        setState('idle');
        return;
      }

      // Dampen the pull distance for a physical feel.
      const dist = Math.min(delta * 0.45, 80);
      setPullDist(dist);
      setState(dist > 56 ? 'ready' : 'pulling');
    },
    [],
  );

  const handleTouchEnd = useCallback(
    async (e) => {
      // Only act if our tracked finger ended.
      let found = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId.current) {
          found = true;
          break;
        }
      }
      touchId.current = null;
      if (!found) return;

      if (state === 'ready' && !refreshing.current) {
        refreshing.current = true;
        setState('refreshing');
        setPullDist(56); // hold indicator at a visible height during refresh

        try {
          await onRefresh?.();
        } catch {
          // Silently ignore refresh errors.
        }

        setState('done');
        setTimeout(reset, 700);
      } else {
        reset();
      }
    },
    [state, onRefresh, reset],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div className="ptr-container" ref={containerRef}>
      <div
        className={`ptr-indicator ptr-${state}`}
        style={{ height: pullDist > 0 ? pullDist : undefined }}
      >
        <div className="ptr-spinner">
          {(state === 'refreshing' || state === 'done') ? (
            <svg className="ptr-swoosh" width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="30 60"
              >
                {state === 'refreshing' && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 12 12;360 12 12"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </svg>
          ) : (
            <svg
              className={`ptr-arrow${state === 'ready' ? ' ptr-arrow--flip' : ''}`}
              width="20" height="20"
              viewBox="0 0 24 24" fill="none"
            >
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span className="ptr-label">
          {state === 'pulling' && 'Tirez pour actualiser'}
          {state === 'ready' && 'Relâchez pour actualiser'}
          {state === 'refreshing' && 'Actualisation\u2026'}
          {state === 'done' && 'Actualisé\u00A0!'}
        </span>
      </div>
      {children}
    </div>
  );
}
