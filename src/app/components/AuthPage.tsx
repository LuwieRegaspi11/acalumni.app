// =====================================================================
// AUTH PAGE — the Sign In / Sign Up page ("/login" and "/register").
// Its own header/branding panel and colors live in this file only.
// =====================================================================

// -- React & routing ---------------------------------------------------
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

// -- App-wide context/state ----------------------------------------------
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { compressImageFile } from '../../lib/image';
import { PROGRAMS_BY_DEPT as PROGRAMS } from '../../lib/academicPrograms';
import { getBatchYearOptions } from '../../lib/batchYears';

// -- Icons (lucide-react) ------------------------------------------------
import { Eye, EyeOff, CheckCircle, Camera, ArrowLeft, ArrowRight, Mail, Check } from 'lucide-react';

// -- Local image assets --------------------------------------------------
import asianCollegeLogo from '../../imports/asiancollege_logo.jpeg';

// -- Terms & Privacy Policy modal (RA 10173 agreement gate) --------------
import TermsModal from './shared/TermsModal';
import { TOS_ANCHOR, PRIVACY_ANCHOR } from '../content/TermsAndPrivacyContent';
import AddressAutocomplete from './shared/AddressAutocomplete';

// AUTH PAGE COLORS — edit these to change the sign-in/sign-up
// branding panel color. (Mirrors src/styles/theme.css brand colors.)
export const NAVY  = '#1B3A6B';
export const BLUE  = '#2B5BA8';
export const LBLUE = '#5B9BD5';
export const RED   = '#CC2200';

export const PANEL_GRADIENT = `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${LBLUE} 100%)`;

/* -- Helpers -- */
// Department/program options come from the shared catalog (see
// src/lib/academicPrograms.ts) so this list can't drift out of sync with
// the admin's Alumni Management picker or any other picker in the app.

// Flattened { code, name, department } list built from PROGRAMS so the
// signup form can offer a single "Course" dropdown and derive the
// student's department automatically from whichever program they pick.
export const ALL_PROGRAMS = Object.entries(PROGRAMS).flatMap(([dept, progs]) =>
  progs.map(p => ({ ...p, department: dept }))
);

// Batch (graduation) year options for the signup form, newest first.
export const BATCH_YEAR_OPTIONS = getBatchYearOptions();

// Friendly full names for the department picker shown before the course
// picker on the signup form. Exported so CompleteProfilePage.tsx (the
// post-OAuth-signup "finish your profile" form) can show the exact same
// picker instead of redefining it.
export const DEPARTMENT_LABELS: Record<string, string> = {
  CSE: 'Computer Science & Engineering (CSE)',
  CTHM: 'College of Tourism & Hospitality Management (CTHM)',
  BAA: 'Business Administration & Accountancy (BAA)',
};

// Friendly labels for the ID Type picker on the signup form — mirrors
// PendingRegistrations.tsx's ID_TYPE_LABELS so the admin review screen
// shows the exact same wording for whatever the registrant picked here.
export const ID_TYPE_LABELS: Record<string, string> = {
  school_id: 'Alumni ID',
  drivers_license: "Driver's License",
  passport: 'Passport',
  national_id: 'National / Philippine ID',
  voters_id: "Voter's ID",
  other: 'Other Government-Issued ID',
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
// server-side validation; Supabase Auth still rejects anything it doesn't
// accept when the form is actually submitted.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Premium" email input — pill-shaped with a mail icon, a floating label,
// and a green checkmark badge that appears once the typed value is a
// well-formed email address (any provider, not just Gmail — see mockup).
// Used everywhere someone types an account email: Sign In, Sign Up, and
// the "forgot password" email field.
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
// breakdown) and isPasswordStrong (the actual signup gate) so the chips
// shown to the user always match what's enforced on submit.
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

// "Premium" password input for Sign Up — the plain password box plus a
// live strength meter and a checklist of the 5 requirements, each ticking
// green as it's satisfied. isPasswordStrong() (all 5 met) is what actually
// gates submission in SignUpForm.validate(); this is just the feedback UI.
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

/* -- Social icon buttons -- */
// Real OAuth triggers (not links out to the providers' own websites).
// Each button calls supabase.auth.signInWithOAuth(), which redirects the
// whole page to the provider's consent screen and back to
// /auth/callback (see AuthCallback.tsx) — it does NOT open a new tab or
// resolve immediately, so there's nothing to `await` a result from here.
function SocialIcons({ onToast }: { onToast: (msg: string) => void }) {
  const socials = [
    {
      label: 'f',
      name: 'Facebook',
      provider: 'facebook' as const,
      bg: '#1877F2',
      color: '#fff',
      border: '#1877F2',
      /* SVG Facebook f */
      svg: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
        </svg>
      ),
    },
    {
      label: 'G',
      name: 'Google',
      provider: 'google' as const,
      bg: '#fff',
      color: '#444',
      border: '#dadce0',
      /* SVG Google G multicolor */
      svg: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
    },
    {
      label: 'in',
      name: 'LinkedIn',
      provider: 'linkedin_oidc' as const,
      bg: '#0A66C2',
      color: '#fff',
      border: '#0A66C2',
      /* SVG LinkedIn */
      svg: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
          <circle cx="4" cy="4" r="2"/>
        </svg>
      ),
    },
  ];

  const handleClick = async (s: typeof socials[0]) => {
    onToast(`Redirecting to ${s.name}…`);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: s.provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // A successful call navigates the whole page away immediately, so
    // this only ever runs when it failed before that redirect could
    // happen (provider not enabled/configured in Supabase Auth, etc.).
    if (error) onToast(`Could not start ${s.name} sign-in: ${error.message}`);
  };

  return (
    <div className="flex items-center justify-center gap-3 mb-3">
      {socials.map(s => (
        <button
          key={s.label}
          onClick={() => handleClick(s)}
          title={`Continue with ${s.name}`}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95"
          style={{ background: s.bg, border: `1.5px solid ${s.border}` }}
        >
          {s.svg}
        </button>
      ))}
    </div>
  );
}

/* ======================================
   SIGN IN FORM
====================================== */
function SignInForm({ onToast, autoCheckEmail, onAutoChecked }: { onSwitch: () => void; onToast: (m: string) => void; autoCheckEmail?: string | null; onAutoChecked?: () => void }) {
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
  const [statusResult, setStatusResult]   = useState<{ status: string; name: string } | 'not_found' | null>(null);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect once user is set in context
  React.useEffect(() => {
    if (user) {
      if (user.role === 'alumni' && user.registrationStatus === 'pending') { navigate('/pending-approval'); return; }
      if (user.role === 'admin')          navigate('/admin');
      else if (user.role === 'alumni')    navigate('/alumni');
      else if (user.role === 'faculty')   navigate('/user');
      else if (user.role === 'representative') navigate('/representative');
    }
  }, [user, navigate]);

  // Just came from Sign Up clicking "Go to Sign In" — check that account's
  // status immediately instead of making them sign in first to find out.
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
      // Already approved accounts (including batch reps auto-approved on
      // assignment) don't need a status screen — drop straight back to the
      // normal email/password form so they just sign in. Wrong credentials
      // from there surface the usual "Invalid email or password." error.
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
      setError("We couldn't load your account. Your registration may not have finished saving — please contact the Alumni Office at admin@asiancollege.edu.ph for help.");
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
              We couldn't find a registration for {statusEmail}. Double-check your email, or sign up if you haven't yet.
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
              Your account is still being reviewed by the alumni office. You'll be able to sign in as soon as it's approved — check back soon.
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
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              Your account registration could not be approved. Please contact the alumni office for details or assistance.
            </p>
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
                {resetLoading ? 'SENDING\u2026' : 'SEND RESET LINK'}
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
    <div className="flex flex-col items-center justify-start h-full px-5 sm:px-8 pt-16 pb-6 md:pt-6 overflow-y-auto">
      <h2 className="text-2xl mb-3 mt-2" style={{ color: NAVY }}>Sign In</h2>

      <SocialIcons onToast={onToast} />
      <p className="text-xs text-gray-400 mb-4">or use your account</p>

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
   SIGN UP FORM  (2-step — Personal info, then Account)
====================================== */
function SignUpForm({ onSwitch, onToast, onRegistered }: { onSwitch: () => void; onToast: (m: string) => void; onRegistered: (email: string) => void }) {
  const { register } = useAuth();
  const [step, setStep]       = useState(0);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileImg, setProfileImg] = useState('');
  // -- Valid-ID upload (replaces the old phone-number field) --
  // A photo of a valid ID instead of a phone number, reviewed by an admin
  // in Pending Registrations before the account is approved.
  const [idDocumentImg, setIdDocumentImg] = useState('');

  // -- Terms & Privacy Policy read-gate --
  // The agreement checkbox stays disabled until the user has actually
  // opened the modal and scrolled its content to the end (see
  // shared/TermsModal.tsx). Once true it stays true for the rest of this
  // form session, even if the modal is reopened/closed again.
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsModalAnchor, setTermsModalAnchor] = useState<typeof TOS_ANCHOR | typeof PRIVACY_ANCHOR>(TOS_ANCHOR);

  const openTermsModal = (anchor: typeof TOS_ANCHOR | typeof PRIVACY_ANCHOR) => {
    setTermsModalAnchor(anchor);
    setTermsModalOpen(true);
  };

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', address: '', idType: '',
    department: '', program: '', batchYear: '',
    password: '', confirmPassword: '', agreeToTerms: false,
  });

  const set = (field: string, value: any) => {
    setError('');
    if (field === 'department') {
      // Picking a department first narrows the course list and clears any
      // course that belonged to a different department.
      setForm(f => ({
        ...f,
        department: value,
        program: ALL_PROGRAMS.find(p => p.code === f.program)?.department === value ? f.program : '',
      }));
    } else if (field === 'program') {
      // Course/Program also (re)confirms the department, in case it was
      // picked directly without going through the department selector.
      const match = ALL_PROGRAMS.find(p => p.code === value);
      setForm(f => ({ ...f, program: value, department: match?.department || f.department }));
    } else {
      setForm(f => ({ ...f, [field]: value }));
    }
  };

  const validate = (s: number) => {
    if (s === 0) {
      if (!form.firstName || !form.lastName) return 'First and last name are required.';
      if (!form.email || !form.email.includes('@')) return 'Valid email required.';
      if (!form.address) return 'Address is required.';
      if (!form.department) return 'Select your department.';
      if (!form.program) return 'Select your course/program.';
      if (!form.batchYear) return 'Select your batch year.';
      if (!form.idType) return 'Select the type of ID you are uploading.';
      if (!idDocumentImg) return 'Upload a photo of your valid ID.';
    }
    if (s === 1) {
      if (!form.password) return 'Password is required.';
      if (!isPasswordStrong(form.password)) return 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';
      if (form.password !== form.confirmPassword) return 'Passwords do not match.';
      if (!form.agreeToTerms) return 'You must agree to the terms.';
    }
    return '';
  };

  const next = () => {
    const err = validate(step);
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  };

  const submit = async () => {
    const err = validate(1);
    if (err) { setError(err); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const result = await register({
      firstName: form.firstName, lastName: form.lastName,
      email: form.email, password: form.password, address: form.address,
      department: form.department, program: form.program,
      batchYear: Number(form.batchYear),
      idType: form.idType,
      idDocument: idDocumentImg,
      profileImage: profileImg,
    });
    setLoading(false);
    if (result.ok) setSuccess(true);
    else setError(result.error || 'Registration failed. Please try again.');
  };

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Downscaled/compressed client-side so the profile photo + ID photo
    // combined don't blow past Supabase's 1MB signUp() request cap.
    compressImageFile(file, 500, 0.7)
      .then(setProfileImg)
      .catch(() => setError('Could not process that photo. Please try a different image.'));
  };

  const handleIdDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // A bit larger than the profile photo cap so the ID's printed text
    // stays legible for the admin's review — still compressed to stay
    // well under Supabase's 1MB signUp() request cap combined.
    compressImageFile(file, 1000, 0.7)
      .then(setIdDocumentImg)
      .catch(() => setError('Could not process that photo. Please try a different image.'));
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-lg"
          style={{ background: PANEL_GRADIENT }}>
          <CheckCircle className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg mb-2" style={{ color: NAVY }}>Account Created!</h3>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-xs">
          Welcome, <strong>{form.firstName}</strong>! Your registration is pending admin approval. Sign in with <strong>{form.email}</strong>.
        </p>
        <button
          onClick={() => { setSuccess(false); setStep(0); onRegistered(form.email); }}
          className="px-8 py-2 text-sm font-bold text-white rounded-full"
          style={{ background: PANEL_GRADIENT }}
        >
          GO TO SIGN IN
        </button>
      </div>
    );
  }

  const STEP_LABELS = ['Your Info', 'Account'];

  return (
    <div className="flex flex-col h-full px-5 sm:px-8 pt-16 pb-6 md:pt-6 overflow-y-auto scrollbar-none">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl" style={{ color: NAVY }}>Create Account</h2>
        <SocialIcons onToast={onToast} />
        <p className="text-xs text-gray-400">or use your email for registration</p>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                style={{
                  background: i < step ? '#22c55e' : i === step ? NAVY : '#e5e7eb',
                  color: i <= step ? 'white' : '#9ca3af',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-[10px]" style={{ color: i === step ? NAVY : '#9ca3af' }}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="w-4 h-px" style={{ background: i < step ? '#22c55e' : '#e5e7eb' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
          {error}
        </div>
      )}

      {/* -- Step 0: Your Info -- */}
      {step === 0 && (
        <div className="space-y-2.5 flex-1">
          <div className="flex gap-2">
            <InputField placeholder="First Name" value={form.firstName} onChange={v => set('firstName', v)} required />
            <InputField placeholder="Last Name" value={form.lastName} onChange={v => set('lastName', v)} required />
          </div>
          <EmailInputField value={form.email} onChange={v => set('email', v)} required />
          <AddressAutocomplete label="Address" value={form.address} onChange={v => set('address', v)} required />

          <SelectField placeholder="Select Department" value={form.department} onChange={v => set('department', v)}>
            {Object.keys(PROGRAMS).map(dept => (
              <option key={dept} value={dept}>{DEPARTMENT_LABELS[dept] || dept}</option>
            ))}
          </SelectField>

          <SelectField placeholder="Select Course / Program" value={form.program} onChange={v => set('program', v)} disabled={!form.department}>
            {(form.department ? ALL_PROGRAMS.filter(p => p.department === form.department) : ALL_PROGRAMS).map(p => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </SelectField>

          <SelectField placeholder="Select Batch Year" value={form.batchYear} onChange={v => set('batchYear', v)}>
            {BATCH_YEAR_OPTIONS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </SelectField>

          {/* -- Valid ID upload (instead of a phone number) -- */}
          <SelectField placeholder="Select ID Type" value={form.idType} onChange={v => set('idType', v)}>
            {Object.entries(ID_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </SelectField>

          {form.idType ? (
            <>
              <label
                className="flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer transition-all duration-200 hover:bg-gray-50"
                style={{ borderColor: idDocumentImg ? '#22c55e' : '#d1d5db' }}
              >
                {idDocumentImg ? (
                  <img src={idDocumentImg} alt="ID preview" className="w-14 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium">
                    {idDocumentImg ? 'ID photo attached' : 'Upload a photo of a valid ID'}<span style={{ color: RED }}>*</span>
                  </p>
                  <p className="text-xs text-gray-400">JPG or PNG, clear and legible</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleIdDocument} />
              </label>
              <p className="text-xs text-gray-400 -mt-1">
                Your ID is reviewed by the alumni office as part of registration approval.
              </p>
            </>
          ) : (
            // ID Type must be chosen before the upload control is usable —
            // the uploaded photo needs to be labeled with a type, so there's
            // nothing sensible to do with a photo dropped in before that.
            <div className="flex items-center gap-3 rounded-md border border-dashed p-3 opacity-60 cursor-not-allowed"
              style={{ borderColor: '#d1d5db' }}>
              <div className="w-14 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Camera className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 font-medium">
                  Upload a photo of a valid ID<span style={{ color: RED }}>*</span>
                </p>
                <p className="text-xs text-gray-400">Select ID Type first</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- Step 1: Account -- */}
      {step === 1 && (
        <div className="space-y-2.5 flex-1">
          {/* Profile photo */}
          <div className="flex items-center gap-3 mb-1">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 shadow-sm"
                style={{ borderColor: LBLUE, background: '#e8eef7' }}>
                {profileImg
                  ? <img src={profileImg} alt="Profile" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-base font-bold" style={{ color: NAVY }}>
                      {form.firstName ? form.firstName[0].toUpperCase() : '?'}
                    </div>
                }
              </div>
              <label htmlFor="img-upload"
                className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-white shadow"
                style={{ background: NAVY }}>
                <Camera className="w-2.5 h-2.5" />
                <input id="img-upload" type="file" accept="image/*" onChange={handleImg} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-gray-400">Profile photo <span className="text-gray-300">(optional)</span></p>
          </div>

          <PasswordStrengthField value={form.password} onChange={v => set('password', v)} required />
          <InputField placeholder="Confirm Password" type="password" value={form.confirmPassword}
            onChange={v => set('confirmPassword', v)} required />

          <div>
            <label className="flex items-start gap-2">
              <div
                onClick={() => { if (hasReadTerms) set('agreeToTerms', !form.agreeToTerms); }}
                onKeyDown={(e) => {
                  if (!hasReadTerms) return;
                  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set('agreeToTerms', !form.agreeToTerms); }
                }}
                role="checkbox"
                tabIndex={hasReadTerms ? 0 : -1}
                aria-checked={form.agreeToTerms}
                aria-disabled={!hasReadTerms}
                className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${hasReadTerms ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                style={{
                  borderColor: form.agreeToTerms ? NAVY : '#d1d5db',
                  background: form.agreeToTerms ? NAVY : hasReadTerms ? 'white' : '#f3f4f6',
                  opacity: hasReadTerms ? 1 : 0.7,
                }}
              >
                {form.agreeToTerms && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              {/*
                The whole sentence is one click target that opens the terms
                modal — "Terms"/"Privacy Policy" are just styled inline
                spans (no separate handlers), so a click anywhere in the
                text bubbles up to this one onClick. The checkbox square
                above is a sibling with its own handler, so clicking it
                just toggles the value directly without opening the modal.
              */}
              <span
                onClick={() => openTermsModal(TOS_ANCHOR)}
                className="text-xs text-gray-500 leading-relaxed cursor-pointer hover:text-gray-700 transition-colors"
              >
                I agree to the{' '}
                <span className="font-semibold underline underline-offset-2 decoration-1" style={{ color: BLUE }}>
                  Terms
                </span>{' '}
                &{' '}
                <span className="font-semibold underline underline-offset-2 decoration-1" style={{ color: BLUE }}>
                  Privacy Policy
                </span>{' '}
                (RA 10173)
              </span>
            </label>
            {!hasReadTerms && (
              <p className="text-xs text-gray-400 mt-1 ml-6">
                Please read the Terms &amp; Privacy Policy to continue.
              </p>
            )}
          </div>
        </div>
      )}

      <TermsModal
        open={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAgree={() => { setHasReadTerms(true); set('agreeToTerms', true); }}
        alreadyAgreed={hasReadTerms}
        initialAnchor={termsModalAnchor}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => { if (step === 0) onSwitch(); else { setStep(s => s - 1); setError(''); } }}
          className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          {step === 0 ? 'Sign In' : 'Back'}
        </button>

        {step < STEP_LABELS.length - 1
          ? <button onClick={next}
              className="flex items-center gap-1 px-5 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-md"
              style={{ background: PANEL_GRADIENT }}>
              NEXT <ArrowRight className="w-3 h-3" />
            </button>
          : <button onClick={submit} disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-md disabled:opacity-60"
              style={{ background: PANEL_GRADIENT }}>
              {loading ? 'CREATING…' : 'SIGN UP'}
            </button>
        }
      </div>
    </div>
  );
}

/* ======================================
   MAIN AUTH PAGE
====================================== */
export default function AuthPage({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [toast, setToast] = useState('');
  const [autoCheckEmail, setAutoCheckEmail] = useState<string | null>(null);

  const toggle   = () => setIsSignUp(v => !v);
  const showToast = (msg: string) => setToast(msg);

  // Landed back here from AuthCallback.tsx after a failed Facebook/
  // Google/LinkedIn attempt (provider not enabled, consent declined,
  // redirect URI mismatch, etc) — show what actually went wrong instead
  // of leaving it looking like the button silently did nothing. Strip the
  // param right away so refreshing/sharing the URL doesn't re-show it.
  React.useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (oauthError) {
      showToast(oauthError);
      const next = new URLSearchParams(searchParams);
      next.delete('oauth_error');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called from SignUpForm's success screen "Go to Sign In" button.
  const handleRegistered = (email: string) => {
    setAutoCheckEmail(email);
    setIsSignUp(false);
  };

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
        className="relative bg-white shadow-2xl overflow-hidden w-full"
        style={{
          maxWidth: '860px',
          minHeight: 'min(640px, 92vh)',
          borderRadius: '16px',
        }}
      >

        {/* -- Sign In form — LEFT half (always rendered) -- */}
        <div className={`absolute top-0 left-0 w-full md:w-1/2 h-full ${isSignUp ? 'hidden md:block' : 'block'}`} style={{ zIndex: 2 }}>
          <SignInForm onSwitch={toggle} onToast={showToast} autoCheckEmail={autoCheckEmail} onAutoChecked={() => setAutoCheckEmail(null)} />
        </div>

        {/* -- Sign Up form — RIGHT half (always rendered) -- */}
        <div className={`absolute top-0 right-0 w-full md:w-1/2 h-full ${isSignUp ? 'block' : 'hidden md:block'}`} style={{ zIndex: 2 }}>
          <SignUpForm onSwitch={toggle} onToast={showToast} onRegistered={handleRegistered} />
        </div>

        {/* ==============================================
            SLIDING OVERLAY PANEL
            Default position: right half (sign-in state)
            Sign-up state: slides to left half
        ============================================== */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',           /* anchor: starts at center */
            width: '50%',
            height: '100%',
            background: PANEL_GRADIENT,
            zIndex: 10,
            transition: 'transform 0.65s cubic-bezier(0.77, 0, 0.175, 1)',
            transform: isSignUp ? 'translateX(-100%)' : 'translateX(0%)',
            borderRadius: isSignUp ? '16px 0 0 16px' : '0 16px 16px 0',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 2rem',
            textAlign: 'center',
          }}
          className="hidden md:flex"
        >
          {/* Decorative circles */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-15%', right: '-10%' }} />
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: '-10%', left: '-8%' }} />
            <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '40%', right: '15%' }} />
          </div>

          {/* Logo */}
          <img
            src={asianCollegeLogo}
            alt="Asian College"
            style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.12)', padding: 4 }}
          />

          {isSignUp ? (
            /* Panel on LEFT → show "Welcome Back" */
            <>
              <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Welcome Back!</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '2rem', maxWidth: 220 }}>
                Stay connected by logging in with your credentials and continue your experience.
              </p>
              <button
                onClick={toggle}
                style={{
                  padding: '0.5rem 2.5rem',
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
                SIGN IN
              </button>
            </>
          ) : (
            /* Panel on RIGHT → show "Hey There!" */
            <>
              <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Hey There!</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '2rem', maxWidth: 220 }}>
                Begin your amazing journey by creating an account with us today.
              </p>
              <button
                onClick={toggle}
                style={{
                  padding: '0.5rem 2.5rem',
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
                SIGN UP
              </button>
            </>
          )}
        </div>

        {/* Mobile tabs — only visible on small screens */}
        <div className="md:hidden absolute top-0 left-0 w-full z-20 flex border-b border-gray-200 bg-white">
          <button onClick={() => setIsSignUp(false)}
            className="flex-1 py-3 text-sm font-bold transition-colors"
            style={{ color: !isSignUp ? NAVY : '#9ca3af', borderBottom: !isSignUp ? `2px solid ${NAVY}` : 'none' }}>
            Sign In
          </button>
          <button onClick={() => setIsSignUp(true)}
            className="flex-1 py-3 text-sm font-bold transition-colors"
            style={{ color: isSignUp ? NAVY : '#9ca3af', borderBottom: isSignUp ? `2px solid ${NAVY}` : 'none' }}>
            Sign Up
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-5 text-xs text-gray-400 text-center">
        Asian College Alumni Tracer & Donation System · RA 10173 Compliant
      </p>
    </div>
  );
}
