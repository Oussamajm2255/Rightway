import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import './SalesPage.css';

const OFFLINE_QUEUE_KEY = 'rightway_offline_queue';
const AUTO_SAVE_INTERVAL = 30000;

function formatDT(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(3) + ' DT';
}

function SalesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [caTotal, setCaTotal] = useState(0);
  const [pendingChanges, setPendingChanges] = useState({});
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); syncOfflineQueue(); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const data = await apiGet(`/livraisons/${id}/sales`);
      setItems(data.items);
      setCaTotal(data.ca_total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (Object.keys(pendingChanges).length > 0) {
        savePendingChanges();
      }
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(saveTimerRef.current);
  }, [pendingChanges]);

  function getPendingQty(productId) {
    return pendingChanges[productId] !== undefined
      ? pendingChanges[productId]
      : items.find((i) => i.product_id === productId)?.qte_vendue || 0;
  }

  function getRemaining(item) {
    const sold = getPendingQty(item.product_id);
    return item.qte_chargee - sold;
  }

  function getSoldValue(item) {
    return getPendingQty(item.product_id) * Number(item.prix_ttc);
  }

  function handleQtyChange(productId, delta) {
    setPendingChanges((prev) => {
      const item = items.find((i) => i.product_id === productId);
      if (!item) return prev;
      const current = prev[productId] !== undefined ? prev[productId] : item.qte_vendue;
      const next = Math.max(0, Math.min(item.qte_chargee, current + delta));
      if (next === current) return prev;
      return { ...prev, [productId]: next };
    });
  }

  function handleValider(productId) {
    const qty = pendingChanges[productId];
    const item = items.find((i) => i.product_id === productId);
    if (!item || qty === undefined) return;

    if (isOnline) {
      saveSingleSale(productId, qty);
    } else {
      addToOfflineQueue(productId, qty);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      updateLocalOptimistic(productId, qty);
    }
  }

  async function saveSingleSale(productId, qty) {
    try {
      const result = await apiPost(`/livraisons/${id}/sales`, { product_id: productId, qte_vendue: qty });
      setCaTotal(result.ca_total);
      setItems((prev) =>
        prev.map((i) => (i.product_id === productId ? { ...i, qte_vendue: result.qte_vendue } : i))
      );
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      lastSavedRef.current = new Date();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePendingChanges() {
    const entries = Object.entries(pendingChanges);
    if (entries.length === 0) return;
    for (const [productId, qty] of entries) {
      await saveSingleSale(productId, qty);
    }
  }

  function addToOfflineQueue(productId, qty) {
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      queue.push({ livraison_id: id, product_id: productId, qte_vendue: qty, timestamp: Date.now() });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch { /* ignore */ }
  }

  function updateLocalOptimistic(productId, qty) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, qte_vendue: qty } : i))
    );
    const newTotal = items.reduce((sum, i) => {
      const sold = i.product_id === productId ? qty : i.qte_vendue;
      return sum + sold * Number(i.prix_ttc);
    }, 0);
    setCaTotal(Number(newTotal.toFixed(3)));
  }

  async function syncOfflineQueue() {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return;
    setSyncing(true);
    try {
      const sales = queue
        .filter((q) => q.livraison_id === id)
        .map((q) => ({ product_id: q.product_id, qte_vendue: q.qte_vendue }));
      if (sales.length > 0) {
        await apiPost(`/livraisons/${id}/sales/sync`, { sales });
      }
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      await fetchSales();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  function handleTerminer() {
    navigate(`/livraisons/${id}?action=terminer`);
  }

  if (loading) {
    return (
      <div className="sales-page">
        <div className="ca-header">
          <span className="ca-label">CA du jour</span>
          <span className="ca-value">—</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton skeleton-card" style={{ marginBottom: 'var(--space-3)', height: '160px' }} />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) return <div className="page-container"><div className="error-banner">{error}</div></div>;

  return (
    <div className="sales-page">
      {!isOnline && (
        <div className="offline-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
          Mode hors-ligne — vos données sont sauvegardées localement
        </div>
      )}
      {isOnline && syncing && (
        <div className="syncing-banner">Synchronisation en cours...</div>
      )}
      {isOnline && !syncing && lastSavedRef.current && (
        <div className="online-banner">
          Synchronisé — {lastSavedRef.current.toLocaleTimeString('fr-FR')}
        </div>
      )}

      <div className="ca-header">
        <span className="ca-label">CA du jour</span>
        <span className="ca-value">{formatDT(caTotal)}</span>
      </div>

      {error && <div className="error-banner" style={{ marginTop: 'var(--space-2)' }}>{error}</div>}

      <div className="sales-cards">
        {items.map((item) => {
          const sold = getPendingQty(item.product_id);
          const remaining = item.qte_chargee - sold;
          const soldValue = sold * Number(item.prix_ttc);
          const hasPending = pendingChanges[item.product_id] !== undefined;

          return (
            <div key={item.product_id} className={`sale-card ${hasPending ? 'pending' : ''}`}>
              <div className="sale-card-header">
                <div className="sale-product-name">{item.product_name}</div>
                <div className="sale-product-code">{item.barcode} · {formatDT(item.prix_ttc)}</div>
              </div>

              <div className="sale-stats">
                <div className="sale-stat">
                  <span className="stat-label">Chargé</span>
                  <span className="stat-value">{item.qte_chargee}</span>
                </div>
                <div className="sale-stat">
                  <span className="stat-label">Vendu</span>
                  <span className="stat-value">{sold}</span>
                </div>
                <div className="sale-stat">
                  <span className="stat-label">Restant</span>
                  <span className={`stat-value ${remaining <= 0 ? 'zero' : ''}`}>{remaining}</span>
                </div>
                <div className="sale-stat">
                  <span className="stat-label">Montant</span>
                  <span className="stat-value montant">{formatDT(soldValue)}</span>
                </div>
              </div>

              <div className="sale-actions">
                <button
                  className="qty-btn large"
                  onClick={() => handleQtyChange(item.product_id, -1)}
                  disabled={sold <= 0}
                  aria-label="Diminuer la quantité"
                >−</button>

                <div className="sale-qty-display">{sold}</div>

                <button
                  className="qty-btn large"
                  onClick={() => handleQtyChange(item.product_id, 1)}
                  disabled={sold >= item.qte_chargee}
                  aria-label="Augmenter la quantité"
                >+</button>

                {hasPending && (
                  <button
                    className="btn-valider"
                    onClick={() => handleValider(item.product_id)}
                  >
                    Valider
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="terminer-section">
        <button className="btn-terminer" onClick={handleTerminer}>
          Terminer la livraison
        </button>
      </div>
    </div>
  );
}

export default SalesPage;
