// =====================================================================
// ADMIN DASHBOARD — top-level page for the "admin" role.
// Renders DashboardLayout (the header + sidebar) and routes between
// all the admin/* sub-pages imported below.
// =====================================================================

// -- 1. React & routing ----------------------------------------------
import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';

// -- 2. App-wide context/state (auth, dark mode, notifications, etc.) -
import { useAuth } from './AuthContext';
import { useDarkMode } from './shared/DarkModeContext';
import { useNotifications } from './shared/NotificationContext';
import { useDonations, isCampaignLive } from './shared/DonationContext';
import { useEvents } from './shared/EventsContext';
import { supabase } from '../../lib/supabaseClient';

// -- 3. Icons (lucide-react) — used throughout the sidebar/nav & UI ---
import { Users, TrendingUp, DollarSign, FileText, Calendar, LogOut, BarChart3, Shield, Bell, UserCheck, UserCog, ChevronRight, Menu, X, Megaphone, Building2, Settings, BookOpen, Sun, Moon, User, ClipboardList } from 'lucide-react';

// -- 5. Shared components (reused across admin/alumni/faculty/rep) ----
import NotificationPanel from './shared/NotificationPanel';
import JobBoard from './shared/JobBoard';
import ProfilePage from './shared/ProfilePage';

// -- 6. Admin-only sub-pages (one file per sidebar item, routed below) -
import AlumniManagement from './admin/AlumniManagement';
import AnnouncementManagement from './admin/AnnouncementManagement';
import AuditLogs from './admin/AuditLogs';
import BatchRepresentatives from './admin/BatchRepresentatives';
import DepartmentManagement from './admin/DepartmentManagement';
import DonationManagement from './admin/DonationManagement';
import EventManagement from './admin/EventManagement';
import PendingRegistrations from './admin/PendingRegistrations';
import PopulationAnalytics from './admin/PopulationAnalytics';
import Reports from './admin/Reports';
import SystemSettings from './admin/SystemSettings';
import TracerSurveys from './admin/TracerSurveys';
import TracerResponses from './admin/TracerResponses';
import UserAccountManagement from './admin/UserAccountManagement';

// HEADER / SIDEBAR COLOR FOR THE ADMIN ROLE — edit these two lines
// to change the header bar, active-nav-item, and accent color shown
// only when logged in as admin. (Global site colors live in
// src/styles/theme.css instead.)
const ACCENT = 'linear-gradient(135deg, #1B3A6B 0%, #2B5BA8 100%)';
const ACCENT_COLOR = '#2B5BA8';
// Lighter variant used only for the active sidebar nav highlight in dark mode —
// the regular ACCENT gradient is too dark against the dark sidebar background.
const ACCENT_DARK = 'linear-gradient(135deg, #2B5BA8 0%, #5B9BD5 100%)';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" />, path: '' },
    ]
  },
  {
    label: 'Alumni',
    items: [
      { label: 'Alumni Management',      icon: <Users className="w-4 h-4" />,    path: 'alumni' },
      { label: 'Pending Registrations',  icon: <UserCheck className="w-4 h-4" />, path: 'registrations' },
      { label: 'Batch Representatives',  icon: <UserCog className="w-4 h-4" />,  path: 'representatives' },
      { label: 'Population Analytics',   icon: <TrendingUp className="w-4 h-4" />,path: 'analytics' },
    ]
  },
  {
    label: 'Programs',
    items: [
{ label: 'Donation Center',  icon: <DollarSign className="w-4 h-4" />, path: 'donations' },
      { label: 'Events / Calendar',icon: <Calendar className="w-4 h-4" />,   path: 'events' },
      { label: 'Announcements',    icon: <Megaphone className="w-4 h-4" />,  path: 'announcements' },
      { label: 'Job Board',        icon: <BookOpen className="w-4 h-4" />,   path: 'jobs' },
      { label: 'Tracer Surveys',   icon: <FileText className="w-4 h-4" />,   path: 'surveys' },
      { label: 'Tracer Responses', icon: <ClipboardList className="w-4 h-4" />, path: 'tracer-responses' },
    ]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Department Management', icon: <Building2 className="w-4 h-4" />, path: 'departments' },
      { label: 'Reports & Analytics',   icon: <BarChart3 className="w-4 h-4" />, path: 'reports' },
      { label: 'Audit Logs',            icon: <Shield className="w-4 h-4" />,    path: 'audit' },
      { label: 'System Settings',       icon: <Settings className="w-4 h-4" />,  path: 'settings' },
    ]
  }
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true, Alumni: true, Programs: true, Administration: true
  });

  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    let active = true;
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'alumni')
      .eq('registration_status', 'pending')
      .then(({ count }) => { if (active) setPendingCount(count || 0); });
    return () => { active = false; };
  }, []);

  const dropRef = useRef<HTMLDivElement>(null);
  const notifCount = unreadCount('admin');

  const handleLogout = () => { logout(); navigate('/login'); };
  const currentPath = location.pathname.replace('/admin', '').replace(/^\//, '');
  const handleNav = (path: string) => { navigate(`/admin/${path}`); setMobileOpen(false); };
  const isActive = (path: string) => path === '' ? currentPath === '' : currentPath === path;
  const toggleGroup = (label: string) => setOpenGroups(g => ({ ...g, [label]: !g[label] }));

  const avatarSrc = user?.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Admin')}&background=1B3A6B&color=fff&bold=true`;

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
            <button onClick={() => setProfileDropOpen(o => !o)}
              className={`flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl transition-colors ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
              <img src={avatarSrc} alt={user?.name}
                className="w-8 h-8 rounded-full object-cover border-2"
                style={{ borderColor: ACCENT_COLOR }}
                onError={(e) => { (e.target as HTMLImageElement).src = avatarSrc; }} />
              <div className="text-left hidden sm:block">
                <p className={`text-xs font-bold leading-tight ${dark ? 'text-white' : 'text-gray-800'}`}>{user?.name}</p>
                <p className={`text-[10px] leading-tight capitalize ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.role}</p>
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
                  <div className="mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white capitalize" style={{ background: ACCENT }}>{user?.role}</span>
                  </div>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button onClick={() => { navigate('/admin/profile'); setProfileDropOpen(false); }}
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

      {/* -- BODY -- */}
      <div className="flex flex-1 overflow-hidden">

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

          {/* Mobile header */}
          {mobileOpen && (
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ background: ACCENT }}>
              <span className="text-white text-sm font-bold">Admin Portal</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="mb-1">
                {!collapsed && (
                  <button onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                    <span>{group.label}</span>
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${openGroups[group.label] ? 'rotate-90' : ''}`} />
                  </button>
                )}
                <div className={`space-y-0.5 overflow-hidden transition-all duration-200 ${!collapsed && !openGroups[group.label] ? 'max-h-0' : 'max-h-96'}`}>
                  {group.items.map(item => {
                    const active = isActive(item.path);
                    return (
                      <button key={item.path} onClick={() => handleNav(item.path)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                          ${active ? 'text-white shadow-md' : dark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                        `}
                        style={active ? { background: dark ? ACCENT_DARK : ACCENT } : {}}>
                        <span className={`flex-shrink-0 ${active ? 'text-white' : dark ? 'text-gray-400' : 'text-gray-500'}`}>{item.icon}</span>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.path === 'registrations' && pendingCount > 0 && (
                        <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                        {pendingCount}
                        </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* -- CONTENT AREA -- */}
        <main className={`flex-1 min-w-0 w-full overflow-auto p-3 sm:p-4 lg:p-6 ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <Routes>
            <Route index element={<DashboardOverview onNavigate={handleNav} />} />
            <Route path="profile"       element={<ProfilePage />} />
            <Route path="registrations" element={<PendingRegistrations />} />
            <Route path="representatives" element={<BatchRepresentatives />} />
            <Route path="analytics"     element={<PopulationAnalytics />} />
            <Route path="alumni"        element={<AlumniManagement />} />
            <Route path="donations"     element={<DonationManagement />} />
            {/* Old dedicated sidebar page — scheduled campaigns now live as
                the "Scheduled" sub-filter under Donation Center's Campaigns
                tab. Keep the route alive (bookmarks, old links) by bouncing
                to Donation Center. */}
            <Route path="scheduled-campaigns" element={<Navigate to="/admin/donations" replace />} />
            <Route path="events"        element={<EventManagement />} />
            <Route path="announcements" element={<AnnouncementManagement />} />
            <Route path="jobs"          element={<JobBoard role="admin" userName={user?.name} />} />
            <Route path="surveys"       element={<TracerSurveys />} />
            <Route path="tracer-responses" element={<TracerResponses />} />
            <Route path="departments"   element={<DepartmentManagement />} />
            <Route path="users"         element={<UserAccountManagement />} />
            <Route path="reports"       element={<Reports />} />
            <Route path="audit"         element={<AuditLogs />} />
            <Route path="settings"      element={<SystemSettings />} />
          </Routes>
        </main>
      </div>

      <NotificationPanel role="admin" open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

function DashboardOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { donations, campaigns } = useDonations();
  const { events } = useEvents();

  const [counts, setCounts] = useState({
    totalAlumni: 0,
    pendingRegistrations: 0,
    surveyResponses: 0,
    departments: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [departmentDist, setDepartmentDist] = useState<{ dept: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [
        { count: totalAlumni },
        { count: pendingRegistrations },
        { count: surveyResponses },
        { data: deptRows },
        { data: recentProfiles },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'alumni'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'alumni').eq('registration_status', 'pending'),
        supabase.from('tracer_survey_responses').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('department').eq('role', 'alumni'),
        supabase.from('profiles').select('name, program, department, batch_year, registration_status, created_at')
          .eq('role', 'alumni').order('created_at', { ascending: false }).limit(4),
      ]);

      if (!active) return;

      const deptCounts: Record<string, number> = {};
      (deptRows || []).forEach((r: any) => {
        const key = r.department || 'Unassigned';
        deptCounts[key] = (deptCounts[key] || 0) + 1;
      });

      setCounts({
        totalAlumni: totalAlumni || 0,
        pendingRegistrations: pendingRegistrations || 0,
        surveyResponses: surveyResponses || 0,
        departments: Object.keys(deptCounts).length,
      });
      setDepartmentDist(Object.entries(deptCounts).map(([dept, count]) => ({ dept, count })));
      setRecentRegistrations(recentProfiles || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const totalDonationsVerified = donations
    .filter(d => d.status === 'Verified')
    .reduce((sum, d) => sum + d.amount, 0);

  const upcomingEventsCount = events.filter(e => e.status === 'Upcoming').length;
  const activeCampaignsCount = campaigns.filter(isCampaignLive).length;

  const stats = [
    { label: 'Total Alumni', value: counts.totalAlumni.toLocaleString(), sub: 'Registered accounts', icon: <Users className="w-5 h-5" />, color: '#2B5BA8', path: 'alumni' },
    { label: 'Total Donations', value: `₱${totalDonationsVerified.toLocaleString()}`, sub: 'Verified only', icon: <DollarSign className="w-5 h-5" />, color: '#d97706', path: 'donations' },
    { label: 'Active Campaigns', value: String(activeCampaignsCount), sub: `${campaigns.length} total`, icon: <DollarSign className="w-5 h-5" />, color: '#7c3aed', path: 'donations' },
    { label: 'Upcoming Events', value: String(upcomingEventsCount), sub: `${events.length} total`, icon: <Calendar className="w-5 h-5" />, color: '#0891b2', path: 'events' },
    { label: '', value: String(counts.pendingRegistrations), sub: 'Needs review', icon: <UserCheck className="w-5 h-5" />, color: '#dc2626', path: 'registrations' },
    { label: 'Survey Responses', value: String(counts.surveyResponses), sub: 'Total submitted', icon: <FileText className="w-5 h-5" />, color: '#1B3A6B', path: 'surveys' },
    { label: 'Departments', value: String(counts.departments), sub: 'With alumni', icon: <Building2 className="w-5 h-5" />, color: '#374151', path: 'departments' },
  ];

  const recentDonations = donations.slice(0, 4);
  const upcomingEvents = events.filter(e => e.status !== 'Completed').slice(0, 4);

  const deptColors = ['#7c3aed', '#dc2626', '#d97706', '#059669', '#0891b2', '#6b7280'];
  const totalDeptCount = departmentDist.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} onClick={() => onNavigate(s.path)}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
            style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg text-white" style={{ background: s.color }}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold text-gray-800">{loading ? '…' : s.value}</p>
            <p className="text-sm font-medium text-gray-600">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Recent Registrations</h3>
            <button onClick={() => onNavigate('registrations')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {recentRegistrations.length === 0 && <p className="text-sm text-gray-400">No registrations yet.</p>}
            {recentRegistrations.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.program || '—'} · {r.department || '—'} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.registration_status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {r.registration_status === 'pending' ? 'Pending' : 'Approved'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Recent Donations</h3>
            <button onClick={() => onNavigate('donations')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {recentDonations.length === 0 && <p className="text-sm text-gray-400">No donations yet.</p>}
            {recentDonations.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{d.alumniName}</p>
                  <p className="text-xs text-gray-400">{d.campaign} · {new Date(d.submittedAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-700">₱{d.amount.toLocaleString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${d.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Upcoming Events</h3>
            <button onClick={() => onNavigate('events')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 && <p className="text-sm text-gray-400">No upcoming events.</p>}
            {upcomingEvents.map((e, i) => (
              <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                <p className="text-sm font-semibold text-gray-800">{e.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">{e.date} · {e.department === 'All' ? 'All Alumni' : e.department}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{e.registeredCount} reg.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4">Department Distribution</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {departmentDist.length === 0 && <p className="text-sm text-gray-400 col-span-full">No alumni yet.</p>}
          {departmentDist.map((d, i) => {
            const pct = Math.round((d.count / totalDeptCount) * 100);
            const color = deptColors[i % deptColors.length];
            return (
              <div key={i} className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
                      strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>{pct}%</span>
                </div>
                <p className="font-bold text-gray-800">{d.count}</p>
                <p className="text-xs text-gray-500">{d.dept}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}