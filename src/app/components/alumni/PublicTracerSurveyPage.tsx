import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../../lib/supabaseClient';
import {
  ChevronRight, ChevronLeft, Send, ClipboardList, Clock, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import asianCollegeLogo from '../../../imports/asiancollege_logo.jpeg';
import { PANEL_GRADIENT } from '../AuthPage';
import {
  type Answers, buildRequirements, sectionMissing, getAllMissing, SECTION_ICONS,
  defaultAnswers, answersToRow, ALL_SECTIONS,
  renderConsentSection, renderProfileSection, renderEmploymentStatusSection,
  renderEmploymentInfoSection, renderCurriculumSection, renderLicensureSection, renderFeedbackSection,
} from './tracerSurveySections';
import TracerCredentialsReveal from './TracerCredentialsReveal';

// =====================================================================
// PUBLIC TRACER SURVEY PAGE — "/tracer-survey". The public intake form
// that replaced self-registration entirely: no login, no chosen
// password. Fields/validation/markup are shared with the mandatory
// post-login version of this survey (alumni/GraduateTracerForm.tsx) via
// alumni/tracerSurveySections.tsx — see that file's header for why.
//
// On submit, the whole payload goes to the `tracer-intake` Edge
// Function (supabase/functions/tracer-intake), which is the only thing
// allowed to check it against the Alumni Roster and create a login —
// see that function's header for the full logic. Every new-email
// submission gets an account and a login immediately, so this component
// shows the one-time credentials screen: a roster match (Name +
// Department + Program against the admin-imported Alumni Roster) lands
// straight on the dashboard, no match lands on the pending-approval
// status page until an admin clears it in Pending Registrations.
//
// A submitted email that already has an account isn't automatically a
// hard error, either — most commonly because that record came from an
// admin import (scripts/import-alumni.mjs or
// admin/BulkImportResponses.tsx), which creates a real account+password
// immediately but the alumnus never received it. The Edge Function
// resets that account's password automatically — no admin involved —
// and this component shows the same one-time credentials screen (the
// 'created' Outcome kind, `reset: true`), regardless of whether the
// submitted Name/Department/Program match what's on file. The 'review'
// Outcome kind below only ever fires for a genuine technical failure
// (the password reset call itself erroring), not an identity mismatch.
// Only a rejected account, or a genuine server error, surfaces as a
// hard error.
// =====================================================================

const REQUIREMENTS = buildRequirements('public');

type Outcome =
  | { kind: 'created'; email: string; password: string; name: string; pending: boolean; reset: boolean }
  // Rare: the submitted email already has an existing account and the
  // automatic password reset itself technically failed, so it's queued
  // into Pending Registrations for an admin to retry (see tracer-intake's
  // handleSubmit). No credentials to show yet, unlike 'created'.
  | { kind: 'review'; message: string }
  | { kind: 'error'; message: string };

export default function PublicTracerSurveyPage() {
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Answers>(() => defaultAnswers());
  const [screen, setScreen] = useState<'explainer' | 'form'>('explainer');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const scrollToFormTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  useEffect(() => { scrollToFormTop(); }, [sectionIdx, screen, outcome]);

  const sections = ALL_SECTIONS;
  const currentKey = sections[Math.min(sectionIdx, sections.length - 1)].key;

  const setField = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers(a => ({ ...a, [key]: value }));
  };

  const handleSubmitClick = async () => {
    const allMissing = getAllMissing(REQUIREMENTS, answers);
    if (allMissing.length > 0) {
      setSubmitAttempted(true);
      const idx = sections.findIndex(s => s.key === allMissing[0].sectionKey);
      if (idx >= 0 && idx !== sectionIdx) setSectionIdx(idx); else scrollToFormTop();
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('tracer-intake', {
      body: { action: 'submit', payload: answersToRow(answers) },
    });
    setSubmitting(false);
    if (error) {
      // supabase-js surfaces a non-2xx response as `error` with the
      // function's JSON body attached to error.context — fall back to a
      // generic message if that shape isn't there for some reason.
      let message = 'Something went wrong submitting your survey. Please try again.';
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch { /* keep generic message */ }
      setOutcome({ kind: 'error', message });
      scrollToFormTop();
      return;
    }
    if (data.review) {
      setOutcome({ kind: 'review', message: data.message || "Your submission needs manual review before you can sign in." });
      scrollToFormTop();
      return;
    }
    setOutcome({ kind: 'created', email: data.email, password: data.password, name: data.name, pending: !data.matched, reset: !!data.reset });
  };

  function renderExplainer() {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center space-y-5">
          <img src={asianCollegeLogo} alt="Asian College" className="h-16 w-auto object-contain mx-auto" />
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <ClipboardList className="w-3.5 h-3.5" /> Official Alumni Association Survey
          </span>
          <h2 className="text-2xl font-bold text-gray-800">Graduate Tracer Survey</h2>
          <p className="text-gray-500 leading-relaxed">
            No account needed to get started — complete this survey and we'll set up your Alumni Portal
            account and sign-in details right away. If your details match our records you'll have full
            access immediately; otherwise you can still sign in, but you'll see a status page until the
            Alumni Office verifies you.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Already in our records but never got your sign-in details (e.g. your info was added by the
            Alumni Office directly)? Submitting this survey resets your password and shows it to you
            here — no need to contact anyone first.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" /> About 5–10 minutes
          </div>
          <button onClick={() => setScreen('form')}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
            style={{ background: PANEL_GRADIENT }}>
            Start Survey
          </button>
          <div>
            <button onClick={() => navigate('/login')} className="text-xs text-gray-400 hover:text-gray-600">
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderForm() {
    const missingBlocking = sectionMissing(REQUIREMENTS, currentKey, answers, true);
    const canGoNext = missingBlocking.length === 0;
    const isLast = sectionIdx === sections.length - 1;
    const SectionIcon = SECTION_ICONS[currentKey] ?? ClipboardList;

    return (
      <div className="space-y-5">
        <div ref={topRef} />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Graduate Tracer Survey</h2>
          <p className="text-sm text-gray-500">Please answer every section as accurately as possible.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sections.map((s, i) => (
              <button key={s.key} onClick={() => {
                  // Going back is always fine; jumping ahead must first clear
                  // every required section in between, same as the Next button.
                  if (i <= sectionIdx) { setSectionIdx(i); return; }
                  for (let j = sectionIdx; j < i; j++) {
                    if (sectionMissing(REQUIREMENTS, sections[j].key, answers, true).length > 0) {
                      setSubmitAttempted(true);
                      scrollToFormTop();
                      return;
                    }
                  }
                  setSectionIdx(i);
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${i === sectionIdx ? 'text-white' : i < sectionIdx && sectionMissing(REQUIREMENTS, s.key, answers, true).length === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                style={i === sectionIdx ? { background: PANEL_GRADIENT } : {}}>
                {i < sectionIdx && sectionMissing(REQUIREMENTS, s.key, answers, true).length === 0 ? '✓ ' : ''}{s.title}
              </button>
            ))}
          </div>
        </div>

        {outcome?.kind === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{outcome.message}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PANEL_GRADIENT }}>
              <SectionIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">{sections[sectionIdx].title}</h3>
          </div>
          {currentKey === 'consent' && renderConsentSection(answers, setField)}
          {currentKey === 'profile' && renderProfileSection(answers, setField, false, 'public')}
          {currentKey === 'employment_status' && renderEmploymentStatusSection(answers, setField, false)}
          {currentKey === 'employment_info' && renderEmploymentInfoSection(answers, setField, false)}
          {currentKey === 'curriculum' && renderCurriculumSection(answers, setField, false)}
          {currentKey === 'licensure' && renderLicensureSection(answers, setField, false)}
          {currentKey === 'feedback' && renderFeedbackSection(answers, setField, false)}
        </div>

        <div className="flex items-start justify-between gap-3">
          <button onClick={() => setSectionIdx(i => Math.max(0, i - 1))} disabled={sectionIdx === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {!isLast ? (
            <div className="text-right">
              <button
                onClick={() => {
                  if (!canGoNext) { setSubmitAttempted(true); scrollToFormTop(); return; }
                  setSectionIdx(i => Math.min(sections.length - 1, i + 1));
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${!canGoNext ? 'opacity-50' : ''}`}
                style={{ background: PANEL_GRADIENT }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-right">
              <button onClick={handleSubmitClick} disabled={submitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 ${!canGoNext ? 'opacity-50' : ''}`}
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                <Send className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit Survey'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const content = (() => {
    if (outcome?.kind === 'created') {
      return (
        <TracerCredentialsReveal
          name={outcome.name} email={outcome.email} password={outcome.password}
          audience="self" pending={outcome.pending} reset={outcome.reset}
          onContinue={() => navigate('/login')}
        />
      );
    }
    if (outcome?.kind === 'review') {
      return (
        <div className="max-w-xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10 text-center space-y-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg mx-auto" style={{ background: PANEL_GRADIENT }}>
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Needs Manual Review</h2>
            <p className="text-gray-500 leading-relaxed">{outcome.message}</p>
            <button onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: PANEL_GRADIENT }}>
              Back to Sign In
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto w-full space-y-5 py-2">
        {screen === 'explainer' && renderExplainer()}
        {screen === 'form' && renderForm()}
      </div>
    );
  })();

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden" style={{ background: '#eef2f7' }}>
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 shadow-md" style={{ background: PANEL_GRADIENT }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
            <img src={asianCollegeLogo} alt="Asian College" className="h-7 w-auto object-contain" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-white font-bold text-sm leading-tight truncate">Asian College Alumni Association</p>
            <p className="text-blue-100 text-xs leading-tight">Graduate Tracer Survey</p>
          </div>
        </div>
        <button onClick={() => navigate('/login')}
          className="flex-shrink-0 text-xs text-blue-100 hover:text-white font-medium flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {content}
      </div>
    </div>
  );
}
