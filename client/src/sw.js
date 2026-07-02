// Custom service worker for Right Way PWA
// Workbox precache manifest & runtime are injected by vite-plugin-pwa at build time.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// ─── Lifecycle ────────────────────────────────────────────────────────────
clientsClaim();
self.skipWaiting();
cleanupOutdatedCaches();

// ─── Navigation: ALWAYS network-first for HTML ──────────────────────────
// MUST be registered BEFORE precacheAndRoute so it takes precedence over
// any precached index.html. NetworkFirst ensures users always get the latest
// HTML, falling back to cached copy only when offline.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3,
    })
  )
);

// ─── Workbox Precaching ───────────────────────────────────────────────────
// self.__WB_MANIFEST is replaced by vite-plugin-pwa with the precache manifest.
// Registered AFTER NavigationRoute so navigation requests bypass stale HTML.
precacheAndRoute(self.__WB_MANIFEST);

// Google Fonts — cache aggressively (they rarely change)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-static-cache',
  })
);

// ─── Push Notification Handler ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback: treat as plain text
    payload = { title: 'Right Way', body: event.data.text() };
  }

  const { title, body, icon, badge, image, data, tag, vibrate, silent, requireInteraction } = payload;

  const options = {
    body: body || '',
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/pwa-192x192.png',
    image: image || undefined,
    data: data || {},
    tag: tag || 'rightway',
    vibrate: vibrate || [200, 100, 200],
    silent: silent === true,
    requireInteraction: requireInteraction === true,
    // Android channels: 'default' uses device notification sound
    // Setting silent:false + no explicit sound file = system default sound
    actions: data?.url
      ? [{ action: 'open', title: 'Voir' }]
      : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification Click Handler ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Push Subscription Change ─────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  // Browser changed the subscription (e.g., key rotation).
  // The frontend should detect this and re-subscribe.
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.registration.pushManager
        ? undefined // will be set by frontend on re-subscription
        : undefined,
    }).catch(() => {
      // Subscription failed — frontend will retry
    })
  );
});
