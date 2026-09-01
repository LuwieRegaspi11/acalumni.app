import { useAuth } from '../AuthContext';
import TracerResponsesView from '../shared/TracerResponsesView';

// ================= [FACULTY: FACULTYTRACERRESPONSES] =================
// Thin wrapper — the actual screen lives in shared/TracerResponsesView.tsx
// so faculty gets the exact same Tracer Responses analytics UI as admin,
// just locked to this faculty member's own department. Same pattern as
// FacultyDonationMonitor.tsx — see that file's header comment.
export default function FacultyTracerResponses() {
  const { user } = useAuth();
  // TracerResponsesView treats an *unset* department prop as "admin,
  // unrestricted" — never pass it a possibly-undefined department, or a
  // faculty account with no department assigned would silently fall
  // through to seeing every department's responses instead of none.
  if (!user?.department) {
    return (
      <div className="flex flex-col items-center py-14 text-center text-sm text-gray-500">
        Your account has no department assigned yet — contact an administrator for access to Tracer Responses.
      </div>
    );
  }
  return <TracerResponsesView department={user.department} />;
}
