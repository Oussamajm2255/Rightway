import { useEffect, useRef, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

const TRACK_INTERVAL_MS = 60_000; // 60 seconds — battery-friendly
const MIN_DISTANCE_M = 50;        // only send if moved 50m+

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
  const intervalRef = useRef(null);
  const currentPos = useRef(null);
  const trackingEnabled = useRef(false);
  const apiGetRef = useRef(apiGet);
  const apiPutRef = useRef(apiPut);
  apiGetRef.current = apiGet;
  apiPutRef.current = apiPut;

  const checkTrackingEnabled = useCallback(async () => {
    try {
      const data = await apiGetRef.current('/users/me/tracking');
      return data.location_tracking_enabled === true;
    } catch {
      return trackingEnabled.current; // keep current state on error
    }
  }, []);

  const sendLocation = useCallback(async () => {
    // Re-verify tracking is still enabled before each send
    const enabled = await checkTrackingEnabled();
    trackingEnabled.current = enabled;
    if (!enabled) return;

    const pos = currentPos.current;
    if (!pos) return;

    const { latitude, longitude } = pos;

    // Skip if within MIN_DISTANCE_M of last-sent position
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
  }, [checkTrackingEnabled]);

  useEffect(() => {
    if (role !== 'COMMERCIAL') {
      cleanup();
      return;
    }

    let cancelled = false;

    async function start() {
      // First check if tracking is enabled by user preference
      const enabled = await checkTrackingEnabled();
      trackingEnabled.current = enabled;
      if (cancelled || !enabled) return; // don't request GPS if tracking is off

      try {
        // Request permission (Android shows system dialog on first call)
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') return;
        }

        // Start watching with moderate accuracy
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
          (position, err) => {
            if (cancelled) return;
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

        // Initial send after first position fix
        setTimeout(() => {
          if (!cancelled) sendLocation();
        }, 3000);

        // Periodic upload with preference re-check
        intervalRef.current = setInterval(() => {
          if (!cancelled) sendLocation();
        }, TRACK_INTERVAL_MS);

      } catch {
        // Capacitor not available (browser) — silent
      }
    }

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [role, checkTrackingEnabled, sendLocation]);

  function cleanup() {
    if (watchId.current) {
      Geolocation.clearWatch({ id: watchId.current }).catch(() => {});
      watchId.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
}
