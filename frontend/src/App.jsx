import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, Tag, Gift, Warehouse,
  Users, BarChart2, Megaphone, Receipt, LogOut, Menu, X, Settings as SettingsIcon, UserCheck, Truck,
} from 'lucide-react';
import { getSetting } from './api';
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
          <div>
            <div className="sidebar-username">@{user.username}</div>
            <div className="sidebar-role">
              <span className="sidebar-role-dot" />
              {isConfirmer ? (labels.confirmer || 'Confirmer') : 'Admin'}
            </div>
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

    </div>
  );
}
