const admin = require('firebase-admin');
const deviceTokenModel = require('../models/deviceToken');

// Initialize Firebase Admin from the FIREBASE_SERVICE_ACCOUNT env var,
// which holds the full service-account JSON (as a string). Set it on Railway.
let ready = false;

function init() {
  if (ready) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT missing — native push disabled');
    return false;
  }
  try {
    const creds = JSON.parse(raw);
    // Railway/env often escape the private key newlines — restore them.
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    ready = true;
    console.log('[fcm] Firebase Admin initialized');
    return true;
  } catch (err) {
    // Already initialized elsewhere → treat as ready.
    if (err.code === 'app/duplicate-app') { ready = true; return true; }
    console.error('[fcm] init failed:', err.message);
    return false;
  }
}

init();

/**
 * Send a native (FCM) notification to all of a user's devices.
 * Silent no-op if FCM isn't configured or the user has no device tokens.
 */
async function sendToUser(user_id, { title, body, url, tag }) {
  if (!ready) return;

  const tokens = await deviceTokenModel.findByUser(user_id);
  if (tokens.length === 0) return;

  const message = {
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: { url: url || '/', tag: tag || 'rightway' },
    android: {
      priority: 'high',
      notification: {
        channelId: 'rightway_default',
        sound: 'default',
        color: '#E10600',
        icon: 'ic_stat_notify',
        defaultVibrateTimings: true,
      },
    },
  };

  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    // Prune tokens that FCM reports as permanently invalid.
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument')
        ) {
          deviceTokenModel.remove(tokens[i].token).catch(() => {});
        }
      }
    });
  } catch (err) {
    console.error('[fcm] send error:', err.message);
  }
}

module.exports = { sendToUser, init, isReady: () => ready };
