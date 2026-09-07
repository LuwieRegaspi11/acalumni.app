// =====================================================================
// AUTH PAGE — the Sign In page ("/login"). Self-service registration
// used to live here too (a Sign Up form, plus Google/Facebook/LinkedIn
// OAuth buttons that created an account just as directly) — both are
// retired. Every alumni account is now created only by the
// `tracer-intake` Edge Function, either automatically when a public
// Alumni Tracer Survey submission (/tracer-survey) matches the Alumni
// Roster, or when an admin approves a non-matching submission in
// Pending Registrations. See supabase/alumni_tracer_intake.sql and
// alumni/PublicTracerSurveyPage.tsx.
//
// Its own header/branding panel and colors live in this file only.
// =====================================================================

// -- React & routing ---------------------------------------------------
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

// -- App-wide context/state ----------------------------------------------
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { PROGRAMS_BY_DEPT as PROGRAMS } from '../../lib/academicPrograms';
import { getBatchYearOptions } from '../../lib/batchYears';

// -- Icons (lucide-react) ------------------------------------------------
import { Eye, EyeOff, ArrowLeft, Mail, Check, ClipboardList } from 'lucide-react';

// -- Local image assets --------------------------------------------------
import aaaLogo from '../../imports/AAA logo.png';

// AUTH PAGE COLORS — edit these to change the sign-in branding panel
// color. (Mirrors src/styles/theme.css brand colors.)
export const NAVY  = '#1B3A6B';
export const BLUE  = '#2B5BA8';
export const LBLUE = '#5B9BD5';
export const RED   = '#CC2200';

export const PANEL_GRADIENT = `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${LBLUE} 100%)`;

/* -- Helpers -- */
// Department/program options come from the shared catalog (see
// src/lib/academicPrograms.ts) so this list can't drift out of sync with
// the Alumni Tracer Survey, the admin's Alumni Tracer picker, or any
// other picker in the app.

// Flattened { code, name, department } list built from PROGRAMS. The
// Alumni Tracer Survey pickers derive this from PROGRAMS_BY_DEPT
// directly instead — kept here in case a future single-dropdown picker
// needs it.
export const ALL_PROGRAMS = Object.entries(PROGRAMS).flatMap(([dept, progs]) =>
  progs.map(p => ({ ...p, department: dept }))
);

// Batch (graduation) year options, newest first.
export const BATCH_YEAR_OPTIONS = getBatchYearOptions();

// Friendly full names for the department picker shown on the Alumni
// Tracer Survey and elsewhere. Matches the official Graduate Tracer
// Survey document's department names exactly (department *codes* below
// predate that document and are unchanged).
export const DEPARTMENT_LABELS: Record<string, string> = {
  CSE: 'College of Computer Studies and Engineering (CSE)',
  CTHM: 'College of Hospitality and Tourism Management (CTHM)',
  BAA: 'College of Business Administration and Accountancy (BAA)',
};

export function InputField({
  placeholder, type = 'text', value, onChange, required,
}: {
  placeholder: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  const [show, setShow]       = useState(false);
  const [focused, setFocused] = useState(false);
  const isPw    = type === 'password';
  const floated = focused || value.length > 0;

  return (
    <div className="w-full relative" style={{ paddingTop: '10px' }}>
      {/* Floating label */}
      <label
        className="absolute left-3 pointer-events-none transition-all duration-200 origin-left"
        style={{
          top: floated ? 0 : '50%',
          transform: floated ? 'translateY(-2px) scale(0.78)' : 'translateY(-50%) scale(1)',
          color: floated ? NAVY : '#9ca3af',
          fontWeight: floated ? 600 : 400,
          fontSize: '0.875rem',
          background: floated ? 'white' : 'transparent',
          paddingLeft: floated ? 4 : 0,
          paddingRight: floated ? 4 : 0,
          borderRadius: 2,
          lineHeight: 1,
          zIndex: 1,
        }}
      >
        {placeholder}{required && <span style={{ color: RED }}>*</span>}
      </label>

      <div
        className="w-full relative rounded-md border bg-white transition-all duration-200"
        style={{ borderColor: focused ? NAVY : '#d1d5db' }}
      >
        <input
          type={isPw && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=""
          required={required}
          className="w-full px-3 bg-transparent outline-none rounded-md text-sm text-gray-800"
          style={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: isPw ? '2.5rem' : '0.75rem' }}
        />
        {isPw && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// Well-formed email check (name@domain.tld) — used only to decide when
// EmailInputField shows its "verified" state below. Not a substitute for
// server-side validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Premium" email input — pill-shaped with a mail icon, a floating label,
// and a green checkmark badge that appears once the typed value is a
// well-formed email address. Used on Sign In and the "forgot password"
// email field, and on the Alumni Tracer Survey.
export function EmailInputField({
  placeholder = 'Email Address', value, onChange, required,
}: {
  placeholder?: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const isValid = EMAIL_RE.test(value.trim());
  const floated = focused || value.length > 0;
  const accent  = isValid ? '#16a34a' : focused ? NAVY : '#9ca3af';

  return (
    <div className="w-full relative" style={{ paddingTop: '10px' }}>
      {/* Floating label */}
      <label
        className="absolute pointer-events-none transition-all duration-200 origin-left"
        style={{
          left: '2.75rem',
          top: floated ? '7px' : '50%',
          transform: floated ? 'translateY(0) scale(0.78)' : 'translateY(-50%) scale(1)',
          color: floated ? accent : '#9ca3af',
          fontWeight: floated ? 600 : 400,
          fontSize: '0.875rem',
          lineHeight: 1,
          zIndex: 1,
        }}
      >
        {placeholder}{required && <span style={{ color: RED }}>*</span>}
      </label>

      <div
        className="w-full relative rounded-full border transition-all duration-200"
        style={{
          borderColor: isValid ? '#22c55e' : focused ? NAVY : '#d1d5db',
          background: isValid ? '#f0fdf4' : 'white',
        }}
      >
        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200" style={{ color: accent }} />
        <input
          type="email"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=""
          required={required}
          className="w-full bg-transparent outline-none rounded-full text-sm text-gray-800"
          style={{
            paddingLeft: '2.75rem',
            paddingRight: isValid ? '2.25rem' : '0.9rem',
            paddingTop: floated ? '17px' : '10px',
            paddingBottom: floated ? '4px' : '10px',
          }}
        />
        {isValid && (
          <div
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center animate-fade-in"
            style={{ background: '#22c55e' }}
          >
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    </div>
  );
}

// Password strength checklist — shared by PasswordStrengthField (visual
// breakdown) and isPasswordStrong (used by ChangePasswordPage.tsx to
// gate a system-generated password being replaced with a chosen one).
const PASSWORD_CHECKS: { key: string; label: string; test: (v: string) => boolean }[] = [
  { key: 'length',  label: '8 Chars', test: v => v.length >= 8 },
  { key: 'upper',   label: 'A-Z',     test: v => /[A-Z]/.test(v) },
  { key: 'lower',   label: 'a-z',     test: v => /[a-z]/.test(v) },
  { key: 'number',  label: '123',     test: v => /[0-9]/.test(v) },
  { key: 'special', label: '@#$',     test: v => /[^A-Za-z0-9]/.test(v) },
];

export function isPasswordStrong(pw: string) {
  return PASSWORD_CHECKS.every(c => c.test(pw));
}

// "Premium" password input — the plain password box plus a live
// strength meter and a checklist of the 5 requirements, each ticking
// green as it's satisfied. isPasswordStrong() (all 5 met) is what
// actually gates submission wherever this is used; this is just the
// feedback UI. Used by ChangePasswordPage.tsx's forced first-login
// password change.
export function PasswordStrengthField({
  value, onChange, required,
}: {
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [show, setShow]       = useState(false);
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  const checks      = PASSWORD_CHECKS.map(c => ({ ...c, met: c.test(value) }));
  const passedCount = checks.filter(c => c.met).length;
  const strength =
    value.length === 0 ? null :
    passedCount <= 2   ? { label: 'Weak', color: '#dc2626' } :
    passedCount <= 4   ? { label: 'Medium', color: '#d97706' } :
                          { label: 'Strong', color: '#16a34a' };
  const borderColor = strength ? strength.color : focused ? NAVY : '#d1d5db';

  return (
    <div className="w-full">
      <div className="w-full relative" style={{ paddingTop: '10px' }}>
        {/* Floating label */}
        <label
          className="absolute left-3 pointer-events-none transition-all duration-200 origin-left"
          style={{
            top: floated ? 0 : '50%',
            transform: floated ? 'translateY(-2px) scale(0.78)' : 'translateY(-50%) scale(1)',
            color: floated ? borderColor : '#9ca3af',
            fontWeight: floated ? 600 : 400,
            fontSize: '0.875rem',
            background: floated ? 'white' : 'transparent',
            paddingLeft: floated ? 4 : 0,
            paddingRight: floated ? 4 : 0,
            borderRadius: 2,
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          Password{required && <span style={{ color: RED }}>*</span>}
        </label>

        <div
          className="w-full relative rounded-md border-2 bg-white transition-all duration-200"
          style={{ borderColor }}
        >
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder=""
            required={required}
            className="w-full px-3 bg-transparent outline-none rounded-md text-sm text-gray-800"
            style={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '2.5rem' }}
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Strength meter + requirement checklist — only once they've started typing */}
      {value.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Password Strength</span>
            <span className="text-xs font-bold" style={{ color: strength!.color }}>{strength!.label}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(passedCount / PASSWORD_CHECKS.length) * 100}%`, background: strength!.color }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {checks.map(c => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors duration-200"
                style={{
                  background: c.met ? '#f0fdf4' : '#f9fafb',
                  color: c.met ? '#16a34a' : '#9ca3af',
                  border: `1px solid ${c.met ? '#bbf7d0' : '#e5e7eb'}`,
                }}
              >
                {c.met
                  ? <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  : <span className="w-2 h-2 rounded-full border border-gray-300 inline-block" />}
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SelectField({
  placeholder, value, onChange, disabled, children,
}: {
  placeholder: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      className="w-full px-3 py-2.5 text-sm text-gray-800 bg-white rounded-md border outline-none transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-400"
      style={{ borderColor: focused ? NAVY : '#d1d5db' }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

/* -- Toast notification -- */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className="fixed top-5 left-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white flex items-center gap-2 animate-fade-in"
      style={{ transform: 'translateX(-50%)', background: NAVY, minWidth: 260 }}
    >
      <span>🔗</span> {message}
      <button onClick={onClose} className="ml-auto text-white/60 hover:text-white text-xs">✕</button>
    </div>
  );
}

/* ======================================
   SIGN IN FORM
====================================== */
function SignInForm({ autoCheckEmail, onAutoChecked }: { autoCheckEmail?: string | null; onAutoChecked?: () => void }) {
  const { login, user } = useAuth();
  const navigate        = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent]   = useState(false);

  const [statusMode, setStatusMode]       = useState(false);
  const [statusEmail, setStatusEmail]     = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult]   = useState<{ status: string; name: string; rejection_reason?: string | null } | 'not_found' | null>(null);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect once user is set in context
  React.useEffect(() => {
    if (user) {
      if (user.role === 'alumni' && user.registrationStatus === 'pending') { navigate('/pending-approval'); return; }
      if (user.mustChangePassword) { navigate('/change-password'); return; }
      if (user.role === 'admin')          navigate('/admin');
      else if (user.role === 'alumni')    navigate('/alumni');
      else if (user.role === 'faculty')   navigate('/user');
      else if (user.role === 'representative') navigate('/representative');
    }
  }, [user, navigate]);

  // Landed here right after a Pending Verification survey outcome
  // (see PublicTracerSurveyPage.tsx) — check that email's status
  // immediately instead of making them sign in first to find out.
  // useLayoutEffect (not useEffect) so this resolves before the browser
  // paints the panel — otherwise the plain email/password form would
  // flash on screen for one frame before flipping to the status view.
  React.useLayoutEffect(() => {
    if (autoCheckEmail) {
      checkStatus(autoCheckEmail);
      onAutoChecked?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckEmail]);

  // Shared by both the manual "Check registration status" link and an
  // automatic check right after a pending/rejected sign-in attempt, so
  // both paths land on the exact same result panel.
  const checkStatus = async (emailToCheck: string) => {
    setStatusEmail(emailToCheck);
    setStatusMode(true);
    setStatusLoading(true);
    setStatusResult(null);
    const { data, error } = await supabase.rpc('check_registration_status', { p_email: emailToCheck });
    setStatusLoading(false);
    if (error || !data || data.length === 0) {
      setStatusResult('not_found');
      return;
    }
    if (data[0].status === 'approved') {
      // Already approved accounts don't need a status screen — drop
      // straight back to the normal email/password form so they just
      // sign in. Wrong credentials from there surface the usual
      // "Invalid email or password." error.
      setStatusMode(false);
      setEmail(emailToCheck);
      return;
    }
    setStatusResult(data[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const { status, detail } = await login(email, password);
    // 'pending' now signs the person in (they land on a restricted view
    // inside the app — see AlumniDashboard) so it's handled by the normal
    // redirect effect above, same as 'success'. 'rejected' and
    // 'unconfirmed' both need the dedicated status screen instead: a
    // rejected account is blocked outright, and an 'unconfirmed' result
    // means Supabase never even got to check registration_status (email
    // confirmation is blocking sign-in), so the only way to tell this
    // person what's actually going on with their account is to look it
    // up by email instead of showing a flat "wrong password".
    if (status === 'rejected' || status === 'unconfirmed') {
      await checkStatus(email);
    } else if (status === 'no_profile') {
      // Credentials were correct, but there's no profiles row for this
      // account at all (registration never finished being recorded —
      // see handle_new_user() in supabase/handle_new_user_error_logging.sql).
      // Retrying sign-in won't fix this; it needs the alumni office to
      // rebuild the account, so say so instead of a generic error.
      setError("We couldn't load your account. Please contact the Alumni Office at admin@asiancollege.edu.ph for help.");
    } else if (status === 'invalid') {
      // `detail` is only set when this ISN'T Supabase's plain "wrong
      // password" response — surface it instead of a misleading flat
      // message when something else entirely is going on.
      setError(detail ? `Sign-in failed: ${detail}` : 'Invalid email or password.');
    } else if (status === 'error') {
      // `detail` carries the real underlying reason (RLS error, timeout,
      // network failure, etc) when available — falling back to the
      // generic connectivity message only when there truly is none, so
      // this is never silently undiagnosable again.
      setError(detail ? `We couldn't reach the server to sign you in (${detail}). Please try again.` : "We couldn't reach the server to sign you in. Please check your connection and try again.");
    }
    setLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setResetError('Could not send reset email. Please check the address and try again.');
      return;
    }
    setResetSent(true);
  };

  if (statusMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 sm:px-8 py-10 text-center">
        {statusLoading && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-gray-200 mb-4 animate-spin" style={{ borderTopColor: BLUE }} />
            <p className="text-sm text-gray-400">Checking your registration status…</p>
          </>
        )}

        {!statusLoading && statusResult === 'not_found' && (
          <>
            <h2 className="text-xl font-bold mb-2" style={{ color: NAVY }}>Account Not Found</h2>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              We couldn't find a registration for {statusEmail}. Double-check your email, or take the Alumni Tracer Survey if you haven't yet.
            </p>
          </>
        )}

        {!statusLoading && statusResult && statusResult !== 'not_found' && statusResult.status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>Registration Pending</h2>
            <p className="text-xs text-gray-400 mb-4">{statusResult.name || statusEmail}</p>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              Your Alumni Tracer Survey submission is still being reviewed by the alumni office. You'll receive your sign-in details once it's verified — check back soon.
            </p>
          </>
        )}

        {!statusLoading && statusResult && statusResult !== 'not_found' && statusResult.status === 'rejected' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>Registration Not Approved</h2>
            <p className="text-xs text-gray-400 mb-4">{statusResult.name || statusEmail}</p>
            {statusResult.rejection_reason ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 max-w-xs mb-6 text-left">
                <p className="font-semibold mb-1">Reason given by the Alumni Office:</p>
                <p>{statusResult.rejection_reason}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 max-w-xs mb-6">
                Your submission could not be verified. Please contact the alumni office for details or assistance.
              </p>
            )}
          </>
        )}

        <button type="button"
          onClick={() => { setStatusMode(false); setStatusEmail(''); setStatusResult(null); }}
          className="px-8 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg"
          style={{ background: PANEL_GRADIENT }}>
          Back to Sign In
        </button>
      </div>
    );
  }

  if (forgotMode) {
    return (
      <div className="flex flex-col items-center justify-start h-full px-5 sm:px-8 pt-16 pb-6 md:pt-6 overflow-y-auto">
        <h2 className="text-2xl mb-3 mt-2" style={{ color: NAVY }}>Reset Password</h2>
        <p className="text-xs text-gray-400 mb-4 text-center max-w-xs">
          Enter your account email and we'll send you a link to reset your password.
        </p>

        {resetSent ? (
          <div className="w-full text-center space-y-4">
            <div className="w-full px-3 py-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              Check your inbox — we've sent a password reset link to {resetEmail}.
            </div>
            <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(''); }}
              className="text-xs font-semibold" style={{ color: BLUE }}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit} className="w-full space-y-3">
            {resetError && (
              <div className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
                {resetError}
              </div>
            )}
            <InputField placeholder="Email Address" type="email" value={resetEmail} onChange={setResetEmail} required />
            <div className="flex justify-center pt-1">
              <button type="submit" disabled={resetLoading}
                className="px-10 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
                style={{ background: PANEL_GRADIENT }}>
                {resetLoading ? 'SENDING…' : 'SEND RESET LINK'}
              </button>
            </div>
            <div className="text-center pt-1">
              <button type="button" onClick={() => setForgotMode(false)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start h-full px-5 sm:px-8 pt-10 pb-6 overflow-y-auto">
      <img src={aaaLogo} alt="Asian College" className="w-32 h-32 object-contain" style={{ marginBottom: '-12px' }} />
      <h2 className="text-2xl mb-1" style={{ color: NAVY }}>Sign In</h2>
      <p className="text-xs text-gray-400 mb-6">Use the email and password from your Alumni Tracer Survey confirmation</p>

      {error && (
        <div className="w-full mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <InputField placeholder="Email Address" type="email" value={email}
          onChange={setEmail} required />
        <InputField placeholder="Password" type="password" value={password}
          onChange={setPassword} required />

        <div className="text-center">
          <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Forgot your password?
          </button>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
            style={{ background: PANEL_GRADIENT }}
          >
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ======================================
   MAIN AUTH PAGE
====================================== */
export default function AuthPage() {
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState('');
  const [autoCheckEmail, setAutoCheckEmail] = useState<string | null>(null);

  const showToast = (msg: string) => setToast(msg);

  // Landed back here from a failed sign-in attempt, or from the Alumni
  // Tracer Survey's "Pending Verification" outcome screen — surface
  // whatever it wants shown instead of leaving it looking like nothing
  // happened. Strip the param right away so refreshing/sharing the URL
  // doesn't re-show it.
  React.useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    const checkEmail = searchParams.get('check_email');
    if (oauthError) {
      showToast(oauthError);
      const next = new URLSearchParams(searchParams);
      next.delete('oauth_error');
      setSearchParams(next, { replace: true });
    }
    if (checkEmail) {
      setAutoCheckEmail(checkEmail);
      const next = new URLSearchParams(searchParams);
      next.delete('check_email');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: '#f0f4f8' }}
    >
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Back to home */}
      <div className="mb-4 ml-auto mr-auto flex gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors self-start" style={{ maxWidth: '860px', width: '100%' }}>
        <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>
      </div>

      {/* -- The Card -- */}
      <div
        className="relative bg-white shadow-2xl overflow-hidden w-full flex flex-col md:flex-row"
        style={{
          maxWidth: '860px',
          minHeight: 'min(560px, 92vh)',
          borderRadius: '16px',
        }}
      >
        {/* -- Sign In form -- */}
        <div className="w-full md:w-1/2">
          <SignInForm autoCheckEmail={autoCheckEmail} onAutoChecked={() => setAutoCheckEmail(null)} />
        </div>

        {/* -- Branding / survey CTA panel -- */}
        <div
          style={{ background: PANEL_GRADIENT }}
          className="hidden md:flex relative w-1/2 flex-col items-center justify-start p-10 text-center"
        >
          {/* Decorative circles */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-15%', right: '-10%' }} />
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: '-10%', left: '-8%' }} />
            <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '40%', right: '15%' }} />
          </div>

          <h2 style={{ color: 'white', fontSize: '1.5rem', marginTop: 160, marginBottom: '0.75rem' }}>New Here?</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '2rem', maxWidth: 240 }}>
            There's no separate sign-up — take the Alumni Tracer Survey and we'll set up your account for you.
          </p>
          <button
            onClick={() => navigate('/tracer-survey')}
            className="flex items-center gap-2"
            style={{
              padding: '0.6rem 2rem',
              border: '2px solid white',
              borderRadius: 999,
              background: 'transparent',
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s',
              letterSpacing: '0.05em',
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ClipboardList className="w-4 h-4" /> TAKE THE SURVEY
          </button>
        </div>
      </div>

      {/* Mobile-only survey CTA (branding panel above is md+ only) */}
      <button onClick={() => navigate('/tracer-survey')}
        className="md:hidden mt-4 flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
        <ClipboardList className="w-4 h-4" /> New here? Take the Alumni Tracer Survey
      </button>

      {/* Footer note */}
      <p className="mt-5 text-xs text-gray-400 text-center">
        Asian College Alumni Tracer & Donation System · RA 10173 Compliant
      </p>
    </div>
  );
}
