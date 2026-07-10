import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const POLL_INTERVAL_MS = 15_000;  // 15s — check tracking preference
const UPLOAD_INTERVAL_MS = 60_000; // 60s — send location to server
const MIN_DISTANCE_M = 50;         // only send if moved 50m+

const isCapacitor = typeof window !== 'undefined' && Capacitor.isNativePlatform();

/**
 * Reverse-geocode lat/lng → human-readable location name
 * Uses Nominatim (OpenStreetMap) — free, no API key, Tunisia coverage
 */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=fr`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RightWayApp/1.0' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.error) return null;

    const addr = data.address || {};
    // Prefer city-level locality; fall back to town/village/county
    const parts = [
      addr.city || addr.town || addr.village || addr.municipality || addr.county,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.state,
    ].filter(Boolean);

    // Deduplicate consecutive duplicates (e.g. "Tunis, Tunis")
    const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
    return deduped.join(' — ') || addr.country || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return null;
  }
}

/**
 * Hook: track commercial's GPS location in the background.
 * Only activates when role === 'COMMERCIAL' AND tracking is opted-in.
 *
 * Behaviour:
 * - Fetches tracking preference from server on mount
 * - Only requests Android location permission if tracking is enabled
 * - Watches position continuously (low-power mode)
 * - Every TRACK_INTERVAL_MS: re-verifies tracking preference, reverse-geocode & PUT
 * - Skips duplicate positions (< MIN_DISTANCE_M change)
 * - Stops immediately if user disables tracking in settings
 * - Cleans up on unmount / role change
 */
export default function useLocationTracker({ role, apiGet, apiPut }) {
  const lastSent = useRef(null);
  const watchId = useRef(null);
  const uploadTimer = useRef(null);
  const pollTimer = useRef(null);
  const currentPos = useRef(null);
  const gpsActive = useRef(false);
  const apiGetRef = useRef(apiGet);
  const apiPutRef = useRef(apiPut);
  const cancelledRef = useRef(false);
  apiGetRef.current = apiGet;
  apiPutRef.current = apiPut;

  const checkTrackingEnabled = useCallback(async () => {
    try {
      const data = await apiGetRef.current('/users/me/tracking');
      return data.location_tracking_enabled === true;
    } catch {
      return gpsActive.current; // keep current state on error
    }
  }, []);

  const startGps = useCallback(async () => {
    if (gpsActive.current || cancelledRef.current) return;

    let started = false;

    // ── Path 1: Capacitor Geolocation plugin ──
    if (isCapacitor && Geolocation) {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            console.warn('[GPS] Capacitor location permission denied');
            // fall through to browser fallback
          }
        }

        if (perm.location === 'granted' || (await Geolocation.checkPermissions()).location === 'granted') {
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
            (position, err) => {
              if (cancelledRef.current) return;
              if (err) return;
              if (position?.coords) {
                currentPos.current = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                };
              }
            }
          );
          watchId.current = id;
          started = true;
          console.log('[GPS] Capacitor Geolocation active');
        }
      } catch (e) {
        console.warn('[GPS] Capacitor Geolocation plugin error, trying browser fallback:', e.message);
      }
    }

    // ── Path 2: Browser geolocation (fallback for desktop, or Android WebView without plugin) ──
    if (!started && navigator.geolocation) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelledRef.current) return;
            currentPos.current = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
          },
          (err) => {
            console.warn('[GPS] Browser geolocation error:', err?.message || err);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
        watchId.current = id;
        started = true;
        console.log('[GPS] Browser geolocation active');
      } catch (e) {
        console.warn('[GPS] Browser geolocation failed:', e.message);
      }
    }

    if (!started) {
      console.warn('[GPS] No location source available — will retry on next poll');
      return;
    }

    // Only mark GPS as active if a watch was successfully established
    if (watchId.current == null) return;

    gpsActive.current = true;

    // Send immediately after first fix
    setTimeout(() => {
      if (!cancelledRef.current) uploadLocation();
    }, 5000);

    // Periodic upload
    uploadTimer.current = setInterval(() => {
      if (!cancelledRef.current) uploadLocation();
    }, UPLOAD_INTERVAL_MS);
  }, [/* capture nothing — all deps are refs */]);

  const stopGps = useCallback(() => {
    gpsActive.current = false;

    if (watchId.current != null) {
      if (isCapacitor && Geolocation) {
        Geolocation.clearWatch({ id: watchId.current }).catch(() => {});
      } else if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      watchId.current = null;
    }

    if (uploadTimer.current) {
      clearInterval(uploadTimer.current);
      uploadTimer.current = null;
    }

    currentPos.current = null;
  }, []);

  const uploadLocation = useCallback(async () => {
    // Re-verify tracking preference before sending
    const enabled = await checkTrackingEnabled();
    if (!enabled) {
      stopGps();
      return;
    }

    const pos = currentPos.current;
    if (!pos) return;

    const { latitude, longitude } = pos;

    if (lastSent.current) {
      const dLat = latitude - lastSent.current.lat;
      const dLng = longitude - lastSent.current.lng;
      const distM = Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
      if (distM < MIN_DISTANCE_M) return;
    }

    const locationName = await reverseGeocode(latitude, longitude);
    if (!locationName) return;

    try {
      await apiPutRef.current('/commercials/location', {
        latitude,
        longitude,
        location_name: locationName,
      });
      lastSent.current = { lat: latitude, lng: longitude };
    } catch {
      // silent — retry next interval
    }
  }, [checkTrackingEnabled, stopGps]);

  // ── Polling loop: checks tracking preference & manages GPS state ──
  useEffect(() => {
    if (role !== 'COMMERCIAL') {
      cancelledRef.current = true;
      stopGps();
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    cancelledRef.current = false;

    async function poll() {
      if (cancelledRef.current) return;
      const enabled = await checkTrackingEnabled();
      if (cancelledRef.current) return;

      if (enabled && !gpsActive.current) {
        startGps();
      } else if (!enabled && gpsActive.current) {
        stopGps();
      }
    }

    // Check immediately and then every POLL_INTERVAL_MS
    poll();
    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      stopGps();
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [role, checkTrackingEnabled, startGps, stopGps]);
}
