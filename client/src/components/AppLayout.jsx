import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../lib/api';
import './AppLayout.css';

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

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

  const role = user?.role;

  const navItems = [];
  if (role === 'SUPER_ADMIN') {
    navItems.push({ to: '/', label: 'Tableau de bord', icon: '📊' });
    navItems.push({ to: '/users', label: 'Utilisateurs', icon: '👥' });
    navItems.push({ to: '/products', label: 'Produits', icon: '📦' });
    navItems.push({ to: '/stock', label: 'Stock', icon: '🏭' });
    navItems.push({ to: '/livraisons', label: 'Livraisons', icon: '🚚' });
    navItems.push({ to: '/historique', label: 'Historique', icon: '📋' });
  } else if (role === 'ADMIN') {
    navItems.push({ to: '/', label: 'Tableau de bord', icon: '📊' });
    navItems.push({ to: '/stock', label: 'Stock', icon: '🏭' });
    navItems.push({ to: '/livraisons', label: 'Livraisons', icon: '🚚' });
    navItems.push({ to: '/historique', label: 'Historique', icon: '📋' });
  } else if (role === 'COMMERCIAL') {
    navItems.push({ to: '/', label: 'Tableau de bord', icon: '📊' });
    navItems.push({ to: '/livraisons', label: 'Mes livraisons', icon: '🚚' });
    navItems.push({ to: '/historique', label: 'Historique', icon: '📋' });
  }

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="topbar">
        <button className="hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span /><span /><span />
        </button>
        <div className="topbar-brand" onClick={() => navigate('/')}>
          Right Way
        </div>
        <div className="topbar-actions">
          {/* Notification Bell */}
          <button className="notif-bell" onClick={openNotifPanel}>
            🔔
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <div className="topbar-user">{user?.full_name}</div>
        </div>
      </header>

      {/* Notification Dropdown */}
      {notifOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="btn btn-sm btn-outline" onClick={handleMarkAllRead}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifLoading ? <div className="notif-empty">Chargement...</div> :
             notifications.length === 0 ? <div className="notif-empty">Aucune notification</div> :
             notifications.map((n) => (
               <div
                 key={n.id}
                 className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                 onClick={() => { if (n.livraison_id) navigate(`/livraisons/${n.livraison_id}`); setNotifOpen(false); }}
               >
                 <div className="notif-msg">{n.message}</div>
                 <div className="notif-time">{new Date(n.created_at).toLocaleString('fr-FR')}</div>
               </div>
             ))}
          </div>
        </div>
      )}

      <div className="app-body">
        {/* Sidebar Desktop */}
        <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item logout-btn" onClick={logout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />}

        {/* Main Content */}
        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Bottom Nav Mobile */}
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;
