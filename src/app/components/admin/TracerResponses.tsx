import TracerResponsesView from '../shared/TracerResponsesView';

// ================= [ADMIN: TRACER RESPONSES] =================
// Thin wrapper — the actual screen lives in shared/TracerResponsesView.tsx
// so faculty gets the exact same responses/breakdown/analytics UI, just
// locked to their own department. See that file's header comment for how
// the `department` prop scopes things down (same split as
// DonationManagement.tsx / shared/DonationManagementView.tsx).
export default function TracerResponses() {
  return <TracerResponsesView />;
}
