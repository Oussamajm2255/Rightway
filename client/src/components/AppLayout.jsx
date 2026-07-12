import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../lib/api';
import useLocationTracker from '../lib/useLocationTracker';
import NotificationBanner from './NotificationBanner';
import './AppLayout.css';

/* ===== SVG Icon Components ===== */
function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 17c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13c1.5 0 2.935.553 4 1.458V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconProducts() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6l7-3.5L17 6l-7 3.5L3 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 6v7l7 3.5M17 6v7l-7 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 9.5V16.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconStock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h14v14H3z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8v9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 14l2-3 2 3 2-3 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLivraisons() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 14h13M5 14V5l3-3h7v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 14v3h3M14 14v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4h2v4H8z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconHistorique() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 3v4M14 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 11h3M6 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCommercials() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="10" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="6" width="3" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="3" width="3" height="14" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 17H3V3h5M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3.5A4 4 0 004 7.5V12l-2 3h16l-2-3V7.5a4 4 0 00-4-4V2h-4v1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 16a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5v2M10 15.5v2M3.5 10h2M14.5 10h2M5.05 4.05l1.42 1.42M13.53 14.53l1.42 1.42M4.05 15.95l1.42-1.42M14.53 5.47l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBenefits() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}

function IconPrelevement() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
      <path d="M8 12h8"/>
    </svg>
  );
}

const ICON_MAP = {
  dashboard: IconDashboard,
  users: IconUsers,
  products: IconProducts,
  stock: IconStock,
  livraisons: IconLivraisons,
  historique: IconHistorique,
  commercials: IconCommercials,
  benefits: IconBenefits,
  prelevement: IconPrelevement,
  settings: IconSettings,
  logout: IconLogout,
};

function AppLayout({ children }) {
  const { user, logout, requestLogout, showLogoutConfirm, confirmLogout, cancelLogout, logoutSubmitting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* ── Bottom sheet drag-to-dismiss ── */
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, dragging: false });
  const [sheetClosing, setSheetClosing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiGet('/notifications?unread=true');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch { /* ignore */ }
  }, []);

  // Keep the notification bell live: initial fetch, poll while visible,
  // refetch when the app returns to foreground, and refetch instantly when a
  // native push arrives while the app is open (Android suppresses the tray
  // banner in the foreground, so this is how the user sees it).
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (!document.hidden) fetchNotifications();
    }, 60000);
    const onPush = () => fetchNotifications();
    const onVisible = () => { if (!document.hidden) fetchNotifications(); };
    window.addEventListener('rightway:refresh-notifications', onPush);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('rightway:refresh-notifications', onPush);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifications]);
  useEffect(() => { setMobileMenuOpen(false); }, [location]);
  useEffect(() => { setNotifOpen(false); }, [location]);

  /* ── Drag-to-dismiss on mobile bottom sheet ── */
  useEffect(() => {
    if (!notifOpen) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const onTouchStart = (e) => {
      // Only drag when touching the handle or header, not the scrollable list
      if (!e.target.closest('.notif-sheet-handle') && !e.target.closest('.notif-sheet-header')) return;
      dragRef.current = { startY: e.touches[0].clientY, dragging: true };
      sheet.style.transition = 'none';
    };

    const onTouchMove = (e) => {
      if (!dragRef.current.dragging) return;
      const delta = e.touches[0].clientY - dragRef.current.startY;
      if (delta < 0) return; // only allow dragging down
      // Gentle resistance after 120 px to feel physical
      const damped = delta > 120 ? 120 + (delta - 120) * 0.35 : delta;
      sheet.style.transform = `translateY(${damped}px)`;
    };

    const onTouchEnd = () => {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      const currentTransform = sheet.style.transform;
      const match = currentTransform.match(/translateY\(([\d.]+)px\)/);
      const offset = match ? parseFloat(match[1]) : 0;
      const threshold = Math.min(sheet.offsetHeight * 0.25, 120);

      if (offset > threshold) {
        setSheetClosing(true);
      } else {
        sheet.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
        sheet.style.transform = 'translateY(0)';
      }
    };

    sheet.addEventListener('touchstart', onTouchStart, { passive: false });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd);
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.style.transition = '';
      sheet.style.transform = '';
    };
  }, [notifOpen]);

  // When the exit animation finishes, actually close the panel
  useEffect(() => {
    if (!sheetClosing) return;
    const timer = setTimeout(() => {
      setNotifOpen(false);
      setSheetClosing(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [sheetClosing]);

  // Track scroll position for topbar shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleMarkAllRead() {
    try {
      await apiPut('/notifications/mark-all-read', {});
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  async function openNotifPanel() {
    setNotifOpen(!notifOpen);
    if (!notifOpen) {
      setNotifLoading(true);
      try {
        const data = await apiGet('/notifications');
        setNotifications(data.notifications || []);
      } catch {} finally { setNotifLoading(false); }
    }
  }

  function formatRelativeTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD}j`;
  }

  function groupNotificationsByDate(notifs) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const groups = [];
    for (const n of notifs) {
      const d = new Date(n.created_at);
      if (d >= today) {
        if (!groups[0]) groups[0] = { label: "Aujourd'hui", items: [] };
        groups[0].items.push(n);
      } else if (d >= yesterday) {
        if (!groups[1]) groups[1] = { label: 'Hier', items: [] };
        groups[1].items.push(n);
      } else if (d >= weekAgo) {
        if (!groups[2]) groups[2] = { label: 'Cette semaine', items: [] };
        groups[2].items.push(n);
      } else {
        if (!groups[3]) groups[3] = { label: 'Plus ancien', items: [] };
        groups[3].items.push(n);
      }
    }
    return groups.filter(Boolean);
  }

  async function handleNotifClick(n) {
    // Optimistically mark as read for instant feedback
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      apiPut(`/notifications/${n.id}/read`, {}).catch(() => {});
    }
    if (n.livraison_id) navigate(`/livraisons/${n.livraison_id}`);
    setNotifOpen(false);
  }

  /* Shared notification content (used by both desktop dropdown and mobile sheet) */
  function renderNotifList() {
    if (notifLoading) {
      return (
        <div className="notif-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="notif-skeleton">
              <div className="notif-skel-line notif-skel-line--long" />
              <div className="notif-skel-line notif-skel-line--short" />
            </div>
          ))}
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="notif-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <p>Aucune notification</p>
        </div>
      );
    }

    const groups = groupNotificationsByDate(notifications);
    return (
      <div className="notif-list">
        {groups.map((group, gi) => (
          <div key={gi} className="notif-group">
            <div className="notif-group-header">
              <span>{group.label}</span>
              <span className="notif-group-count">{group.items.length}</span>
            </div>
            {group.items.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                onClick={() => handleNotifClick(n)}
              >
                {!n.is_read && <span className="notif-unread-dot" />}
                <div className="notif-item-content">
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-time">{formatRelativeTime(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const role = user?.role;

  // GPS tracking for COMMERCIAL users → real-time map on SUPER_ADMIN dashboard
  useLocationTracker({ role, apiGet, apiPut });

  const navItems = [];
  if (role === 'SUPER_ADMIN') {
    navItems.push({ to: '/', label: 'Tableau de bord', icon: 'dashboard' });
    navItems.push({ to: '/users', label: 'Utilisateurs', icon: 'users' });
    navItems.push({ to: '/products', label: 'Produits', icon: 'products' });
    navItems.push({ to: '/stock', label: 'Stock', icon: 'stock' });
    navItems.push({ to: '/livraisons', label: 'Livraisons', icon: 'livraisons' });
    navItems.push({ to: '/commercials', label: 'Commerciaux', icon: 'commercials' });
    navItems.push({ to: '/benefits', label: 'Bénéfices', icon: 'benefits' });
    navItems.push({ to: '/prelevements', label: 'Prélèvements', icon: 'prelevement' });
    navItems.push({ to: '/historique', label: 'Historique', icon: 'historique' });
    navItems.push({ to: '/parametres', label: 'Paramètres', icon: 'settings' });
  } else if (role === 'DIRECTEUR_COMMERCIAL') {
    navItems.push({ to: '/stock', label: 'Stock', icon: 'stock' });
    navItems.push({ to: '/livraisons', label: 'Livraisons', icon: 'livraisons' });
    navItems.push({ to: '/historique', label: 'Historique', icon: 'historique' });
  } else if (role === 'MAGASINIER') {
    navItems.push({ to: '/stock', label: 'Stock', icon: 'stock' });
    navItems.push({ to: '/livraisons', label: 'Livraisons', icon: 'livraisons' });
  } else if (role === 'COMMERCIAL') {
    navItems.push({ to: '/livraisons', label: 'Mes livraisons', icon: 'livraisons' });
    navItems.push({ to: '/historique', label: 'Historique', icon: 'historique' });
    navItems.push({ to: '/settings', label: 'Paramètres', icon: 'settings' });
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  function getRoleLabel(role) {
    const map = { SUPER_ADMIN: 'Super Admin', DIRECTEUR_COMMERCIAL: 'Directeur Commercial', MAGASINIER: 'Magasinier', COMMERCIAL: 'Commercial' };
    return map[role] || role;
  }

  function getCurrentPageTitle() {
    const path = location.pathname;
    if (path === '/') return 'Tableau de bord';
    if (path.startsWith('/users')) return 'Utilisateurs';
    if (path.startsWith('/products')) return 'Produits';
    if (path.startsWith('/stock')) return 'Stock';
    if (path.startsWith('/livraisons/nouvelle')) return 'Nouvelle livraison';
    if (path.startsWith('/livraisons/') && path.split('/').length === 3) return 'Détail livraison';
    if (path.startsWith('/livraisons')) return 'Livraisons';
    if (path.startsWith('/ventes')) return 'Déclaration des ventes';
    if (path.startsWith('/commercials')) return 'Commerciaux';
    if (path.startsWith('/benefits')) return 'Bénéfices & Rentabilité';
    if (path.startsWith('/prelevements')) return 'Prélèvements';
    if (path.startsWith('/historique')) return 'Historique';
    if (path.startsWith('/parametres')) return 'Paramètres';
    if (path.startsWith('/settings')) return 'Paramètres';
    return '';
  }

  return (
    <div className="app-layout">
      {/* In-app heads-up banner for foreground push notifications */}
      <NotificationBanner />

      {/* Top Bar */}
      <header className={`topbar${scrolled ? ' topbar-scrolled' : ''}`}>
        <div className="topbar-left">
          <button
            className="hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              {mobileMenuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <span className="topbar-page-title">{getCurrentPageTitle()}</span>
        </div>
        <div className="topbar-actions">
          <button className="notif-bell" onClick={openNotifPanel} aria-label="Notifications">
            <IconBell />
            <span className={`notif-dot ${unreadCount > 0 ? '' : 'notif-dot-hidden'}`} aria-hidden="true" />
          </button>
          <button className="topbar-logout-btn" onClick={requestLogout} aria-label="Déconnexion" title="Déconnexion">
            <IconLogout />
          </button>
          <div className="topbar-avatar">
            {getInitials(user?.full_name)}
          </div>
        </div>
      </header>

      {/* Notification Dropdown (Desktop) + Bottom Sheet (Mobile) */}
      {notifOpen && (
        <>
          {/* Desktop: dropdown from bell icon */}
          <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-header">
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <button className="btn-ghost btn-sm" onClick={handleMarkAllRead}>
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {renderNotifList()}
          </div>

          {/* Mobile: bottom sheet */}
          <div className={`notif-sheet-backdrop${sheetClosing ? ' notif-sheet-backdrop--closing' : ''}`} onClick={() => setNotifOpen(false)} />
          <div className={`notif-sheet${sheetClosing ? ' notif-sheet--closing' : ''}`} ref={sheetRef}>
            <div className="notif-sheet-handle" />
            <div className="notif-sheet-header">
              <h2 className="notif-sheet-title">Notifications</h2>
              {unreadCount > 0 && (
                <button className="notif-sheet-mark-all" onClick={handleMarkAllRead}>
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {renderNotifList()}
          </div>
        </>
      )}

      <div className="app-body">
        {/* Sidebar Desktop */}
        <div className="sidebar-spacer" />
        <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-brand" onClick={() => { navigate('/'); setMobileMenuOpen(false); }}>
            <div className="sidebar-logo">Right Way<span className="logo-accent">.</span></div>
            <div className="sidebar-subtitle">STE RIGHT WAY FOR TRADING</div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon];
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="nav-icon">{Icon && <Icon />}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{getInitials(user?.full_name)}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.full_name}</div>
                <div className="sidebar-user-role">{getRoleLabel(role)}</div>
              </div>
            </div>
            <button className="nav-item logout-btn" onClick={requestLogout}>
              <span className="nav-icon"><IconLogout /></span>
              <span className="nav-label">Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />}

        {/* Main Content */}
        <main className="main-content">
          <div className="page-transition" key={location.key}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Nav Mobile — all role-appropriate tabs, horizontally scrollable */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="bn-icon">{Icon && <Icon />}</span>
              <span className="bn-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={cancelLogout}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 className="modal-title">Confirmer la déconnexion</h3>
            <div className="modal-summary">
              <p>Êtes-vous sûr de vouloir vous déconnecter ?</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelLogout}
                disabled={logoutSubmitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmLogout}
                disabled={logoutSubmitting}
              >
                {logoutSubmitting ? 'Déconnexion...' : 'Se déconnecter'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AppLayout;
