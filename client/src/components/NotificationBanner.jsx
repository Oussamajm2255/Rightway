import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationBanner.css';

/**
 * In-app heads-up banner for push notifications that arrive while the app is
 * open (Android hides the system tray banner in the foreground). Slides down
 * from the top, auto-dismisses, and is tappable to open the target screen.
 * Driven by the 'rightway:notification' window event (see lib/nativePush.js).
 */
export default function NotificationBanner() {
  const [item, setItem] = useState(null); // { title, body, url }
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef(null);
  const removeTimer = useRef(null);
  const navigate = useNavigate();

  const dismiss = useCallback(() => {
    setLeaving(true);
    clearTimeout(removeTimer.current);
    removeTimer.current = setTimeout(() => {
      setItem(null);
      setLeaving(false);
    }, 260);
  }, []);

  useEffect(() => {
    const onNotif = (e) => {
      const detail = e.detail || {};
      setLeaving(false);
      setItem({
        title: detail.title || 'Right Way',
        body: detail.body || '',
        url: detail.url || '/',
      });
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => dismiss(), 5000);
    };
    window.addEventListener('rightway:notification', onNotif);
    return () => {
      window.removeEventListener('rightway:notification', onNotif);
      clearTimeout(hideTimer.current);
      clearTimeout(removeTimer.current);
    };
  }, [dismiss]);

  if (!item) return null;

  function handleClick() {
    const url = item.url;
    dismiss();
    if (typeof url === 'string' && url.startsWith('/') && url !== '/') {
      navigate(url);
    }
  }

  return (
    <div className={`notif-banner ${leaving ? 'notif-banner-leaving' : ''}`} role="alert">
      <button className="notif-banner-inner" onClick={handleClick}>
        <span className="notif-banner-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </span>
        <span className="notif-banner-text">
          <span className="notif-banner-title">{item.title}</span>
          {item.body && <span className="notif-banner-body">{item.body}</span>}
        </span>
      </button>
      <button className="notif-banner-close" onClick={dismiss} aria-label="Fermer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
