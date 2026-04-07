import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Package, Tag, Gift, Warehouse,
  Users, BarChart2, Megaphone, Receipt, LogOut, Menu, X, Settings as SettingsIcon, UserCheck, Truck,
} from 'lucide-react';
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
import PlatformLayout from './pages/platform/PlatformLayout';
import { getSetting, setSetting } from './api';

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

const ADMIN_NAV_SECTIONS = [
  { label: 'General',   ids: ['dashboard','orders','leads','products','suppliers'] },
  { label: 'Inventory', ids: ['packs','stock'] },
  { label: 'Finance',   ids: ['expenses','ads','reports'] },
  { label: 'Workspace', ids: ['team','settings'] },
];

const CONFIRMER_NAV = [
  { id: 'dashboard', Icon: LayoutDashboard },
  { id: 'orders',    Icon: Package },
  { id: 'products',  Icon: Tag },
  { id: 'packs',     Icon: Gift },
  { id: 'stock',     Icon: Warehouse },
  { id: 'settings',  Icon: SettingsIcon },
];

const CONFIRMER_NAV_SECTIONS = [
  { label: 'General',   ids: ['dashboard','orders'] },
  { label: 'Inventory', ids: ['products','packs','stock'] },
  { label: 'Workspace', ids: ['settings'] },
];

// Reload if tab was hidden/inactive for more than 10 minutes (keeps Render server warm on return)
const INACTIVE_LIMIT = 10 * 60 * 1000;
function useReloadOnInactivity() {
  useEffect(() => {
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > INACTIVE_LIMIT) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}

// After 5 min of no activity, ping the backend after a random 1–9 min delay.
// Any user activity resets the idle counter so the ping only fires when truly idle.
const IDLE_BEFORE_PING = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'pointerdown'];
function useKeepAlive() {
  useEffect(() => {
    let idleTimer = null;
    let pingTimer = null;

    const clearAll = () => {
      clearTimeout(idleTimer);
      clearTimeout(pingTimer);
    };

    const schedulePing = () => {
      const delay = (Math.random() * 8 + 1) * 60 * 1000; // 1–9 min random
      pingTimer = setTimeout(() => {
        fetch('/api/health').catch(() => {});
      }, delay);
    };

    const resetIdle = () => {
      clearAll();
      idleTimer = setTimeout(schedulePing, IDLE_BEFORE_PING);
    };

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle(); // start on mount

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, []);
}

export default function App() {
  useReloadOnInactivity();
  useKeepAlive();
  const [page, setPage] = useState('dashboard');
  const [navParams, setNavParams] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  // ── Appearance state ────────────────────────────────────────
  const [theme,  setTheme]  = useState(() => localStorage.getItem('app_theme')  || 'light');
  const [lang,   setLang]   = useState(() => localStorage.getItem('app_lang')   || 'en');
  const [accent, setAccent] = useState(() => localStorage.getItem('app_accent') || '#00d48f');
  const langInitialized = useRef(false);
  const [logo,   setLogo]   = useState(() => localStorage.getItem('store_logo') || null);
  const [storeName, setStoreName] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user'))?.store_name || ''; } catch { return ''; }
  });

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

  // On mount (after login), load language preference from backend
  useEffect(() => {
    if (!user || langInitialized.current) return;
    langInitialized.current = true;
    getSetting('app_language').then(res => {
      const saved = res?.data?.value;
      if (saved && ['en', 'fr', 'ar'].includes(saved)) {
        setLang(saved);
        localStorage.setItem('app_lang', saved);
      }
    }).catch(() => {});
  }, [user]);

  const handleSetLang = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
    setSetting('app_language', newLang).catch(() => {});
  }, []);

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

  const isConfirmer = user.role === 'confirmer';
  const nav = isConfirmer ? CONFIRMER_NAV : ADMIN_NAV;
  const navSections = isConfirmer ? CONFIRMER_NAV_SECTIONS : ADMIN_NAV_SECTIONS;
  const currentPage = isConfirmer && !nav.find(n => n.id === page) ? 'dashboard' : page;
  const labels = T[lang] || T.en;
  // Bottom nav: first 4 items + Settings always pinned at the end
  const settingsNavItem = nav.find(n => n.id === 'settings');
  const bottomNav = [...nav.slice(0, 4), settingsNavItem].filter(Boolean);

  const navigate = (id, params = {}) => {
    setPage(id);
    setNavParams(params);
    setSidebarOpen(false);
  };

  const initial = (user.username || 'U')[0].toUpperCase();

  const settingsProps = { user, theme, setTheme, lang, setLang: handleSetLang, accent, setAccent, logo, setLogo, onStoreName: handleStoreName, onLogout: handleLogout };

  const pages = {
    dashboard: <Dashboard onNavigate={navigate} user={user} />,
    orders:    <Orders user={user} />,
    leads:     <Leads />,
    suppliers: <Suppliers />,
    products:  <Products readOnly={isConfirmer} />,
    packs:     <Packs readOnly={isConfirmer} />,
    stock:     <Stock readOnly={isConfirmer} highlight={navParams.highlight} />,
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
        <span className="topbar-store">{storeName || user.store_name}</span>
      </div>

      {/* ── Backdrop ── */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        <div className="sidebar-logo">
          {logo
            ? <img src={logo} alt="logo" style={{ width: 32, height: 32, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
            : <div className="sidebar-logo-icon">S</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-logo-text">Stocky</div>
            <div className="sidebar-logo-store">{storeName || user.store_name}</div>
          </div>
          <button className="btn-icon sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initial}</div>
          <div>
            <div className="sidebar-username">@{user.username}</div>
            <div className="sidebar-role">
              <span className="sidebar-role-dot" />
              {isConfirmer ? (labels.confirmer || 'Confirmer') : 'Admin'}
            </div>
          </div>
        </div>

        <nav>
          {navSections.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {nav.filter(n => section.ids.includes(n.id)).map(({ id, Icon }) => (
                <div
                  key={id}
                  className={`nav-item${currentPage === id ? ' active' : ''}`}
                  onClick={() => navigate(id)}
                >
                  <Icon size={15} strokeWidth={1.75} className="nav-icon" />
                  <span>{labels[id] || id}</span>
                </div>
              ))}
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

    </div>
  );
}
