import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiGet } from '../lib/api';
import 'leaflet/dist/leaflet.css';
import './CommercialsMap.css';

// Fix Leaflet default marker icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// A commercial who hasn't reported for this long is flagged "hors ligne"
// (GPS turned off, permission revoked, or app closed).
const STALE_MS = 30 * 60 * 1000; // 30 minutes

// ── Clustering ──
// Group markers whose coordinates round to the same grid cell (~100 m).
const CLUSTER_PRECISION = 3; // decimal places: ~111 m at equator, ~100 m in Tunisia

function gridKey(lat, lng) {
  return `${lat.toFixed(CLUSTER_PRECISION)}|${lng.toFixed(CLUSTER_PRECISION)}`;
}

/** Group locations into clusters. Returns [ { key, members: [...], center: [lat,lng] }, ... ] */
function clusterLocations(locations) {
  const map = new Map();
  for (const loc of locations) {
    const key = gridKey(loc.latitude, loc.longitude);
    if (!map.has(key)) {
      map.set(key, { key, members: [], center: [loc.latitude, loc.longitude] });
    }
    map.get(key).members.push(loc);
  }
  return Array.from(map.values());
}

function isStale(isoStr) {
  if (!isoStr) return false;
  return Date.now() - new Date(isoStr).getTime() > STALE_MS;
}

function relativeLabel(isoStr) {
  if (!isoStr) return '';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createMarkerIcon(fullName, city) {
  return L.divIcon({
    className: 'commercial-marker',
    html: `
      <div class="marker-wrap">
        <div class="marker-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div class="marker-label-box">
          <span class="marker-name">${esc(fullName)}</span>
          <span class="marker-city">${esc(city)}</span>
        </div>
      </div>
    `,
    iconSize: [160, 62],
    iconAnchor: [80, 62],
    popupAnchor: [0, -34],
  });
}

/** Cluster icon — red circle with count badge */
function createClusterIcon(count) {
  const size = count <= 9 ? 40 : count <= 99 ? 48 : 56;
  const fontSize = count <= 9 ? 15 : count <= 99 ? 13 : 11;
  return L.divIcon({
    className: 'cluster-marker',
    html: `
      <div class="cluster-wrap">
        <div class="cluster-badge" style="width:${size}px;height:${size}px;font-size:${fontSize}px">
          ${count}
        </div>
      </div>
    `,
    iconSize: [size + 20, size + 30],
    iconAnchor: [(size + 20) / 2, (size + 30) / 2],
    popupAnchor: [0, -(size + 30) / 2 + 5],
  });
}

// ── Auto-fit component ──
// Watches clusters and fits the map bounds to only show relevant area.
function FitBoundsControl({ clusters }) {
  const map = useMap();

  useEffect(() => {
    if (!clusters || clusters.length === 0) return;

    if (clusters.length === 1) {
      // Single location → center on it with a tight zoom
      const [lat, lng] = clusters[0].center;
      map.setView([lat, lng], 14, { animate: true, duration: 0.6 });
      return;
    }

    // Multiple locations → fit the bounding box with padding
    const bounds = clusters.reduce((b, c) => b.extend(c.center), L.latLngBounds([]));
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
      animate: true,
      duration: 0.6,
    });
  }, [clusters, map]);

  return null;
}

export default function CommercialsMap() {
  const [locations, setLocations] = useState([]);
  const [lastFetch, setLastFetch] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState('');

  const fetchLocations = useCallback(async () => {
    try {
      const data = await apiGet('/commercials/locations');
      setLocations(data.locations || []);
      setLastFetch(Date.now());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  // Tick "il y a Xs" counter
  useEffect(() => {
    if (!lastFetch) return;
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetch) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastFetch]);

  // Split three ways:
  //  - live:    reporting a fresh position → shown on the map
  //  - offline: had a position but went silent > 30 min → GPS disabled / app closed
  //  - pending: never sent a position yet
  const withGps = locations.filter((l) => l.has_location && !isStale(l.updated_at));
  const offline = locations.filter((l) => l.has_location && isStale(l.updated_at));
  const pending = locations.filter((l) => !l.has_location);

  // Cluster live markers by proximity
  const clusters = useMemo(() => clusterLocations(withGps), [withGps]);

  // Cache marker icons so we don't recreate them on every render
  const markerIcons = {};
  function getIcon(name, city) {
    const key = `${name}||${city || ''}`;
    if (!markerIcons[key]) {
      markerIcons[key] = createMarkerIcon(name, city);
    }
    return markerIcons[key];
  }

  // Cache cluster icons by count
  const clusterIcons = {};
  function getClusterIcon(count) {
    if (!clusterIcons[count]) {
      clusterIcons[count] = createClusterIcon(count);
    }
    return clusterIcons[count];
  }

  const hasAny = locations.length > 0;
  const mapLabel = withGps.length === 0 && pending.length > 0
    ? `${pending.length} commercial${pending.length > 1 ? 'aux' : ''} en attente de position`
    : withGps.length === 0
      ? 'Aucun commercial localisé'
      : null;

  return (
    <div className="commercials-map-card">
      {/* ─── Header ─── */}
      <div className="cm-header">
        <div className="cm-header-left">
          <span className="cm-live-dot" />
          <h2>Suivi en direct</h2>
          <span className="cm-live-text">Live</span>
          {offline.length > 0 && (
            <span className="cm-offline-count">
              ⚠ {offline.length} hors ligne
            </span>
          )}
        </div>
        <span className="cm-refresh">
          {lastFetch
            ? `actualisé il y a ${secondsAgo}s`
            : 'chargement…'}
        </span>
      </div>

      {/* ─── Map ─── */}
      <div className="cm-map-wrap">
        {error ? (
          <div className="cm-empty-state">
            <span className="cm-empty">Impossible de charger les positions</span>
          </div>
        ) : withGps.length === 0 ? (
          <div className="cm-empty-state">
            <span className="cm-empty">{mapLabel}</span>
          </div>
        ) : (
          <MapContainer
            center={[34.5, 9.5]}
            zoom={7}
            minZoom={5}
            maxZoom={16}
            maxBounds={[[29.0, 6.0], [38.5, 13.0]]}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FitBoundsControl clusters={clusters} />
            {clusters.map((cluster) => {
              if (cluster.members.length === 1) {
                const loc = cluster.members[0];
                return (
                  <Marker
                    key={loc.user_id}
                    position={cluster.center}
                    icon={getIcon(loc.full_name, loc.location_name)}
                  >
                    <Popup>
                      <div className="cm-popup">
                        <div className="cm-popup-name">{loc.full_name}</div>
                        <div className="cm-popup-loc">{loc.location_name}</div>
                        <div className="cm-popup-time">
                          {relativeLabel(loc.updated_at)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              }
              // Cluster of 2+ commercials at same location
              return (
                <Marker
                  key={cluster.key}
                  position={cluster.center}
                  icon={getClusterIcon(cluster.members.length)}
                >
                  <Popup>
                    <div className="cm-popup">
                      <div className="cm-popup-name" style={{ marginBottom: 6 }}>
                        {cluster.members.length} commerciaux
                      </div>
                      {cluster.members.map((m) => (
                        <div key={m.user_id} className="cm-popup-loc" style={{ marginBottom: 2 }}>
                          {m.full_name} · {m.location_name || 'Position'}
                        </div>
                      ))}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* ─── Offline: had a position but GPS went silent > 30 min ─── */}
      {offline.length > 0 && (
        <div className="cm-pending cm-offline">
          <div className="cm-pending-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 5A9 9 0 0121 12M2 8.82a15 15 0 014.17-2.65" />
              <path d="M10.66 5c4.28.61 8.34 3.28 10.34 8" />
              <line x1="1" y1="1" x2="23" y2="23" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span>Hors ligne — GPS désactivé ({offline.length})</span>
          </div>
          <div className="cm-pending-list">
            {offline.map((loc) => (
              <div key={loc.user_id} className="cm-pending-item cm-offline-item">
                <span className="cm-pending-name">{loc.full_name}</span>
                <span className="cm-offline-badge">
                  Dernière position {relativeLabel(loc.updated_at)}
                  {loc.location_name ? ` · ${loc.location_name}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pending: opted-in but no GPS data yet ─── */}
      {pending.length > 0 && (
        <div className="cm-pending">
          <div className="cm-pending-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>En attente de position ({pending.length})</span>
          </div>
          <div className="cm-pending-list">
            {pending.map((loc) => (
              <div key={loc.user_id} className="cm-pending-item">
                <span className="cm-pending-name">{loc.full_name}</span>
                <span className="cm-pending-badge">Signal GPS attendu</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
