// =====================================================================
// DASHBOARD LAYOUT — THE SHARED HEADER + SIDEBAR FRAME
// Every logged-in page (admin/alumni/faculty/representative) renders
// its content INSIDE this component. This is the single file that
// controls the top header bar, the collapsible sidebar, and the
// mobile menu for the whole logged-in app.
//
// This file itself has no hardcoded color — each dashboard passes its
// own `accentColor` / `accentGradient` props in (see AdminDashboard.tsx,
// AlumniDashboard.tsx, UserDashboard.tsx, RepresentativeDashboard.tsx).
// The public marketing site's header lives separately, in LandingPage.tsx.
// =====================================================================

// -- React & routing ---------------------------------------------------
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';

// -- App-wide context/state ----------------------------------------------
import { useAuth } from '../AuthContext';
import { useDarkMode } from './DarkModeContext';
import { useNotifications } from './NotificationContext';

// -- Icons (lucide-react) ------------------------------------------------
import { LogOut, Menu, X, Bell, Sun, Moon, User } from 'lucide-react';

// -- Shared components ---------------------------------------------------
import NotificationPanel from './NotificationPanel';

export interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  locked?: boolean;
  lockedMessage?: string;
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  basePath: string;
  navItems: NavItem[];
  accentColor: string;
  accentGradient: string;
  notificationCount?: number;
  children: React.ReactNode;
}

export default function DashboardLayout({
  title,
  basePath,
  navItems,
  accentColor,
  accentGradient,
  children,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const notifCount = unreadCount(user?.role || '', user?.department);
  const currentPath = location.pathname.replace(`/${basePath}`, '').replace(/^\//, '');

  const avatarSrc = user?.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1B3A6B&color=fff&bold=true`;

  const handleNav = (path: string) => {
    navigate(`/${basePath}/${path}`);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    path === '' ? currentPath === '' || currentPath === basePath : currentPath === path;

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setProfileDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`dashboard-root h-screen w-full flex flex-col overflow-hidden ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Gentle glow pulse to draw the eye to the Donate button */}
      <style>{`
        @keyframes donateGlowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(43, 91, 168, 0.55); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(43, 91, 168, 0); transform: scale(1.04); }
        }
        .donate-cta-glow { animation: donateGlowPulse 2.2s ease-in-out infinite; }
        .donate-cta-glow:hover { animation-play-state: paused; }
      `}</style>

      {/* -- TOP HEADER -- */}
      <header className={`flex-shrink-0 h-14 flex items-center justify-between px-4 border-b z-40 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>

        {/* Left: hamburger/sidebar toggle + logo */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(true)} className={`lg:hidden p-2 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <Menu className="w-5 h-5" />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className={`hidden lg:flex p-2 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-shrink-0">
            <div className="font-extrabold text-base leading-tight" style={{ color: 'rgb(204, 34, 0)' }}>Asian</div>
            <div className="font-extrabold text-base leading-tight -mt-1" style={{ color: 'rgb(27, 58, 107)' }}>College</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgb(91, 155, 213)' }}>Alumni Tracer &amp; Donation System</div>
          </div>
        </div>

        {/* Right: dark mode + notifications + profile dropdown */}
        <div className="flex items-center gap-1">
          <button onClick={toggle} title={dark ? 'Light Mode' : 'Dark Mode'}
            className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => setNotifOpen(true)}
            className={`p-2 rounded-lg relative transition-colors ${dark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <Bell className="w-4 h-4" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setProfileDropOpen(o => !o)}
              className={`flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl transition-colors ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <img
                src={avatarSrc}
                alt={user?.name}
                className="w-8 h-8 rounded-full object-cover border-2"
                style={{ borderColor: accentColor }}
                onError={(e) => { (e.target as HTMLImageElement).src = avatarSrc; }}
              />
              <div className="text-left hidden sm:block">
                <p className={`text-xs font-bold leading-tight ${dark ? 'text-white' : 'text-gray-800'}`}>{user?.name}</p>
                <p className={`text-[10px] leading-tight capitalize ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.role}{user?.department ? ` · ${user.department}` : ''}</p>
              </div>
            </button>

            {profileDropOpen && (
              <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border overflow-hidden z-50 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className={`px-4 py-3 border-b ${dark ? 'border-gray-700 bg-gray-700/40' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <img src={avatarSrc} alt={user?.name} className="w-9 h-9 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = avatarSrc; }} />
                    <div className="overflow-hidden">
                      <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{user?.name}</p>
                      <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white capitalize" style={{ background: accentGradient }}>{user?.role}</span>
                    {user?.department && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${dark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-600'}`}>{user.department}</span>
                    )}
                  </div>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button onClick={() => { navigate(`/${basePath}/profile`); setProfileDropOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${dark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <User className="w-4 h-4 flex-shrink-0" /> View Profile
                  </button>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
                    <LogOut className="w-4 h-4 flex-shrink-0" /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* -- BODY: SIDEBAR + CONTENT -- */}
      <div className="flex flex-1 w-full overflow-hidden">

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* -- SIDEBAR (nav links only) -- */}
        <aside className={`
          fixed lg:static z-50 lg:z-auto top-14 lg:top-auto
          flex flex-col border-r shadow-lg lg:shadow-none
          ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          transition-all duration-300 ease-in-out
          h-[calc(100vh-3.5rem)] lg:h-full
          ${collapsed ? 'w-0 border-r-0 overflow-hidden' : 'w-[22%] min-w-[200px] max-w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>

          {/* Mobile close */}
          {mobileOpen && (
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: accentGradient }}>
              <span className="text-white text-sm font-bold">{title}</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto scrollbar-none py-3 px-2 space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => { if (!item.locked) handleNav(item.path); }}
                  disabled={item.locked}
                  title={item.locked ? (item.lockedMessage || 'Available once your account is approved') : undefined}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200
                    ${item.locked
                      ? `cursor-not-allowed ${dark ? 'text-gray-600' : 'text-gray-400'}`
                      : active ? 'text-white shadow-md' : dark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                  style={active && !item.locked ? { background: accentGradient } : {}}
                >
                  <span className={`flex-shrink-0 ${item.locked ? '' : active ? 'text-white' : dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.icon}
                  </span>
                  {item.locked ? (
                    <span className="flex-1 text-left leading-tight py-0.5">
                      <span className="block truncate">{item.label}</span>
                      <span className={`block text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Available after approval</span>
                    </span>
                  ) : (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* -- CONTENT AREA -- */}
        <main className={`flex-1 min-w-0 w-full overflow-auto p-3 sm:p-4 lg:p-6 ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {children}
        </main>
      </div>

      <NotificationPanel role={user?.role || ''} department={user?.department} open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
