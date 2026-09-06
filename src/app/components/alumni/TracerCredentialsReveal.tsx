import { useState } from 'react';
import { Copy, Check, Download, ShieldAlert, KeyRound } from 'lucide-react';
import { NAVY, PANEL_GRADIENT } from '../AuthPage';

// =====================================================================
// TRACER CREDENTIALS REVEAL — the one-time "here is the generated
// login" screen. Nothing here is ever fetched again after this render;
// the password only ever exists in the tracer-intake Edge Function's
// response body for this one request (see supabase/functions/tracer-intake).
//
// Used in two places, distinguished by `audience`:
//   'self'  — alumni/PublicTracerSurveyPage.tsx, shown to the alumnus
//             themself right after their submission either creates an
//             account or resets an existing one (see
//             supabase/functions/tracer-intake's header comment).
//             `pending` reflects the resulting account's
//             registration_status: false when a roster match
//             auto-approved a brand-new account (or the reset account
//             was already approved), true otherwise — the account can
//             sign in right away either way, `pending` only affects the
//             copy. `reset` is true when the submitted email already had
//             an account and its password was just reset (identity
//             matched what was on file); false for a brand-new account.
//   'admin' — admin/PendingRegistrations.tsx's two fallback cases that
//             DO have a fresh password to relay (the common approve case
//             doesn't — see that file's header comment): account
//             creation failed back at submission time, so approving
//             creates it for the first time here instead of just
//             flipping a flag; or the submission was queued as a
//             "possible duplicate" (an existing account's email, but
//             identity that couldn't be auto-verified) and the admin's
//             approval just confirmed it's really that person, resetting
//             their password. `reset` distinguishes the two for copy.
// =====================================================================

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (very old browser, insecure context) —
      // the field is still selectable/visible for a manual copy.
    }
  };
  return (
    <button type="button" onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function TracerCredentialsReveal({
  name, email, password, audience, pending, reset, onContinue,
}: {
  name: string; email: string; password: string;
  audience: 'self' | 'admin';
  // Only meaningful for audience='self' — true when this submission
  // couldn't be auto-verified against the Alumni Roster (see the header
  // comment above).
  pending?: boolean;
  // True when this was a password reset on an already-existing account
  // rather than a brand-new one (see the header comment above) — for
  // audience='self', a self-service reset via resubmission; for
  // audience='admin', an admin-confirmed "possible duplicate" approval.
  reset?: boolean;
  onContinue: () => void;
}) {
  const downloadCredentials = () => {
    const text =
      `Asian College Alumni Portal — Sign-In Details\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Password: ${password}\n\n` +
      `Sign in at the Alumni Portal and you will be asked to set your own password on first login.\n` +
      `This file will not be shown again — keep it somewhere safe.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asian-college-alumni-login.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 space-y-5">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: PANEL_GRADIENT }}>
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {audience === 'self'
              ? (reset
                  ? (pending ? 'Password Reset — Still Pending Verification' : 'Password Reset')
                  : (pending ? 'Account Created — Pending Verification' : "You're All Set!"))
              : (reset ? 'Password Reset' : 'Account Created')}
          </h2>
          <p className="text-gray-500 leading-relaxed max-w-sm">
            {audience === 'self'
              ? (reset
                  ? `We found your existing account and verified your identity from this submission, ${name.split(' ')[0]} — your password has been reset. ${pending ? "It's still awaiting verification by the Alumni Office, so signing in will show a status page for now." : 'You can sign in with it right away.'}`
                  : (pending
                      ? `We couldn't automatically verify your info against our alumni records, ${name.split(' ')[0]}, but your account has been created. Sign in below to check your status — the Alumni Office will review it, usually quickly.`
                      : `Your info matched an alumni record, so your account is ready right away, ${name.split(' ')[0]}.`))
              : (reset
                  ? `You confirmed ${name} is the account holder, so their password has been reset.`
                  : `${name}'s submission is approved and their account has been created.`)}
          </p>
        </div>

        {pending && audience === 'self' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            Until it's verified, signing in will show a pending-approval status page instead of your dashboard.
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            {audience === 'self'
              ? 'This password is shown only once and cannot be retrieved again. Copy or download it now before you continue.'
              : "This password is shown only once and cannot be retrieved again. Copy, download, or write it down now to relay to the alumnus — it won't be recoverable from the system afterward."}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Email</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 font-mono truncate">{email}</div>
              <CopyButton value={email} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Password</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 font-mono truncate">{password}</div>
              <CopyButton value={password} />
            </div>
          </div>
        </div>

        <button onClick={downloadCredentials}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors hover:bg-gray-50"
          style={{ borderColor: NAVY, color: NAVY }}>
          <Download className="w-4 h-4" /> Download as a text file
        </button>

        <p className="text-xs text-gray-400 text-center">
          {audience === 'self'
            ? "You'll be asked to set your own password the first time you sign in."
            : 'The alumnus will be asked to set their own password the first time they sign in.'}
        </p>

        <button onClick={onContinue}
          className="w-full px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
          style={{ background: PANEL_GRADIENT }}>
          {audience === 'self' ? 'Continue to Sign In' : 'Done'}
        </button>
      </div>
    </div>
  );
}
