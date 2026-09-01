import AlumniManagementView from '../shared/AlumniManagementView';

// ================= [ADMIN: ALUMNI MANAGEMENT] =================
// Thin wrapper — the actual screen lives in shared/AlumniManagementView.tsx
// so faculty gets the exact same search/filter/edit/verify/monitoring UI,
// just locked to their own department. See that file's header comment for
// how the `department` prop scopes things down (same split as
// DonationManagement.tsx / shared/DonationManagementView.tsx).
export default function AlumniManagement() {
  return <AlumniManagementView />;
}
