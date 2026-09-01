// =====================================================================
// AUTH CALLBACK — lands here after supabase.auth.signInWithOAuth()
// bounces the user back from Google/Facebook/LinkedIn (see the
// `redirectTo` in AuthPage.tsx's SocialIcons, and this route's
// registration in App.tsx). Supabase's client picks the session up off
// the URL automatically (detectSessionInUrl, on by default) and fires
// AuthContext's onAuthStateChange listener, which fetches the profile
// row — this page just waits for that and then routes.
//
// handle_new_user() (supabase/signup_role_hardening.sql) inserts a
// profiles row for every brand-new auth.users row, OAuth included, so
// there's no real "no profile row yet" case to detect here — a fresh
// OAuth sign-in instead shows up as role 'alumni' with
// department/program/batch_year all null (the OAuth provider never
// supplies those). That's treated the same way: send them to finish
// their profile before they can be reviewed/approved.
//
// Supabase (or the provider itself) reports a failed OAuth attempt — the
// provider isn't enabled/configured, the person declined consent, the
// redirect URI doesn't match what's registered with the provider, etc —
// by redirecting back here with `?error=...&error_description=...` (or
// the same pair after a `#` for a couple of provider-side failure modes)
// instead of a session. That used to be indistinguishable from any other
// "no session" case below: this page would just spin on "Signing you
// in…" and then silently bounce back to Sign In with no explanation,
// which is exactly what "social sign-in doesn't work" looks like from
// the outside. Surface it instead.
// =====================================================================
import React from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from './AuthContext';

// Friendlier text for the couple of error_codes we can actually explain;
// anything else falls back to Supabase's own error_description.
function describeOAuthError(code: string | null, description: string | null): string {
  if (code === 'provider_email_needs_verification') {
    return "Please verify your email with the provider you signed in with, then try again.";
  }
  if (description && /not enabled|unsupported provider/i.test(description)) {
    return 'That sign-in option isn’t set up yet. Please use your email and password, or contact the Alumni Office.';
  }
  return description || 'Sign-in was cancelled or could not be completed. Please try again.';
}

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Checked first, independent of `loading`/`user` — a failed OAuth
    // attempt never produces a session, so waiting on those would just
    // delay this to the same silent "back to Sign In" outcome below.
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error = params.get('error') || hashParams.get('error');
    if (error) {
      const description = params.get('error_description') || hashParams.get('error_description');
      const code = params.get('error_code') || hashParams.get('error_code');
      const message = describeOAuthError(code, description);
      navigate(`/login?oauth_error=${encodeURIComponent(message)}`, { replace: true });
      return;
    }

    if (loading) return; // still resolving the session + profile fetch

    if (!user) {
      // No session and no error param either — consent was denied without
      // a reportable reason, or (see header) the profile lookup genuinely
      // failed. Either way there's nothing to route to; back to Sign In.
      navigate('/login', { replace: true });
      return;
    }

    const needsProfileCompletion =
      user.role === 'alumni' &&
      (!user.department || !user.program || !user.batchYear);

    if (needsProfileCompletion) {
      navigate('/complete-profile', { replace: true });
      return;
    }

    // Same role -> destination mapping as ProtectedRoute/App.tsx.
    if (user.role === 'alumni' && user.registrationStatus === 'pending') {
      navigate('/pending-approval', { replace: true });
    } else if (user.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user.role === 'faculty') {
      navigate('/user', { replace: true });
    } else if (user.role === 'representative') {
      navigate('/representative', { replace: true });
    } else {
      navigate('/alumni', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-200 animate-spin"
          style={{ borderTopColor: '#2B5BA8' }}
        />
        <p className="text-sm text-gray-400">Signing you in…</p>
      </div>
    </div>
  );
}
