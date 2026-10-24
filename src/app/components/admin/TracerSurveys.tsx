import TracerSurveysView from '../shared/TracerSurveysView';

// ================= [ADMIN: TRACER SURVEYS] =================
// Thin wrapper — the actual screen lives in shared/TracerSurveysView.tsx
// so the same create/deploy/close UI can be reused, just locked to
// their own department. See that file's header comment for how the
// `department` prop scopes things down (same split as
// DonationManagement.tsx / shared/DonationManagementView.tsx).
export default function TracerSurveys() {
  return <TracerSurveysView />;
}
