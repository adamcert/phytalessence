import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Produits', href: '/products', icon: Package },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Utilisateurs', href: '/users', icon: UserCircle },
  { name: 'Parametres', href: '/settings', icon: Settings },
  { name: 'Administrateurs', href: '/admins', icon: Users, adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navigation.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN'
  );

  return (
    <div className="min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden',
          'glass-strong rounded-r-2xl shadow-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-3">
            <img src="/images/logo-gold.png" alt="Phytalessence" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-[var(--text-primary)]">Phytalessence</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        {/* Mobile user section */}
        <div className="p-4 border-t border-[var(--border-glass)]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user?.email}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">{user?.role}</p>
            </div>
            <button
              onClick={() => {
                logout();
                setSidebarOpen(false);
              }}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-error-500 hover:bg-error-50 transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 m-4 glass-strong rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 h-16 px-6 border-b border-[var(--border-glass)]">
            <img src="/images/logo-gold.png" alt="Phytalessence" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-[var(--text-primary)]">Phytalessence</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-[var(--border-glass)]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-error-500 hover:bg-error-50 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:pl-80">
        <div className="sticky top-0 z-30 flex items-center h-16 px-4 glass-strong lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <Menu className="w-6 h-6 text-[var(--text-secondary)]" />
          </button>
          <div className="ml-4 flex items-center gap-2">
            <img src="/images/logo-gold.png" alt="Phytalessence" className="h-6 w-auto" />
            <span className="text-lg font-semibold text-[var(--text-primary)]">Phytalessence</span>
          </div>
        </div>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
