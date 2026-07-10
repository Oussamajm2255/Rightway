import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../lib/api';
import useLocationTracker from '../lib/useLocationTracker';
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

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiGet('/notifications?unread=true');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { setMobileMenuOpen(false); }, [location]);
  useEffect(() => { setNotifOpen(false); }, [location]);

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

      {/* Notification Dropdown */}
      {notifOpen && (
        <>
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
            <div className="notif-list">
              {notifLoading ? (
                <div className="notif-empty">Chargement...</div>
              ) : notifications.length === 0 ? (
                <div className="notif-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                    <line x1="3" y1="3" x2="21" y2="21" />
                  </svg>
                  <p>Aucune notification</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                    onClick={() => { if (n.livraison_id) navigate(`/livraisons/${n.livraison_id}`); setNotifOpen(false); }}
                  >
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-time">{formatRelativeTime(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
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
