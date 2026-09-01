// -- 1. React & routing ----------------------------------------------
import { Routes, Route, Navigate } from 'react-router';

// -- 2. App-wide context/state ----------------------------------------
import { useAuth } from './AuthContext';

// -- 3. Icons (lucide-react) -------------------------------------------
import { BarChart3, Users, DollarSign, FileText, ClipboardList, Calendar, Megaphone, BriefcaseBusiness } from 'lucide-react';

// -- 4. Shared components (reused across roles) -----------------------
import DashboardLayout from './shared/DashboardLayout';
import ProfilePage from './shared/ProfilePage';
import EventCalendar from './shared/EventCalendar';
import AnnouncementBoard from './shared/AnnouncementBoard';
import JobBoard from './shared/JobBoard';
import { FacultyDashboardHome } from './shared/RoleDashboardHome';

// -- 5. Faculty-only sub-pages (routed below) --------------------------
import FacultyDonationMonitor from './faculty/FacultyDonationMonitor';
import FacultyAlumniManagement from './faculty/FacultyAlumniManagement';
import FacultyTracerSurveys from './faculty/FacultyTracerSurveys';
import FacultyTracerResponses from './faculty/FacultyTracerResponses';

// Sidebar nav links shown for this role (label, icon, and URL path).
// Mirrors AdminDashboard's "Alumni" + "Programs" nav groupings/labels
// (Alumni Management, Tracer Surveys, Tracer Responses) so faculty gets
// a recognizably identical set of tools, just department-scoped — see
// each faculty/* page's own header comment for how that scoping works.
const NAV_ITEMS = [
  { label: 'Dashboard',         icon: <BarChart3 className="w-4 h-4" />,        path: '' },
  { label: 'Alumni Management', icon: <Users className="w-4 h-4" />,             path: 'alumni' },
  { label: 'Donation Center',   icon: <DollarSign className="w-4 h-4" />,        path: 'donations' },
  { label: 'Tracer Surveys',    icon: <FileText className="w-4 h-4" />,          path: 'surveys' },
  { label: 'Tracer Responses',  icon: <ClipboardList className="w-4 h-4" />,     path: 'tracer-responses' },
  { label: 'Events / Calendar', icon: <Calendar className="w-4 h-4" />,          path: 'calendar' },
  { label: 'Announcements',     icon: <Megaphone className="w-4 h-4" />,         path: 'announcements' },
  { label: 'Job Board',         icon: <BriefcaseBusiness className="w-4 h-4" />, path: 'jobs' },
];

export default function UserDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      title="Faculty Portal"
      subtitle={`Welcome, ${user?.name} — ${user?.department} Dept.`}
      basePath="user"
      navItems={NAV_ITEMS}
      // HEADER / SIDEBAR COLOR FOR THE FACULTY ROLE — edit these
      // two lines to change the accent color shown only when logged
      // in as faculty. (Global site colors live in src/styles/theme.css.)
      accentColor="#2B5BA8"
      accentGradient="linear-gradient(135deg, #1B3A6B 0%, #2B5BA8 55%, #5B9BD5 100%)"
    >
      <Routes>
        <Route index          element={<FacultyDashboardHome />} />
        <Route path="profile"       element={<ProfilePage />} />
        <Route path="alumni"        element={<FacultyAlumniManagement />} />
        {/* Old path — kept alive for bookmarks/old links, same trick
            AdminDashboard.tsx uses for scheduled-campaigns -> donations. */}
        <Route path="directory"     element={<Navigate to="/user/alumni" replace />} />
        <Route path="donations"     element={<FacultyDonationMonitor />} />
        <Route path="surveys"       element={<FacultyTracerSurveys />} />
        <Route path="tracer-responses" element={<FacultyTracerResponses />} />
        <Route path="calendar"      element={<FacultyCalendar />} />
        <Route path="announcements" element={<AnnouncementBoard role="faculty" department={user?.department} />} />
        <Route path="jobs"          element={<JobBoard role="faculty" department={user?.department} userName={user?.name} />} />
      </Routes>
    </DashboardLayout>
  );
}

function FacultyCalendar() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Events / Calendar</h2>
        <p className="text-sm text-gray-500">Manage events for <strong>{user?.department}</strong> department. All events are visible on the shared calendar.</p>
      </div>
      <EventCalendar department={user?.department} canCreate={true} createdBy="faculty" />
    </div>
  );
}
