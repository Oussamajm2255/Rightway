const webpush = require('web-push');
const pushSubscriptionModel = require('../models/pushSubscription');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@rightway.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[push] VAPID configured');
} else {
  console.warn('[push] VAPID keys missing — push notifications disabled');
}

/**
 * Send a push notification to a specific user.
 * Falls back silently if push fails (notification is still in DB).
 */
async function sendToUser(user_id, { title, body, url, tag }) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[push] VAPID not configured, skipping push');
    return;
  }

  const subs = await pushSubscriptionModel.findByUser(user_id);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: url || '/' },
    tag: tag || 'rightway',
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: false,
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );

  // Clean up stale subscriptions
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      const body = r.reason?.body || '';
      const statusCode = r.reason?.statusCode;
      // 410 Gone or 404 → subscription no longer valid
      if (statusCode === 410 || statusCode === 404 || body.includes('unsubscribed')) {
        await pushSubscriptionModel.remove(user_id, subs[i].endpoint).catch(() => {});
      }
    }
  }
}

module.exports = { sendToUser, vapidPublicKey };
