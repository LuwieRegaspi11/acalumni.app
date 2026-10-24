import DonationManagementView from '../shared/DonationManagementView';

// ================= [ADMIN: DONATIONMANAGEMENT] =================
// Thin wrapper — the actual screen lives in
// shared/DonationManagementView.tsx so the screen's logic lives in one place.
// Admin renders it with no department, meaning unrestricted access to
// every department's campaigns and donations.
export default function DonationManagement() {
  return <DonationManagementView />;
}
