import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import { useCategoryPalette } from '../context/CategoryPaletteContext';
import './SalesPage.css';

/* ─── Inline SVG Icons ─── */
const IconCarton = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
    <path d="M2 6l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M2 6v8l8 4M18 6v8l-8 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 10v8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 8l4-2 4 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const IconEmpty = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);

/* ─── Constants ─── */
const OFFLINE_QUEUE_KEY = 'rightway_offline_queue';
const AUTO_SAVE_INTERVAL = 30000;

/* ─── Formatters ─── */
function fmtDT(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toFixed(3) + ' DT';
}
function fmtShort(v) {
  if (v === null || v === undefined || v === 0) return '0';
  const n = Number(v);
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

/* ─── Component ─── */
function SalesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getColor } = useCategoryPalette();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [caTotal, setCaTotal] = useState(0);
  const [pendingChanges, setPendingChanges] = useState({});
  const [search, setSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState({});
  const [changedQtys, setChangedQtys] = useState({});  // animation tracking
  const [validating, setValidating] = useState(new Set());  // products currently being saved
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(null);
  const catRefs = useRef({});  // scroll targets

  /* ─── Online / Offline ─── */
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

  /* ─── Fetch ─── */
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

  /* ─── Auto-save interval ─── */
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (Object.keys(pendingChanges).length > 0) savePendingChanges();
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(saveTimerRef.current);
  }, [pendingChanges]);

  /* ─── Pending qty helper ─── */
  function getPendingQty(productId) {
    return pendingChanges[productId] !== undefined
      ? pendingChanges[productId]
      : items.find((i) => i.product_id === productId)?.qte_vendue || 0;
  }

  /* ─── Qty change ─── */
  function handleQtyChange(productId, delta) {
    setPendingChanges((prev) => {
      const item = items.find((i) => i.product_id === productId);
      if (!item) return prev;
      const current = prev[productId] !== undefined ? prev[productId] : item.qte_vendue;
      const next = Math.max(0, Math.min(item.qte_chargee, current + delta));
      if (next === current) return prev;

      // Trigger pop animation
      setChangedQtys((c) => ({ ...c, [productId]: Date.now() }));

      return { ...prev, [productId]: next };
    });
  }

  /* ─── Validate single sale ─── */
  function handleValider(productId) {
    const qty = pendingChanges[productId];
    const item = items.find((i) => i.product_id === productId);
    if (!item || qty === undefined) return;
    if (validating.has(productId)) return;  // already saving

    if (isOnline) {
      setValidating((prev) => new Set(prev).add(productId));  // lock card
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
    } finally {
      setValidating((prev) => { const next = new Set(prev); next.delete(productId); return next; });
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

  /* ─── Grouping + Filtering ─── */
  function getFilteredItems() {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) => p.product_name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
    );
  }

  function groupByCategory(products) {
    const groups = {};
    for (const p of products) {
      const cat = p.category || 'Sans catégorie';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return Object.entries(groups);
  }

  function scrollToCategory(cat) {
    const el = catRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleCategory(cat) {
    setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleTerminer() {
    navigate(`/livraisons/${id}?action=terminer`);
  }

  /* ─── Sync status ─── */
  const syncClass = !isOnline ? 'offline' : syncing ? 'syncing' : 'online';
  const syncLabel = !isOnline ? 'Hors-ligne' : syncing ? 'Synchro...' : 'En ligne';

  /* ─── Progress bar colour ─── */
  function progressColor(ratio) {
    if (ratio >= 0.8) return 'var(--color-danger)';
    if (ratio >= 0.5) return 'var(--color-accent)';
    return 'var(--color-success)';
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="sales-page">
        <div className="sales-topbar">
          <div className="sales-topbar-inner">
            <div className="sales-ca-block">
              <span className="sales-ca-label">CA du jour</span>
              <span className="sales-ca-value">—</span>
            </div>
          </div>
        </div>
        <div className="sales-content">
          <div className="sales-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton skeleton-card" style={{ height: '180px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && items.length === 0) return <div className="page-container"><div className="error-banner">{error}</div></div>;

  /* ─── Data ─── */
  const filtered = getFilteredItems();
  const grouped = groupByCategory(filtered);
  const allCategories = groupByCategory(items).map(([cat]) => cat);

  return (
    <div className="sales-page">
      {/* ─── Top Bar ─── */}
      <div className="sales-topbar">
        <div className="sales-topbar-inner">
          <div className="sales-ca-block">
            <span className="sales-ca-label">CA du jour</span>
            <span className="sales-ca-value">{fmtDT(caTotal)}</span>
          </div>

          <div className={`sales-sync ${syncClass}`}>
            <span className="sales-sync-dot" />
            {syncLabel}
            {isOnline && lastSavedRef.current && ' · ' + lastSavedRef.current.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>

          <div className="sales-search-wrap">
            <span className="sales-search-icon"><IconSearch /></span>
            <input
              className="sales-search"
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div className="sales-content">
          <div className="error-banner">{error}</div>
        </div>
      )}

      {/* ─── Product Cards (displayed first for quick access) ─── */}
      <div className="sales-content">
        {grouped.length === 0 ? (
          <div className="sales-empty">
            <IconEmpty />
            <p>Aucun produit trouvé pour « {search} »</p>
          </div>
        ) : (
          grouped.map(([category, catItems]) => {
            const { bg: catBg, text: catText } = getColor(category);
            const isCollapsed = collapsedCats[category];

            // Per-category summary stats (units, not products)
            const catDeclared = catItems.reduce((sum, p) => sum + getPendingQty(p.product_id), 0);
            const catTotalStock = catItems.reduce((sum, p) => sum + p.qte_chargee, 0);
            const catCA = catItems.reduce((sum, p) => sum + getPendingQty(p.product_id) * Number(p.prix_ttc), 0);
            const catMax = catItems.reduce((sum, p) => sum + p.qte_chargee * Number(p.prix_ttc), 0);

            return (
              <div
                key={category}
                className="sales-cat-section"
                ref={(el) => { catRefs.current[category] = el; }}
              >
                <div
                  className="sales-cat-header"
                  style={{ borderLeftColor: catText, background: catBg }}
                  onClick={() => toggleCategory(category)}
                >
                  <span className="sales-cat-header-icon" style={{ color: catText }}>
                    <IconCarton />
                  </span>
                  <span className="sales-cat-header-name" style={{ color: catText }}>
                    {category}
                  </span>
                  <span className="sales-cat-header-stats">
                    <span className="cat-stat">{catDeclared}/{catTotalStock}</span>
                    <span className="cat-stat-sep">·</span>
                    <span className="cat-stat">{fmtShort(catCA)} DT / {fmtShort(catMax)} DT</span>
                  </span>
                  <span className="sales-cat-header-count">
                    {catItems.length} produit{catItems.length > 1 ? 's' : ''}
                  </span>
                  <span className={`sales-cat-chevron ${isCollapsed ? '' : 'open'}`}>
                    <IconChevron />
                  </span>
                </div>

                {!isCollapsed && (
                  <div className="sales-cards-grid">
                    {catItems.map((item) => {
                      const sold = getPendingQty(item.product_id);
                      const remaining = item.qte_chargee - sold;
                      const ratio = item.qte_chargee > 0 ? sold / item.qte_chargee : 0;
                      const soldValue = sold * Number(item.prix_ttc);
                      const hasPending = pendingChanges[item.product_id] !== undefined;
                      const { bar: catBar } = getColor(category);
                      const qtyChanged = changedQtys[item.product_id];
                      const isSaving = validating.has(item.product_id);

                      return (
                        <div
                          key={item.product_id}
                          className={`sale-card ${hasPending ? 'pending' : ''} ${isSaving ? 'saving' : ''}`}
                          style={{
                            background: hasPending
                              ? `linear-gradient(135deg, var(--color-surface) 0%, rgba(184,134,11,.03) 100%)`
                              : `linear-gradient(135deg, var(--color-surface) 0%, ${catBar}0d 100%)`,
                          }}
                        >
                        {/* Header */}
                          <div className="sale-card-top">
                            <div>
                              <div className="sale-product-name">{item.product_name}</div>
                              <div className="sale-product-code">{item.barcode}</div>
                            </div>
                            <div className="sale-product-price">{fmtDT(item.prix_ttc)}</div>
                          </div>

                          {/* Progress bar */}
                          <div className="sale-progress-wrap">
                            <div className="sale-progress-bar">
                              <div
                                className="sale-progress-fill"
                                style={{
                                  width: `${Math.min(100, ratio * 100)}%`,
                                  backgroundColor: progressColor(ratio),
                                }}
                              />
                            </div>
                            <div className="sale-progress-labels">
                              <span>Vendu <strong>{sold}</strong></span>
                              <span>Restant <strong>{remaining}</strong></span>
                            </div>
                          </div>

                          {/* Stats */}
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
                              <span className="stat-value montant">{fmtDT(soldValue)}</span>
                            </div>
                          </div>

                          {/* Qty controls */}
                          <div className="sale-actions">
                            <button
                              className="qty-btn"
                              onClick={() => handleQtyChange(item.product_id, -1)}
                              disabled={sold <= 0 || isSaving}
                              aria-label="Diminuer"
                            >−</button>

                            <span
                              className={`sale-qty-display ${qtyChanged ? 'qty-changed' : ''}`}
                              key={qtyChanged || 'static'}
                            >{sold}</span>

                            <button
                              className="qty-btn"
                              onClick={() => handleQtyChange(item.product_id, 1)}
                              disabled={sold >= item.qte_chargee || isSaving}
                              aria-label="Augmenter"
                            >+</button>

                            {hasPending && (
                              <button
                                className="btn-valider"
                                onClick={() => handleValider(item.product_id)}
                                disabled={isSaving}
                              >
                                Valider
                              </button>
                            )}
                          </div>

                          {isSaving && (
                            <div className="sale-card-overlay">
                              <div className="sale-spinner" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Category Chips (filter bar below cards) ─── */}
      <div className="sales-chips sales-chips-bottom">
        <button
          className={`sales-chip ${!search ? 'active' : ''}`}
          style={!search ? { background: 'var(--color-primary)' } : {}}
          onClick={() => setSearch('')}
        >
          Tous
          <span className="sales-chip-count">{items.length}</span>
        </button>
        {allCategories.map((cat) => {
          const { bg, text } = getColor(cat);
          const count = items.filter((p) => (p.category || 'Sans catégorie') === cat).length;
          const isActive = search && grouped.some(([c]) => c === cat);
          return (
            <button
              key={cat}
              className={`sales-chip ${isActive ? 'active' : ''}`}
              style={isActive ? { background: text } : { background: bg, color: text, borderColor: 'transparent' }}
              onClick={() => { setSearch(cat); scrollToCategory(cat); }}
            >
              {cat}
              <span className="sales-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Terminer Button (always visible at bottom) ─── */}
      <div className="sales-terminer-wrap visible">
        <button className="btn-terminer" onClick={handleTerminer}>
          Terminer la livraison
        </button>
      </div>
    </div>
  );
}

export default SalesPage;
