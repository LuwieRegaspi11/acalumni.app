// =====================================================================
// APP — top-level routing map for the whole site.
// This is where every URL is wired to the page component that
// renders it, and where all the app-wide context providers
// (auth, dark mode, events, donations, notifications, job board)
// are stacked around the app once.
// =====================================================================

// -- React & routing ---------------------------------------------------
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";

// -- Third-party UI library (Material UI theme bridge) ----------------
import { ThemeProvider, createTheme } from "@mui/material/styles";

// -- Pages (one per route, see <Routes> below) -------------------------
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import AuthCallback from "./components/AuthCallback";
import CompleteProfilePage from "./components/CompleteProfilePage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import PendingApprovalPage from "./components/PendingApprovalPage";
import TermsPage from "./components/TermsPage";
import AdminDashboard from "./components/AdminDashboard";
import AlumniDashboard from "./components/AlumniDashboard";
import UserDashboard from "./components/UserDashboard";
import RepresentativeDashboard from "./components/RepresentativeDashboard";

// -- App-wide context providers (wrap the whole app, see bottom of file) -
import { AuthProvider, useAuth } from "./components/AuthContext";
import { DarkModeProvider, useDarkMode } from "./components/shared/DarkModeContext";
import { EventsProvider } from "./components/shared/EventsContext";
import { DonationProvider } from "./components/shared/DonationContext";
import { NotificationProvider } from "./components/shared/NotificationContext";
import { JobBoardProvider } from "./components/shared/JobBoardContext";
import { AnnouncementProvider } from "./components/shared/AnnouncementContext";
import { supabase } from "../lib/supabaseClient";

// Graduate Tracer Survey gate — checked once the alumni's (or batch
// representative's — a rep is an alumnus first, per the "Alumni-side
// pages a rep gets too" comment in RepresentativeDashboard.tsx) own row
// loads, then re-checked on every navigation away from the survey route
// until it comes back 'submitted' (see GraduateTracerForm.tsx / the
// graduate_tracer_responses table in supabase/graduate_tracer_survey.sql).
// 'submitted' is treated as sticky and short-circuits further checks so
// an already-done alumni/rep never re-hits the DB on every nav.
//
// GraduateTracerForm's "Continue to Dashboard" button navigates with
// `state: { tracerJustSubmitted: true }` on that one history entry —
// read synchronously here (not just via the effect below) so the very
// render that processes that navigation already treats the survey as
// submitted, instead of gating on a still-'draft' cached status for one
// render and bouncing the alumni/rep straight back to the form.
const TRACER_GATED_ROLES = ["alumni", "representative"];

function useTracerGateStatus(
  user: ReturnType<typeof useAuth>["user"],
  location: ReturnType<typeof useLocation>
) {
  const pathname = location.pathname;
  const justSubmitted = (location.state as { tracerJustSubmitted?: boolean } | null)?.tracerJustSubmitted === true;
  const [status, setStatus] = React.useState<"draft" | "submitted" | null | undefined>(undefined);

  React.useEffect(() => {
    if (!user || !TRACER_GATED_ROLES.includes(user.role) || user.registrationStatus !== "approved") {
      setStatus(undefined);
      return;
    }
    if (justSubmitted) {
      setStatus("submitted");
      return;
    }
    if (status === "submitted") return;
    let active = true;
    supabase
      .from("graduate_tracer_responses")
      .select("status")
      .eq("respondent_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setStatus(data?.status ?? null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.registrationStatus, pathname, justSubmitted]);

  return justSubmitted ? "submitted" : status;
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const tracerStatus = useTracerGateStatus(user, location);

  // Accounts now come from Supabase, so restoring a session on page
  // load is an async check — wait for it instead of redirecting to
  // /login while it's still in flight.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Pending accounts get a dedicated notice page instead of the
  // dashboard — see PendingApprovalPage.tsx. Only alumni registrations
  // go through admin review; faculty/representative accounts are
  // auto-approved on signup (see handle_new_user() in
  // registration_simplification.sql), so a stale/incorrect pending
  // status on one of those roles should never gate them out here.
  if (user.role === "alumni" && user.registrationStatus === "pending") {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Graduate Tracer Survey gate — every /alumni/* or /representative/*
  // path except that role's own survey route is locked until the first
  // login after approval's mandatory tracer survey is submitted. Reps are
  // gated too (a rep is an alumnus first — see TRACER_GATED_ROLES above).
  // Re-fires on every login (and every nav, per useTracerGateStatus above)
  // until status='submitted'.
  if (
    TRACER_GATED_ROLES.includes(user.role) &&
    user.registrationStatus === "approved" &&
    tracerStatus !== undefined &&
    tracerStatus !== "submitted" &&
    !location.pathname.startsWith(`/${user.role}/tracer-form`)
  ) {
    return <Navigate to={`/${user.role}/tracer-form`} replace />;
  }

  return <>{children}</>;
}

// Bridges our app-wide dark mode toggle into MUI's own theming system,
// so MUI components (TextField, Select, Chip, Card, Button, etc.) switch
// palettes instead of staying stuck on MUI's light-mode defaults.
function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const { dark } = useDarkMode();
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: dark ? "dark" : "light",
          ...(dark && {
            background: { default: "#0d1117", paper: "#1a2332" },
          }),
        },
      }),
    [dark]
  );
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <DarkModeProvider>
      <MuiThemeBridge>
      <EventsProvider>
      <DonationProvider>
      <NotificationProvider>
      <JobBoardProvider>
      <AnnouncementProvider>
        <Routes>
          {/* -- Public / auth routes -- */}
          <Route path="/login" element={<AuthPage initialMode="signin" />} />
          <Route path="/register" element={<AuthPage initialMode="signup" />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route
            path="/unauthorized"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-4xl mb-4">
                    Unauthorized Access
                  </h1>
                  <p className="text-gray-600">
                    You don't have permission to access this
                    page.
                  </p>
                </div>
              </div>
            }
          />
          {/* -- Role-protected dashboards (each has its own header color, see that file) -- */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alumni/*"
            element={
              <ProtectedRoute allowedRoles={["alumni"]}>
                <AlumniDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/*"
            element={
              <ProtectedRoute allowedRoles={["faculty"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/representative/*"
            element={
              <ProtectedRoute allowedRoles={["representative"]}>
                <RepresentativeDashboard />
              </ProtectedRoute>
            }
          />
          {/* -- Public marketing site (its own header lives inside LandingPage.tsx) -- */}
          <Route
            path="/"
            element={<LandingPage />}
          />
        </Routes>
      </AnnouncementProvider>
      </JobBoardProvider>
      </NotificationProvider>
      </DonationProvider>
      </EventsProvider>
      </MuiThemeBridge>
      </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}