import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiGet } from '../lib/api';

const PushContext = createContext(null);

/**
 * Converts a Uint8Array to a URL-safe base64 string.
 * This is needed because the PushSubscription endpoint and keys
 * must be serialized to JSON for the server.
 */
function uint8ToBase64Url(arr) {
  const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function PushProvider({ children }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default'); // 'default' | 'granted' | 'denied' | 'prompt'
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState(null);

  const subscribe = useCallback(async () => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      // Wait for SW to be ready
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const vapidRes = await fetch('/api/push/vapid-public-key');
      if (!vapidRes.ok) return;
      const { publicKey } = await vapidRes.json();
      if (!publicKey) return;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      // Extract keys from subscription
      const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
      const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

      // Send subscription to server
      const token = localStorage.getItem('rightway_token');
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: rawKey ? uint8ToBase64Url(rawKey) : subscription.keys?.p256dh || '',
            auth: rawAuth ? uint8ToBase64Url(rawAuth) : subscription.keys?.auth || '',
          },
        }),
      });

      if (res.ok) {
        setSubscribed(true);
        setError(null);
      }
    } catch (err) {
      console.warn('[push] Subscription failed:', err.message);
      setError(err.message);
    }
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    if (currentPermission === 'granted') {
      await subscribe();
      return;
    }

    if (currentPermission === 'denied') {
      return; // Don't prompt again if permanently denied
    }

    // 'default' — prompt the user
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribe();
      }
    } catch (err) {
      console.warn('[push] Permission request failed:', err.message);
    }
  }, [subscribe]);

  // Auto-request permission when user logs in
  useEffect(() => {
    if (user) {
      // Small delay so the UI renders before permission dialog
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, requestPermission]);

  // Listen for SW messages (notification clicks)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
        // SW tells us to navigate — handled by the SW opening the window
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  const value = {
    permission,
    subscribed,
    error,
    requestPermission,
    subscribe,
  };

  return (
    <PushContext.Provider value={value}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used within PushProvider');
  return ctx;
}
