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
  Store,
  ClipboardList,
  CheckCircle,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { clsx } from 'clsx';
import { Badge } from '../ui';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/billing', icon: FileText, label: 'Billing' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/categories', icon: Layers, label: 'Categories' },
  { to: '/sections', icon: Grid3X3, label: 'Sections' },
  { to: '/tables', icon: LayoutDashboard, label: 'Tables' },
  { to: '/busser', icon: ClipboardList, label: 'Busser Tasks', roles: ['busser'] },
  { to: '/settings', icon: Settings, label: 'Settings' },
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('full');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Detect viewport size
  useEffect(() => {
    const updateViewMode = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setViewMode('mobile');
        setMobileOpen(false);
      } else if (width < 1024) {
        setViewMode('tablet');
        setMobileOpen(false);
      } else {
        setViewMode('desktop');
      }
    };

    updateViewMode();
    window.addEventListener('resize', updateViewMode);
    return () => window.removeEventListener('resize', updateViewMode);
  }, []);

  // Auto-collapse on tablet
  useEffect(() => {
    if (viewMode === 'tablet') {
      setSidebarMode('icon');
      setCollapsed(true);
    } else if (viewMode === 'desktop') {
      setSidebarMode('full');
      setCollapsed(false);
    }
  }, [viewMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleCollapse = () => {
    if (viewMode === 'mobile') {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
      setSidebarMode(collapsed ? 'full' : 'icon');
    }
  };

  const cycleMode = () => {
    if (viewMode === 'mobile') {
      setMobileOpen(!mobileOpen);
    } else {
      // Cycle through: full -> icon -> full
      if (sidebarMode === 'full') {
        setSidebarMode('icon');
        setCollapsed(true);
      } else {
        setSidebarMode('full');
        setCollapsed(false);
      }
    }
  };

  const role = user?.role ? roleLabels[user.role] : { text: 'User', variant: 'default' as const };

  const sidebarClasses = clsx(
    'h-screen bg-background-secondary flex flex-col border-r border-white/10 jali-pattern transition-all duration-300',
    viewMode === 'mobile' ? 'fixed inset-y-0 left-0 z-50 w-[280px]' : '',
    viewMode === 'tablet' ? 'w-[80px]' : '',
    viewMode === 'desktop' ? (collapsed ? 'w-[80px]' : 'w-[280px]') : '',
    sidebarMode === 'icon' && viewMode !== 'mobile' ? 'w-[80px]' : 'w-[280px]'
  );

  // Render mobile overlay
  const mobileOverlay = viewMode === 'mobile' && mobileOpen && (
    <div 
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setMobileOpen(false)}
    />
  );

  const sidebarContent = (
    <>
      {/* Logo & Toggle Header */}
      <div className="p-4 border-b border-white/10">
        {/* When collapsed - show only expand button */}
        {collapsed ? (
          <div className="flex items-center justify-center">
            <button
              onClick={cycleMode}
              className="p-3 rounded-lg hover:bg-white/10 transition-all"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        ) : (
          /* When expanded - show logo + toggle button */
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
            <button
              onClick={cycleMode}
              className="p-2 rounded-lg hover:bg-white/10 transition-all"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Mobile Menu Button */}
        {viewMode === 'mobile' && (
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-all"
            title={mobileOpen ? 'Close Menu' : 'Open Menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Restaurant Selector */}
      {restaurant && (viewMode === 'mobile' || !collapsed) && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-card/50">
            <Store className="w-4 h-4 text-accent" />
            <span className="text-sm truncate">{restaurant.name}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={clsx(
        'flex-1 p-2 overflow-y-auto',
        viewMode === 'mobile' || !collapsed ? 'space-y-1' : 'space-y-2'
      )}>
        {navItems.map((item) => {
          if (user?.role === 'admin') {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => viewMode === 'mobile' && setMobileOpen(false)}
                className={({ isActive }) =>
                  clsx('nav-item', isActive && 'nav-item-active')
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {(viewMode === 'mobile' || !collapsed) && <span>{item.label}</span>}
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
              onClick={() => viewMode === 'mobile' && setMobileOpen(false)}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'nav-item-active')
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(viewMode === 'mobile' || !collapsed) && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        {viewMode === 'mobile' || !collapsed ? (
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
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOverlay}

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {sidebarContent}
      </aside>
    </>
  );
}