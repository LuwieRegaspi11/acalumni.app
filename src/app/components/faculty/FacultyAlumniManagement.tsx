import { useAuth } from '../AuthContext';
import AlumniManagementView from '../shared/AlumniManagementView';

// ================= [FACULTY: FACULTYALUMNIMANAGEMENT] =================
// Thin wrapper — the actual screen lives in shared/AlumniManagementView.tsx
// so faculty gets the exact same Alumni Management UI as admin (search,
// filter, edit, verify, the profile+donations+tracer monitoring modal,
// export), just locked to this faculty member's own department. Same
// pattern as FacultyDonationMonitor.tsx — see that file's header comment.
export default function FacultyAlumniManagement() {
  const { user } = useAuth();
  // AlumniManagementView treats an *unset* department prop as "admin,
  // unrestricted" — never pass it a possibly-undefined department, or a
  // faculty account with no department assigned would silently fall
  // through to seeing every department's alumni instead of none.
  if (!user?.department) {
    return (
      <div className="flex flex-col items-center py-14 text-center text-sm text-gray-500">
        Your account has no department assigned yet — contact an administrator for access to Alumni Management.
      </div>
    );
  }
  return <AlumniManagementView department={user.department} />;
}
