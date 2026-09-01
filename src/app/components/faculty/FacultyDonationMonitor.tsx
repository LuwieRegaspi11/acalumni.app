import { useAuth } from '../AuthContext';
import DonationManagementView from '../shared/DonationManagementView';

// ================= [FACULTY: FACULTYDONATIONMONITOR] =================
// Thin wrapper — the actual screen lives in
// shared/DonationManagementView.tsx so faculty gets the exact same
// Campaigns/Transactions UI as the admin Donation Management page
// (progress bars, donor lists, expense logging, everything), just
// locked to this faculty member's own department. See that file's
// header comment for how the `department` prop scopes things down.
export default function FacultyDonationMonitor() {
  const { user } = useAuth();
  // DonationManagementView treats an *unset* department prop as "admin,
  // unrestricted" — never pass it a possibly-undefined department, or a
  // faculty account with no department assigned would silently fall
  // through to seeing every department's data instead of none.
  if (!user?.department) {
    return (
      <div className="flex flex-col items-center py-14 text-center text-sm text-gray-500">
        Your account has no department assigned yet — contact an administrator for access to the Donation Center.
      </div>
    );
  }
  return <DonationManagementView department={user.department} />;
}
