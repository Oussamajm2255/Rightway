import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './styles/index.css';

// ─── Safe-area recalculation (rotation / resize) ───
// Capacitor WebView may cache env(safe-area-inset-*) across orientation
// changes.  We read the live values via a sentinel element and push them
// as CSS custom properties on <html> — inline style beats :root rules.
//
// The capacitor-native body class is a CSS-only hook so that critical
// elements (bottom-nav) can use max(env(…), 24px) directly in CSS — no
// JS dependency for the safety floor.
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('capacitor-native');
}

function applySafeInsets() {
  const s = document.createElement('div');
  s.style.cssText =
    'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
  document.body.appendChild(s);
  const cs = getComputedStyle(s);
  document.body.removeChild(s);

  let top = parseInt(cs.top, 10) || 0;
  let bottom = parseInt(cs.bottom, 10) || 0;

  if (Capacitor.isNativePlatform()) {
    top = Math.max(top, 24);
    bottom = Math.max(bottom, 24);
  }

  document.documentElement.style.setProperty('--safe-top', top + 'px');
  document.documentElement.style.setProperty('--safe-bottom', bottom + 'px');
}

// Run once before React mounts for APK
applySafeInsets();

// Keep insets in sync when the viewport changes
window.addEventListener('resize', applySafeInsets);
window.addEventListener('orientationchange', () => setTimeout(applySafeInsets, 180));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
