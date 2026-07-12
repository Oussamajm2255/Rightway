import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './styles/index.css';

// On Capacitor native (APK), safe-area-inset-* may return 0 if the Android
// theme doesn't enable edge-to-edge.  Force a 24 dp minimum so the topbar
// and bottom-nav never overlap the system status/navigation bars.
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('capacitor-native');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
