import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

function relativeLabel(isoStr) {
  if (!isoStr) return '';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

function createMarkerIcon(fullName, city) {
  const escapedName = fullName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const escapedCity = (city || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
          <span class="marker-name">${escapedName}</span>
          <span class="marker-city">${escapedCity}</span>
        </div>
      </div>
    `,
    iconSize: [160, 62],
    iconAnchor: [80, 62],
    popupAnchor: [0, -34],
  });
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

  // Build marker icons (cached per location)
  const markerIcons = {};
  function getIcon(name, city) {
    const key = `${name}||${city || ''}`;
    if (!markerIcons[key]) {
      markerIcons[key] = createMarkerIcon(name, city);
    }
    return markerIcons[key];
  }

  return (
    <div className="commercials-map-card">
      {/* ─── Header ─── */}
      <div className="cm-header">
        <div className="cm-header-left">
          <span className="cm-live-dot" />
          <h2>Suivi en direct</h2>
          <span className="cm-live-text">Live</span>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span className="cm-empty">Impossible de charger les positions</span>
          </div>
        ) : locations.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span className="cm-empty">Aucun commercial localisé</span>
          </div>
        ) : (
          <MapContainer
            center={[34.5, 9.5]}
            zoom={7}
            minZoom={6}
            maxZoom={13}
            maxBounds={[[29.5, 6.5], [38.0, 12.5]]}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {locations.map((loc) => (
              <Marker
                key={loc.user_id}
                position={[loc.latitude, loc.longitude]}
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
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
