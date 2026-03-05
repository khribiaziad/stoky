import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Package, Tag, Gift, Warehouse,
  Users, BarChart2, Megaphone, Receipt, LogOut, Menu, X, Settings as SettingsIcon, UserCheck, Truck, Bell,
} from 'lucide-react';
import { getSetting, getNotifications, markNotificationRead, markAllNotificationsRead } from './api';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Packs from './pages/Packs';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import Team from './pages/Team';
import Reports from './pages/Reports';
import Ads from './pages/Ads';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Leads from './pages/Leads';
import Suppliers from './pages/Suppliers';
import Login from './pages/Login';
import Setup from './pages/Setup';
import PlatformLayout from './pages/platform/PlatformLayout';

// ── Nav label translations ───────────────────────────────────
const T = {
  en: {
    dashboard: 'Dashboard', orders: 'Orders',    products: 'Products',
    packs: 'Packs',         stock: 'Stock',       team: 'Team',
    expenses: 'Expenses',   ads: 'Ads',           reports: 'Reports',
    settings: 'Settings',   leads: 'Leads',       suppliers: 'Suppliers',
  },
  fr: {
    dashboard: 'Tableau de bord', orders: 'Commandes', products: 'Produits',
    packs: 'Packs',               stock: 'Stock',      team: 'Équipe',
    expenses: 'Dépenses',         ads: 'Publicités',   reports: 'Rapports',
    settings: 'Paramètres',       leads: 'Prospects',  suppliers: 'Fournisseurs',
  },
  ar: {
    dashboard: 'لوحة التحكم', orders: 'الطلبات',    products: 'المنتجات',
    packs: 'الحزم',           stock: 'المخزون',      team: 'الفريق',
    expenses: 'المصاريف',     ads: 'الإعلانات',      reports: 'التقارير',
    settings: 'الإعدادات',    leads: 'العملاء',      suppliers: 'الموردون',
  },
};

const ADMIN_NAV = [
  { id: 'dashboard', Icon: LayoutDashboard },
  { id: 'orders',    Icon: Package },
  { id: 'leads',     Icon: UserCheck },
  { id: 'products',  Icon: Tag },
  { id: 'suppliers', Icon: Truck },
  { id: 'packs',     Icon: Gift },
  { id: 'stock',     Icon: Warehouse },
  { id: 'team',      Icon: Users },
  { id: 'expenses',  Icon: Receipt },
  { id: 'ads',       Icon: Megaphone },
  { id: 'reports',   Icon: BarChart2 },
  { id: 'settings',  Icon: SettingsIcon },
];

const CONFIRMER_NAV = [
  { id: 'dashboard', Icon: LayoutDashboard },
  { id: 'orders',    Icon: Package },
  { id: 'products',  Icon: Tag },
  { id: 'packs',     Icon: Gift },
  { id: 'stock',     Icon: Warehouse },
  { id: 'settings',  Icon: SettingsIcon },
];

const TYPE_COLOR = { delivered: '#4ade80', returned: '#f87171', failed: '#facc15' };
const TYPE_LABEL = { delivered: '✓ Livré', returned: '↩ Retour', failed: '⚠ Tentative' };

function NotifDropdown({ notifications, onNotifClick, onMarkAll }) {
  return (
    <div style={{
      position: 'fixed', top: 56, right: 8, width: 300, maxWidth: 'calc(100vw - 16px)',
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 9999, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Notifications</span>
        <button onClick={onMarkAll} style={{ fontSize: 11, color: 'var(--accent)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0 }}>
          Mark all read
        </button>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 13, color: 'var(--t2)' }}>
            No notifications yet
          </div>
        ) : notifications.map(n => (
          <div key={n.id} onClick={() => onNotifClick(n)}
            style={{
              padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: n.is_read ? 'transparent' : 'var(--card-2)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
            <span style={{
              marginTop: 2, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              background: (TYPE_COLOR[n.type] || '#8892b0') + '22',
              color: TYPE_COLOR[n.type] || '#8892b0',
            }}>{TYPE_LABEL[n.type] || n.type}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.customer_name} {n.caleo_id ? `· ${n.caleo_id}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{n.message}</div>
            </div>
            {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [setupDone, setSetupDone] = useState(null); // null=loading, true=done, false=needs setup

  // ── Appearance state ────────────────────────────────────────
  const [theme,  setTheme]  = useState(() => localStorage.getItem('app_theme')  || 'dark');
  const [lang,   setLang]   = useState(() => localStorage.getItem('app_lang')   || 'en');
  const [accent, setAccent] = useState(() => localStorage.getItem('app_accent') || '#00d48f');
  const [logo,   setLogo]   = useState(() => localStorage.getItem('store_logo') || null);
  const [storeName, setStoreName] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user'))?.store_name || ''; } catch { return ''; }
  });

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const bellRefSidebar = useRef(null);

  const loadNotifications = useCallback(() => {
    getNotifications().then(r => {
      setNotifications(r.data.notifications);
      setUnread(r.data.unread);
    }).catch(() => {});
  }, []);

  const handleStoreName = useCallback((name) => {
    setStoreName(name);
    // Patch cached user object
    try {
      const u = JSON.parse(localStorage.getItem('user')) || {};
      localStorage.setItem('user', JSON.stringify({ ...u, store_name: name }));
    } catch {}
  }, []);

  // Apply on mount and whenever they change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-a', accent + '1f');
    document.documentElement.style.setProperty('--accent-b', accent + '38');
    document.documentElement.style.setProperty('--accent-c', accent + '0f');
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  // Check onboarding status whenever user changes
  useEffect(() => {
    if (!user || user.role === 'super_admin' || user.role === 'confirmer') {
      setSetupDone(true);
      return;
    }
    setSetupDone(null);
    getSetting('onboarding_done')
      .then(r => setSetupDone(r.data?.value === 'true'))
      .catch(() => setSetupDone(true));
  }, [user?.id]);

  // Poll notifications every 60 seconds
  useEffect(() => {
    if (!user || user.role === 'super_admin') return;
    loadNotifications();
    const id = setInterval(loadNotifications, 60_000);
    return () => clearInterval(id);
  }, [user?.id, loadNotifications]);

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => {
      const inTopbar  = bellRef.current && bellRef.current.contains(e.target);
      const inSidebar = bellRefSidebar.current && bellRefSidebar.current.contains(e.target);
      if (!inTopbar && !inSidebar) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const handleBellClick = () => {
    setBellOpen(o => !o);
  };

  const handleNotifClick = (n) => {
    if (!n.is_read) {
      markNotificationRead(n.id).then(loadNotifications).catch(() => {});
    }
    setBellOpen(false);
    setPage('orders');
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead().then(loadNotifications).catch(() => {});
  };

  const handleAuth = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <Login onAuth={handleAuth} />;

  // Super admin gets their own platform view
  if (user.role === 'super_admin') {
    return <PlatformLayout user={user} onLogout={handleLogout} />;
  }

  // Onboarding — show spinner while checking, then setup wizard if not done
  if (setupDone === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--t2)', fontSize: 14 }}>
      Loading…
    </div>
  );
  if (!setupDone) return <Setup user={user} onComplete={() => window.location.reload()} />;

  const isConfirmer = user.role === 'confirmer';
  const nav = isConfirmer ? CONFIRMER_NAV : ADMIN_NAV;
  const currentPage = isConfirmer && !nav.find(n => n.id === page) ? 'dashboard' : page;
  const labels = T[lang] || T.en;
  // Bottom nav: first 4 items + Settings always pinned at the end
  const settingsNavItem = nav.find(n => n.id === 'settings');
  const bottomNav = [...nav.slice(0, 4), settingsNavItem].filter(Boolean);

  const navigate = (id) => {
    setPage(id);
    setSidebarOpen(false);
  };

  const initial = (user.username || 'U')[0].toUpperCase();

  const settingsProps = { user, theme, setTheme, lang, setLang, accent, setAccent, logo, setLogo, onStoreName: handleStoreName, onLogout: handleLogout };

  const pages = {
    dashboard: <Dashboard onNavigate={navigate} user={user} />,
    orders:    <Orders user={user} />,
    leads:     <Leads />,
    suppliers: <Suppliers />,
    products:  <Products readOnly={isConfirmer} />,
    packs:     <Packs readOnly={isConfirmer} />,
    stock:     <Stock readOnly={isConfirmer} />,
    team:      <Team />,
    expenses:  <Expenses />,
    ads:       <Ads />,
    reports:   <Reports />,
    settings:  <Settings {...settingsProps} />,
  };

  return (
    <div className="layout">

      {/* ── Mobile / Tablet Top Bar ── */}
      <div className="topbar">
        <button className="topbar-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <span className="topbar-logo">STOCKY</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span className="topbar-store">{storeName || user.store_name}</span>
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button className="btn-icon" onClick={handleBellClick} aria-label="Notifications"
              style={{ position: 'relative' }}>
              <Bell size={18} strokeWidth={1.75} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, background: '#f87171',
                  color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, pointerEvents: 'none',
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>
            {bellOpen && <NotifDropdown notifications={notifications} onNotifClick={handleNotifClick} onMarkAll={handleMarkAllRead} />}
          </div>
        </div>
      </div>

      {/* ── Backdrop ── */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {logo
                ? <img src={logo} alt="logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : null
              }
              <div className="sidebar-logo-text">STOCKY</div>
            </div>
            <button
              className="btn-icon sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="sidebar-logo-store">{storeName || user.store_name}</div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initial}</div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-username">@{user.username}</div>
            <div className="sidebar-role">
              <span className="sidebar-role-dot" />
              {isConfirmer ? (labels.confirmer || 'Confirmer') : 'Admin'}
            </div>
          </div>
          <div ref={bellRefSidebar} style={{ position: 'relative', flexShrink: 0 }}>
            <button className="btn-icon" onClick={handleBellClick} aria-label="Notifications"
              style={{ position: 'relative' }}>
              <Bell size={16} strokeWidth={1.75} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, background: '#f87171',
                  color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, pointerEvents: 'none',
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </button>
            {bellOpen && <NotifDropdown notifications={notifications} onNotifClick={handleNotifClick} onMarkAll={handleMarkAllRead} />}
          </div>
        </div>

        <nav>
          {nav.map(({ id, Icon }) => (
            <div
              key={id}
              className={`nav-item${currentPage === id ? ' active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={16} strokeWidth={1.75} className="nav-icon" />
              <span>{labels[id] || id}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-info">Signed in as @{user.username}</div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', gap: 8 }} onClick={handleLogout}>
            <LogOut size={14} strokeWidth={1.75} />
            {lang === 'fr' ? 'Déconnexion' : lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </button>
        </div>

      </aside>

      {/* ── Main Content ── */}
      <main className="main">
        {pages[currentPage]}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="bottom-nav">
        {bottomNav.map(({ id, Icon }) => (
          <div
            key={id}
            className={`bottom-nav-item${currentPage === id ? ' active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={20} strokeWidth={1.75} className="bn-icon" />
            <span className="bn-label">{labels[id] || id}</span>
          </div>
        ))}
      </nav>

      {/* ── WhatsApp Support Button ── */}
      <a
        href={`https://wa.me/212674234434?text=${encodeURIComponent(`Hi, I need help with Stocky.\nStore: ${storeName || user.store_name} (@${user.username})`)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact support on WhatsApp"
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 1000,
          width: 48, height: 48, borderRadius: '50%',
          background: '#25D366', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(37,211,102,0.45)',
          textDecoration: 'none', transition: 'transform .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

    </div>
  );
}
