import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// Native (Android/FCM) push. No-op in the browser — there the PWA web-push
// path in PushContext handles notifications instead.

let started = false;

async function registerToken(value) {
  try {
    const jwt = localStorage.getItem('rightway_token');
    if (!jwt) return;
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
  if (!Capacitor.isNativePlatform() || started) return;
  started = true;

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

    await PushNotifications.removeAllListeners();

    // FCM device token arrives here (and again whenever it rotates).
    PushNotifications.addListener('registration', (token) => {
      registerToken(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[native-push] registration error:', err?.error);
    });

    // User tapped the notification → open the relevant screen.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action?.notification?.data?.url;
      if (url && url !== '/') {
        window.location.assign(url);
      }
    });

    await PushNotifications.register();
    console.log('[native-push] registered');
  } catch (err) {
    console.warn('[native-push] init failed:', err?.message);
    started = false; // allow a retry on next login
  }
}
