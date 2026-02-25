import { useState } from 'react';
import { LayoutDashboard, Store, Receipt, Settings, LogOut, Menu, X } from 'lucide-react';
import PlatformDashboard from './PlatformDashboard';
import PlatformStores    from './PlatformStores';
import PlatformExpenses  from './PlatformExpenses';
import PlatformSettings  from './PlatformSettings';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'stores',    label: 'Stores',    Icon: Store },
  { id: 'expenses',  label: 'Expenses',  Icon: Receipt },
  { id: 'settings',  label: 'Settings',  Icon: Settings },
];

export default function PlatformLayout({ user, onLogout }) {
  const [page, setPage]             = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (id) => { setPage(id); setSidebarOpen(false); };

  const content = {
    dashboard: <PlatformDashboard onNavigate={navigate} />,
    stores:    <PlatformStores />,
    expenses:  <PlatformExpenses />,
    settings:  <PlatformSettings />,
  };

  return (
    <div className="layout">

      {/* ── Mobile Top Bar ── */}
      <div className="topbar">
        <button className="topbar-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <span className="topbar-logo">STOKY</span>
        <span className="topbar-store">Platform</span>
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
            <div className="sidebar-logo-text">STOKY</div>
            <button className="btn-icon sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="sidebar-logo-store">Platform Admin</div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{(user?.username || 'S')[0].toUpperCase()}</div>
          <div>
            <div className="sidebar-username">@{user?.username}</div>
            <div className="sidebar-role">
              <span className="sidebar-role-dot" />
              Super Admin
            </div>
          </div>
        </div>

        <nav>
          {NAV.map(({ id, label, Icon }) => (
            <div
              key={id}
              className={`nav-item${page === id ? ' active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={16} strokeWidth={1.75} className="nav-icon" />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-info">Signed in as @{user?.username}</div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', gap: 8 }} onClick={onLogout}>
            <LogOut size={14} strokeWidth={1.75} />
            Sign Out
          </button>
        </div>

      </aside>

      {/* ── Main ── */}
      <main className="main">
        {content[page]}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        {NAV.map(({ id, label, Icon }) => (
          <div
            key={id}
            className={`bottom-nav-item${page === id ? ' active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={20} strokeWidth={1.75} className="bn-icon" />
            <span className="bn-label">{label}</span>
          </div>
        ))}
      </nav>

    </div>
  );
}
