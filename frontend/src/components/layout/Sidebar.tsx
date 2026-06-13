import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Package,
  Layers,
  Grid3X3,
  Settings,
  LogOut,
  User,
  UserPlus,
  Store,
  ClipboardList,
  CheckCircle,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { clsx } from 'clsx';
import { Badge } from '../ui';
import { useState, useEffect } from 'react';
import { useSidebar } from './SidebarContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Demo Restaurant' },
  { to: '/billing', icon: FileText, label: 'Billing' },
  { to: '/online-orders', icon: Store, label: 'Online Orders', mobileLabel: 'Orders' },
  { to: '/customer-orders', icon: ClipboardList, label: 'Customer Orders' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/categories', icon: Layers, label: 'Categories' },
  { to: '/sections', icon: Grid3X3, label: 'Sections' },
  { to: '/tables', icon: LayoutDashboard, label: 'Tables' },
  { to: '/busser', icon: ClipboardList, label: 'Busser Tasks', roles: ['busser'] },
  { to: '/customers', icon: UserPlus, label: 'Customers', roles: ['admin'] },
  { to: '/database', icon: Database, label: 'Database', roles: ['admin'], desktopOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings', desktopOnly: true },
  { to: '/profile', icon: User, label: 'Profile', roles: ['admin'], mobileOnly: true },
];

const roleLabels = {
  admin: { text: 'Admin', variant: 'accent' as const },
  waiter: { text: 'Waiter', variant: 'info' as const },
  accountant: { text: 'Accountant', variant: 'success' as const },
  busser: { text: 'Busser', variant: 'warning' as const },
};

type SidebarMode = 'icon' | 'full';
type ViewMode = 'mobile' | 'tablet' | 'desktop';

export function Sidebar() {
  const { user, restaurant, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isOpen, toggle, close } = useSidebar();
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Detect viewport size
  useEffect(() => {
    const updateViewMode = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setViewMode('mobile');
      } else if (width < 1024) {
        setViewMode('tablet');
        setCollapsed(true);
      } else {
        setViewMode('desktop');
        setCollapsed(false);
      }
    };

    updateViewMode();
    window.addEventListener('resize', updateViewMode);
    return () => window.removeEventListener('resize', updateViewMode);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleCollapse = () => {
    if (viewMode === 'mobile') {
      toggle();
    } else {
      setCollapsed(!collapsed);
    }
  };

  const role = user?.role ? roleLabels[user.role] : { text: 'User', variant: 'default' as const };

  // Desktop/Tablet sidebar width
  const sidebarWidth = viewMode !== 'mobile' ? (collapsed ? 'w-[80px]' : 'w-[280px]') : '';

  const sidebarClasses = clsx(
    'h-screen bg-background-secondary flex flex-col border-r border-white/10 jali-pattern transition-all duration-300',
    viewMode === 'mobile' 
      ? `fixed inset-y-0 left-0 z-50 w-[280px] ${isOpen ? 'translate-x-0' : '-translate-x-full'}` 
      : '',
    sidebarWidth
  );

  const showFullContent = viewMode === 'mobile' || !collapsed;

  return (
    <>
      {/* Mobile Toggle Button - visible when sidebar is closed */}
      {viewMode === 'mobile' && !isOpen && (
        <button
          onClick={toggle}
          className="fixed top-2 left-2 z-40 p-2 rounded-lg bg-background-secondary border border-white/10 shadow-lg hover:bg-background-card transition-all"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Mobile Overlay */}
      {viewMode === 'mobile' && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Header with Logo & Toggle */}
        <div className="p-4 border-b border-white/10">
          {collapsed && viewMode !== 'mobile' ? (
            /* Collapsed Mode - Show only toggle button */
            <div className="flex justify-center">
              <button
                onClick={toggleCollapse}
                className="p-3 rounded-lg hover:bg-white/10 transition-all bg-gradient-to-br from-accent to-primary"
                title="Expand Sidebar"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </div>
          ) : (
            /* Expanded Mode - Show full header */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                  <span className="text-xl font-bold text-white">₹</span>
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold gradient-text">Oyebill</h1>
                  <p className="text-[10px] text-text-muted tracking-wider">RESTAURANT BILLING</p>
                </div>
              </div>
              {viewMode !== 'mobile' && (
                <button
                  onClick={toggleCollapse}
                  className="p-2 rounded-lg hover:bg-white/10 transition-all"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {viewMode === 'mobile' && (
                <button
                  onClick={close}
                  className="p-2 rounded-lg hover:bg-white/10 transition-all"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Restaurant Selector - Clickable to go to Dashboard */}
        {restaurant && showFullContent && (
          <div className="px-4 py-3 border-b border-white/10">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background-card/50 hover:bg-accent/10 transition-colors"
            >
              <Store className="w-4 h-4 text-accent" />
              <span className="text-sm truncate">{restaurant.name}</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className={clsx(
          'flex-1 p-2 overflow-y-auto',
          showFullContent ? 'space-y-1' : 'space-y-2'
        )}>
          {/* Demo Restaurant / Dashboard Button */}
          <NavLink
            to="/dashboard"
            onClick={() => viewMode === 'mobile' && close()}
            className={({ isActive }) =>
              clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                isActive ? 'bg-accent/20 text-accent' : 'bg-background-card/50 hover:bg-accent/10'
              )
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-store w-4 h-4 text-accent">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path>
              <path d="M2 7h20"></path>
              <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"></path>
            </svg>
            <span className="text-sm truncate">Demo Restaurant</span>
          </NavLink>

          {/* Rest of nav items */}
          {navItems.filter(item => item.to !== '/dashboard').map((item) => {
            // Filter based on device visibility
            if (item.desktopOnly && viewMode === 'mobile') return null;
            if (item.mobileOnly && viewMode !== 'mobile') return null;

            if (user?.role === 'admin') {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => viewMode === 'mobile' && close()}
                  className={({ isActive }) =>
                    clsx('nav-item', isActive && 'nav-item-active')
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {showFullContent && <span>{viewMode === 'mobile' && item.mobileLabel ? item.mobileLabel : item.label}</span>}
                </NavLink>
              );
            }
            if (item.roles && user?.role && !item.roles.includes(user.role)) {
              return null;
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => viewMode === 'mobile' && close()}
                className={({ isActive }) =>
                  clsx('nav-item', isActive && 'nav-item-active')
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {showFullContent && <span>{viewMode === 'mobile' && item.mobileLabel ? item.mobileLabel : item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          {showFullContent ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <Badge variant={role.variant} className="mt-1">{role.text}</Badge>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="nav-item w-full text-error hover:bg-error/10"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-error hover:bg-error/10"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}