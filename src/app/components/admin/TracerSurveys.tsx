import TracerSurveysView from '../shared/TracerSurveysView';

// ================= [ADMIN: TRACER SURVEYS] =================
// Thin wrapper — the actual screen lives in shared/TracerSurveysView.tsx
// so faculty gets the exact same create/deploy/close UI, just locked to
// their own department. See that file's header comment for how the
// `department` prop scopes things down (same split as
// DonationManagement.tsx / shared/DonationManagementView.tsx).
export default function TracerSurveys() {
  return <TracerSurveysView />;
}
