import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// Native (Android/FCM) push. No-op in the browser — there the PWA web-push
// path in PushContext handles notifications instead.
//
// A device's FCM token is physical (one per phone). It must always belong to
// the user CURRENTLY logged in on that phone — otherwise the previous user's
// notifications keep landing on this device. So we re-send the token to the
// server on every login, and detach it on logout.

let listenersAdded = false;
let lastToken = null;

async function postToken(value) {
  try {
    const jwt = localStorage.getItem('rightway_token');
    if (!jwt || !value) return;
    await fetch('/api/push/device-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token: value, platform: 'android' }),
    });
  } catch (err) {
    console.warn('[native-push] token register failed:', err?.message);
  }
}

export async function initNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Ask for permission (Android 13+ shows the system prompt).
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[native-push] permission not granted');
      return;
    }

    // Add channel + listeners exactly once per app launch.
    if (!listenersAdded) {
      // High-importance channel → heads-up notifications with sound, like social apps.
      try {
        await PushNotifications.createChannel({
          id: 'rightway_default',
          name: 'Notifications Right Way',
          description: 'Alertes livraisons, ventes et activité',
          importance: 5, // MAX → pops as a heads-up banner
          visibility: 1,
          vibration: true,
          sound: 'default',
        });
      } catch (_) { /* channels unsupported on very old Android — ignore */ }

      // FCM device token arrives here (on first register + whenever it rotates).
      PushNotifications.addListener('registration', (token) => {
        lastToken = token.value;
        postToken(token.value); // bind this device to whoever is logged in NOW
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.warn('[native-push] registration error:', err?.error);
      });

      // Push arrived while the app is in the FOREGROUND — Android suppresses the
      // tray banner here, so refresh the in-app bell AND show our own heads-up
      // banner so the user still sees it, like a social app.
      PushNotifications.addListener('pushNotificationReceived', (notif) => {
        try {
          window.dispatchEvent(new Event('rightway:refresh-notifications'));
          window.dispatchEvent(new CustomEvent('rightway:notification', {
            detail: {
              title: notif?.title || 'Right Way',
              body: notif?.body || '',
              url: notif?.data?.url || '/',
            },
          }));
        } catch (_) {}
      });

      // User tapped the notification → open the relevant screen.
      // Only follow same-origin app paths ("/livraisons/…"), never an external URL.
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action?.notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/') && url !== '/') {
          window.location.assign(url);
        }
      });

      listenersAdded = true;
    }

    // Re-register on every login. register() re-fires the 'registration' event
    // with the (cached) token, re-binding this device to the current user.
    await PushNotifications.register();

    // If we already hold the token from a previous registration this session,
    // bind it immediately too (covers account switches without a token rotation).
    if (lastToken) postToken(lastToken);
  } catch (err) {
    console.warn('[native-push] init failed:', err?.message);
  }
}

// Detach this device's token from the user on logout, so the logged-out user
// stops receiving pushes here. Best-effort; must run BEFORE the JWT is cleared.
export async function unregisterNativePush() {
  if (!Capacitor.isNativePlatform() || !lastToken) return;
  try {
    const jwt = localStorage.getItem('rightway_token');
    if (!jwt) return;
    await fetch('/api/push/device-token', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token: lastToken }),
    });
  } catch (_) { /* best-effort */ }
}
