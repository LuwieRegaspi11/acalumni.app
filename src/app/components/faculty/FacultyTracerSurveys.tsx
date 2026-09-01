import { useAuth } from '../AuthContext';
import TracerSurveysView from '../shared/TracerSurveysView';

// ================= [FACULTY: FACULTYTRACERSURVEYS] =================
// Thin wrapper — the actual screen lives in shared/TracerSurveysView.tsx
// so faculty gets the exact same create/deploy/close Tracer Surveys UI
// as admin, just locked to this faculty member's own department. Same
// pattern as FacultyDonationMonitor.tsx — see that file's header comment.
export default function FacultyTracerSurveys() {
  const { user } = useAuth();
  // TracerSurveysView treats an *unset* department prop as "admin,
  // unrestricted" — never pass it a possibly-undefined department, or a
  // faculty account with no department assigned would silently fall
  // through to seeing/managing every department's surveys instead of none.
  if (!user?.department) {
    return (
      <div className="flex flex-col items-center py-14 text-center text-sm text-gray-500">
        Your account has no department assigned yet — contact an administrator for access to Tracer Surveys.
      </div>
    );
  }
  return <TracerSurveysView department={user.department} />;
}
