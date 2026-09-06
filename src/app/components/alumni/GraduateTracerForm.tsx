import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, type User } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import {
  CheckCircle, ChevronRight, ChevronLeft, Send, ClipboardList, Clock, LogOut,
} from 'lucide-react';
import asianCollegeLogo from '../../../imports/asiancollege_logo.jpeg';
import {
  type Answers, buildRequirements, sectionMissing, getAllMissing, computeProgress, SECTION_ICONS,
  defaultAnswers, rowToAnswers, answersToRow, ALL_SECTIONS,
  renderConsentSection, renderProfileSection, renderEmploymentStatusSection,
  renderEmploymentInfoSection, renderCurriculumSection, renderLicensureSection, renderFeedbackSection,
} from './tracerSurveySections';

// =====================================================================
// GRADUATE TRACER FORM — the mandatory post-approval survey gate for an
// account that already exists (see alumni/PublicTracerSurveyPage.tsx
// for the public, pre-account version of this same survey that replaced
// self-registration — both share their fields/validation/markup via
// alumni/tracerSurveySections.tsx).
//
// Backed by the `graduate_tracer_responses` table (see
// supabase/graduate_tracer_survey.sql / alumni_tracer_intake.sql). Two
// distinct usage modes, decided purely from that row's `status`, no
// props needed:
//
//   status is null/'draft' -> "gate mode": rendered full-screen (hides
//     the normal dashboard chrome) because App.tsx's ProtectedRoute
//     routed here and the dashboard is locked until submission. Gated
//     for both alumni (/alumni/tracer-form) and batch representatives
//     (/representative/tracer-form) — see TRACER_GATED_ROLES in App.tsx.
//     In practice this only still happens for an account created before
//     this flow existed — every account created via the public survey
//     (matched or admin-approved) already has a 'submitted' row seeded
//     at creation time, so it skips this gate entirely.
//   status === 'submitted' -> "read-only mode": rendered inline, inside
//     the normal DashboardLayout chrome, reached only by a direct nav to
//     this route (no sidebar link points here once submitted). Every
//     field on THIS screen stays disabled and there is no way to
//     resubmit from here — this is the permanent record of what was
//     submitted.
//
// Job-related fields (Employment Status + Employment Information) ARE
// editable after submission, but not from here — see shared/JobInfoCard.tsx,
// rendered on the alumni/rep Profile page ("Job Information" tab). That's a
// deliberately narrow exception: graduate_tracer_job_info_edit.sql's
// database trigger allows changes to just that column set once
// status = 'submitted' and rejects any other column change (including via
// a direct API call, not just this UI) — every other section (Profile,
// Curriculum, Licensure, Feedback) stays permanent, matching this screen's
// full-disabled rendering.
//
// Consent isn't persisted as a column (the schema intentionally has
// none) — it's a per-visit UI gate, not stored data, so re-opening a
// draft always re-shows the consent step before the rest of the form.
// =====================================================================

const REQUIREMENTS = buildRequirements('account');

export default function GraduateTracerForm() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loadingInit, setLoadingInit] = useState(true);
  const [existingStatus, setExistingStatus] = useState<'draft' | 'submitted' | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => defaultAnswers(accountFields(user)));
  const [screen, setScreen] = useState<'explainer' | 'form' | 'thankyou'>('explainer');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);

  // Anchor at the top of the section card. Scrolling this into view (rather
  // than e.g. window.scrollTo) works no matter which ancestor is actually
  // scrollable — the form's own overflow-y-auto wrapper in gate mode, or
  // DashboardLayout's <main> when this renders inline in review mode.
  const topRef = useRef<HTMLDivElement>(null);
  const scrollToFormTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Every section/screen change should land the user at the top of the new
  // content, not wherever they'd scrolled to on the previous one.
  useEffect(() => { scrollToFormTop(); }, [sectionIdx, screen]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('graduate_tracer_responses').select('*').eq('respondent_id', user.id).maybeSingle();
      if (!active) return;
      if (data) {
        setAnswers(rowToAnswers(data));
        setExistingStatus(data.status);
        setSubmittedAt(data.submitted_at || null);
        setScreen(data.status === 'submitted' ? 'form' : 'explainer');
      } else {
        setAnswers(defaultAnswers(accountFields(user)));
        setExistingStatus(null);
        setSubmittedAt(null);
        setScreen('explainer');
      }
      setSectionIdx(0);
      setLoadingInit(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  if (loadingInit || !user) {
    return <div className="max-w-2xl py-16 text-center text-sm text-gray-400">Loading survey…</div>;
  }

  const gateMode = existingStatus !== 'submitted';
  const readOnly = existingStatus === 'submitted';
  // Reps are gated through this same form under /representative/tracer-form
  // (see TRACER_GATED_ROLES in App.tsx) — "Continue to Dashboard" below
  // needs to land back on whichever role's dashboard sent it here.
  const dashboardPath = `/${user.role}`;
  const sections = gateMode ? ALL_SECTIONS : ALL_SECTIONS.filter(s => s.key !== 'consent');
  const currentKey = sections[Math.min(sectionIdx, sections.length - 1)].key;

  // No-ops once a response is submitted — belt-and-braces alongside every
  // input being rendered `disabled` below and the DB-level lock in
  // graduate_tracer_response_lock.sql.
  const setField = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    if (readOnly) return;
    setAnswers(a => ({ ...a, [key]: value }));
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('graduate_tracer_responses')
      .upsert({ respondent_id: user.id, status: 'draft', ...answersToRow(answers) }, { onConflict: 'respondent_id' });
    setSaving(false);
    if (!error) {
      setExistingStatus('draft');
      setScreen('explainer');
      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 4000);
    }
  };

  const handleSubmitClick = async () => {
    const allMissing = getAllMissing(REQUIREMENTS, answers);
    if (allMissing.length > 0) {
      setSubmitAttempted(true);
      const idx = sections.findIndex(s => s.key === allMissing[0].sectionKey);
      // setSectionIdx only triggers the scroll-to-top effect when the index
      // actually changes — if the offending section is already the current
      // one, scroll there explicitly so the missing-fields banner is seen.
      if (idx >= 0 && idx !== sectionIdx) setSectionIdx(idx); else scrollToFormTop();
      return;
    }
    if (!user || readOnly) return;
    setSubmitting(true);
    const submittedAtNow = new Date().toISOString();
    const { error } = await supabase.from('graduate_tracer_responses')
      .upsert({ respondent_id: user.id, status: 'submitted', submitted_at: submittedAtNow, ...answersToRow(answers) }, { onConflict: 'respondent_id' });
    setSubmitting(false);
    if (!error) {
      setExistingStatus('submitted');
      setSubmittedAt(submittedAtNow);
      setSubmitAttempted(false);
      setScreen('thankyou');
    }
  };

  function renderExplainer() {
    const progress = computeProgress(REQUIREMENTS, answers);
    const hasDraft = existingStatus === 'draft';
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center space-y-5">
          <img src={asianCollegeLogo} alt="Asian College" className="h-16 w-auto object-contain mx-auto" />
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <ClipboardList className="w-3.5 h-3.5" /> Official Alumni Association Survey
          </span>
          <h2 className="text-2xl font-bold text-gray-800">Graduate Tracer Survey</h2>
          <p className="text-gray-500 leading-relaxed">
            Before you continue, please complete this brief alumni tracer survey — it helps your school improve programs and services.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" /> About 5–10 minutes
          </div>

          {hasDraft && (
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Your progress</span>
                <span className="text-sm font-bold text-blue-700">{progress}% done</span>
              </div>
              <div className="w-full bg-white rounded-full h-2">
                <div className="h-2 rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#1B3A6B,#2B5BA8)' }} />
              </div>
            </div>
          )}

          {saveNotice && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              Your progress has been saved. Come back anytime to finish.
            </div>
          )}

          <button onClick={() => setScreen('form')}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            {hasDraft ? 'Resume Survey' : 'Start Survey'}
          </button>

          <div>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  function renderForm() {
    // Read-only responses already passed every requirement at submit time —
    // section navigation shouldn't re-gate on them.
    const missingBlocking = readOnly ? [] : sectionMissing(REQUIREMENTS, currentKey, answers, true);
    const canGoNext = missingBlocking.length === 0;
    const isLast = sectionIdx === sections.length - 1;
    const attemptedMissing = submitAttempted ? (getAllMissing(REQUIREMENTS, answers).find(s => s.sectionKey === currentKey)?.labels || []) : [];
    const SectionIcon = SECTION_ICONS[currentKey] ?? ClipboardList;

    return (
      <div className="space-y-5">
        <div ref={topRef} />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Graduate Tracer Survey</h2>
          <p className="text-sm text-gray-500">{readOnly ? 'Your submitted responses (read-only — responses are final once submitted).' : 'Please answer every section as accurately as possible.'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sections.map((s, i) => (
              <button key={s.key} onClick={() => setSectionIdx(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${i === sectionIdx ? 'text-white' : i < sectionIdx ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                style={i === sectionIdx ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
                {i < sectionIdx ? '✓ ' : ''}{s.title}
              </button>
            ))}
          </div>
        </div>

        {attemptedMissing.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            <p className="font-semibold mb-1">Please complete the following before submitting:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {attemptedMissing.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
              <SectionIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">{sections[sectionIdx].title}</h3>
          </div>
          {currentKey === 'consent' && renderConsentSection(answers, setField)}
          {currentKey === 'profile' && renderProfileSection(answers, setField, readOnly, 'account')}
          {currentKey === 'employment_status' && renderEmploymentStatusSection(answers, setField, readOnly)}
          {currentKey === 'employment_info' && renderEmploymentInfoSection(answers, setField, readOnly)}
          {currentKey === 'curriculum' && renderCurriculumSection(answers, setField, readOnly)}
          {currentKey === 'licensure' && renderLicensureSection(answers, setField, readOnly)}
          {currentKey === 'feedback' && renderFeedbackSection(answers, setField, readOnly)}
        </div>

        {gateMode && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
            <button onClick={saveDraft} disabled={saving}
              className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">
              {saving ? 'Saving…' : 'Save and continue later'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setSectionIdx(i => Math.max(0, i - 1))} disabled={sectionIdx === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {!isLast ? (
            <div className="text-right">
              <button
                onClick={() => {
                  // Deliberately not a native `disabled` button: when invalid,
                  // still handle the click so we can flag what's missing and
                  // scroll it into view, instead of the click silently doing
                  // nothing (which is what a disabled button gives you).
                  if (!canGoNext) { setSubmitAttempted(true); scrollToFormTop(); return; }
                  setSectionIdx(i => Math.min(sections.length - 1, i + 1));
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${!canGoNext ? 'opacity-50' : ''}`}
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
              {!canGoNext && <p className="text-xs text-amber-600 mt-1">Complete the highlighted fields to continue.</p>}
            </div>
          ) : readOnly ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4" />
              Submitted{submittedAt ? ` on ${new Date(submittedAt).toLocaleDateString()}` : ''} — responses are final
            </div>
          ) : (
            <div className="text-right">
              <button onClick={handleSubmitClick} disabled={submitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 ${!canGoNext ? 'opacity-50' : ''}`}
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                <Send className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit Survey'}
              </button>
              {!canGoNext && <p className="text-xs text-amber-600 mt-1">Complete the highlighted fields to continue.</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderThankYou() {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center space-y-5">
          <img src={asianCollegeLogo} alt="Asian College" className="h-10 w-auto object-contain mx-auto opacity-80" />
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Thank You!</h2>
          <p className="text-gray-500">Your Graduate Tracer Survey has been submitted. Your responses help Asian College improve its programs and alumni services.</p>
          <button onClick={() => navigate(dashboardPath, { replace: true, state: { tracerJustSubmitted: true } })}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <div className="max-w-3xl mx-auto w-full space-y-5 py-2">
      {screen === 'explainer' && renderExplainer()}
      {screen === 'form' && renderForm()}
      {screen === 'thankyou' && renderThankYou()}
    </div>
  );

  if (!gateMode) return content;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden" style={{ background: '#eef2f7' }}>
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 shadow-md"
        style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
            <img src={asianCollegeLogo} alt="Asian College" className="h-7 w-auto object-contain" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-white font-bold text-sm leading-tight truncate">Asian College Alumni Association</p>
            <p className="text-blue-100 text-xs leading-tight">Graduate Tracer Survey</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex-shrink-0 text-xs text-blue-100 hover:text-white font-medium flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {content}
      </div>
    </div>
  );
}

// Maps the signed-in account's fields onto the shape defaultAnswers()
// expects — kept as one small helper so this file doesn't need to know
// tracerSurveySections.tsx's internal field names beyond this one spot.
function accountFields(user: User | null) {
  if (!user) return null;
  return {
    name: user.name, phone: user.phone, address: user.address,
    batchYear: user.batchYear, department: user.department, program: user.program,
    dateOfBirth: user.dateOfBirth, email: user.email,
  };
}
