// =====================================================================
// ALUMNI DASHBOARD — top-level page for the "alumni" role.
// Renders DashboardLayout (the header + sidebar) and routes between
// all the alumni/* sub-pages imported below.
// =====================================================================

// -- 1. React & routing ----------------------------------------------
import { Routes, Route } from 'react-router';

// -- 2. App-wide context/state ----------------------------------------
import { useAuth } from './AuthContext';

// -- 3. Icons (lucide-react) -------------------------------------------
import { BarChart3, DollarSign, ClipboardList, Calendar, Megaphone, BriefcaseBusiness } from 'lucide-react';

// -- 4. Shared components (reused across roles) -----------------------
import DashboardLayout from './shared/DashboardLayout'; // <- the header + sidebar frame
import ProfilePage from './shared/ProfilePage';
import AnnouncementBoard from './shared/AnnouncementBoard';
import JobBoard from './shared/JobBoard';

// -- 6. Alumni-only sub-pages (one file per sidebar item, routed below) -
import AlumniDashboardHome from './alumni/AlumniDashboardHome';
import DonationPortal from './alumni/DonationPortal';
import FundTransparency from './alumni/FundTransparency';
import EventsView from './alumni/EventsView';
import TracerSurveyAlumni from './alumni/TracerSurveyAlumni';
import GraduateTracerForm from './alumni/GraduateTracerForm';

// Sidebar nav links shown for this role (label, icon, and URL path)
const NAV_ITEMS = [
  { label: 'Dashboard',              icon: <BarChart3 className="w-4 h-4" />,       path: '' },
  { label: 'Donation Center',        icon: <DollarSign className="w-4 h-4" />,       path: 'donations' },
  { label: 'Tracer Survey',          icon: <ClipboardList className="w-4 h-4" />,    path: 'surveys' },
  { label: 'Events / Calendar',      icon: <Calendar className="w-4 h-4" />,         path: 'events' },
  { label: 'Announcements',          icon: <Megaphone className="w-4 h-4" />,        path: 'announcements' },
  { label: 'Job Board',              icon: <BriefcaseBusiness className="w-4 h-4" />,path: 'jobs' },
];

export default function AlumniDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout
      title="Alumni Portal"
      basePath="alumni"
      navItems={NAV_ITEMS}
      // HEADER / SIDEBAR COLOR FOR THE ALUMNI ROLE — edit these two
      // lines to change the accent color shown only when logged in
      // as alumni. (Global site colors live in src/styles/theme.css.)
      accentColor="#2B5BA8"
      accentGradient="linear-gradient(135deg, #1B3A6B 0%, #2B5BA8 55%, #5B9BD5 100%)"
    >
      <Routes>
        <Route index element={<AlumniDashboardHome />} />
        <Route path="profile"       element={<ProfilePage />} />
        <Route path="donations"     element={<DonationPortal />} />
        <Route path="donations/transparency" element={<FundTransparency />} />
        <Route path="surveys"       element={<TracerSurveyAlumni />} />
        {/* Gate route only — no sidebar nav item points here anymore.
            App.tsx's ProtectedRoute <Navigate>s here until the Graduate
            Tracer Survey is submitted; once submitted, GraduateTracerForm.tsx
            still renders its read-only "review mode" if this route is ever
            reached directly (e.g. a stale bookmark), it's just not linked
            from the sidebar. */}
        <Route path="tracer-form"   element={<GraduateTracerForm />} />
        <Route path="events"        element={<EventsView />} />
        <Route path="announcements" element={<AnnouncementBoard role="alumni" department={user?.department} />} />
        <Route path="jobs"          element={<JobBoard role="alumni" department={user?.department} userName={user?.name} />} />
      </Routes>
    </DashboardLayout>
  );
}