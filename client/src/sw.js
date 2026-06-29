// Custom service worker for Right Way PWA
// Workbox precache manifest & runtime are injected by vite-plugin-pwa at build time.

// ─── Workbox Precaching ───────────────────────────────────────────────────
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Take control of all pages immediately (autoUpdate)
clientsClaim();
self.skipWaiting();

// Clean up old precache entries on new SW activation
cleanupOutdatedCaches();

// self.__WB_MANIFEST is replaced by vite-plugin-pwa with the precache manifest
precacheAndRoute(self.__WB_MANIFEST);

// ─── Runtime Caching ──────────────────────────────────────────────────────
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

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
