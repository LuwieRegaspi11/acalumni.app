import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { CheckCircle, ChevronRight, ChevronLeft, Send, FileText, Link as LinkIcon, ExternalLink } from 'lucide-react';

// ================= [ALUMNI: TRACERSURVEYALUMNI] =================
// Backed by Supabase (tracer_surveys / tracer_survey_responses tables).
// Question sets are authored by admins (admin/TracerSurveys.tsx) and
// stored as jsonb on the survey row, instead of being hardcoded here.
// A survey can also be 'external' — a link to an outside form. Those
// just open in a new tab instead of rendering the built-in form, and
// (since there's no way to know who submitted an outside form) they
// never get marked "done" here the way standard surveys do.

// 'radio' | 'text' | 'textarea' are the legacy type keys (still produced by
// the "Quick Deploy Template" button's TEMPLATE_QUESTIONS in admin/TracerSurveys.tsx).
// The rest are the Google Forms–style types the question builder in that same
// file can now produce — kept as distinct keys instead of remapping onto the
// legacy three, since 'checkboxes'/'dropdown'/'linear_scale' need their own
// answer shape (checkboxes answers are string[], not string).
type QuestionType = 'radio' | 'text' | 'textarea' | 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes' | 'dropdown' | 'linear_scale';

interface Question {
  id: string; section: string; question: string;
  type: QuestionType;
  options?: string[]; placeholder?: string; required?: boolean;
  scaleLowLabel?: string; scaleHighLabel?: string;
}
interface Survey {
  id: string; title: string; description: string; questions: Question[];
  surveyType: 'standard' | 'external'; surveyLink: string | null;
}

const LINEAR_SCALE_VALUES = [1, 2, 3, 4, 5];

function isQuestionAnswered(_q: Question, value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== '';
}

export default function TracerSurveyAlumni() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [active, setActive] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: surveyRows } = await supabase
        .from('tracer_surveys')
        .select('id, title, description, target_dept, questions, survey_type, survey_link')
        .eq('status', 'Active');
      const { data: myResponses } = await supabase
        .from('tracer_survey_responses')
        .select('survey_id')
        .eq('respondent_id', user.id);
      const done = new Set((myResponses || []).map((r: any) => r.survey_id));
      const eligible = (surveyRows || [])
        // External surveys can't be marked "done" (no way to know who
        // submitted an outside form), so they always stay listed —
        // only standard surveys drop off once answered.
        .filter((s: any) => (s.target_dept === 'All' || s.target_dept === user.department) && (s.survey_type === 'external' || !done.has(s.id)))
        .map((s: any) => ({
          id: s.id, title: s.title, description: s.description || '', questions: (s.questions || []) as Question[],
          surveyType: s.survey_type === 'external' ? 'external' as const : 'standard' as const,
          surveyLink: s.survey_link || null,
        }));
      setSurveys(eligible);
      // Always land on the survey list first, even when there's only one
      // eligible survey — the alumnus picks a survey by clicking it,
      // rather than being dropped straight into a form.
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="max-w-2xl py-16 text-center text-sm text-gray-400">Loading surveys…</div>;
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-5">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Survey Submitted!</h2>
        <p className="text-gray-500">Thank you, your response has been recorded. Your data helps Asian College improve its programs and alumni services.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
          <p className="text-sm font-semibold text-blue-800 mb-1">What happens next?</p>
          <p className="text-xs text-blue-600">Your responses will be anonymized and included in the department tracer report.</p>
        </div>
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-700">No Surveys Available</h2>
        <p className="text-sm text-gray-400">You&apos;re all caught up — there are no open tracer surveys for you right now.</p>
      </div>
    );
  }

  if (!active) {
    return (
      // No fixed max-width here — this list should make use of however
      // much room the dashboard's main column actually has, whether the
      // sidebar is expanded or collapsed, instead of sitting in a narrow
      // fixed column with a wall of empty space next to it. The grid
      // itself is what actually adapts: more columns as more width
      // becomes available, one column on narrow screens.
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Tracer Surveys</h2>
        <p className="text-sm text-gray-500">Choose a survey to complete.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {surveys.map(s => (
            s.surveyType === 'external' ? (
              <a key={s.id} href={s.surveyLink || '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-300 transition-colors">
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> {s.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  <p className="text-xs text-blue-500 mt-1">Opens in a new tab</p>
                </div>
                <ExternalLink className="w-4 h-4 text-blue-500 flex-shrink-0" />
              </a>
            ) : (
              <button key={s.id} onClick={() => { setActive(s); setAnswers({}); setCurrentSection(0); }}
                className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-300 transition-colors">
                <p className="font-semibold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              </button>
            )
          ))}
        </div>
      </div>
    );
  }

  const questions = active.questions;
  const sections = [...new Set(questions.map(q => q.section))];
  const sectionQuestions = questions.filter(q => q.section === sections[currentSection]);
  const totalAnswered = questions.filter(q => isQuestionAnswered(q, answers[q.id])).length;
  const progress = questions.length ? (totalAnswered / questions.length) * 100 : 0;
  const unmetRequired = sectionQuestions.filter(q => q.required && !isQuestionAnswered(q, answers[q.id]));

  const setAnswer = (id: string, val: string) => setAnswers(a => ({ ...a, [id]: val }));
  const toggleCheckboxAnswer = (id: string, opt: string) => setAnswers(a => {
    const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
    return { ...a, [id]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
  });

  const handleSubmit = async () => {
    if (!user || !active) return;
    setSubmitting(true);
    const { error } = await supabase.from('tracer_survey_responses').insert({
      survey_id: active.id, respondent_id: user.id, answers,
    });
    setSubmitting(false);
    if (!error) setSubmitted(true);
  };

  return (
    // Wider than before (was max-w-2xl) so an opened survey uses the room
    // the dashboard's main column actually has instead of sitting in a
    // narrow strip — same reasoning as the survey list above. Still
    // capped (not full-width) so long option rows stay readable rather
    // than stretching thin across a huge screen. Every row below wraps
    // instead of squeezing/overlapping once the screen gets narrow.
    <div className="max-w-4xl space-y-5">
      <div>
        {/* Lets the alumnus back out to the survey list — e.g. a wrong
            click, or they want to check another survey first — without
            losing their place among however many are eligible. */}
        <button onClick={() => { setActive(null); setAnswers({}); setCurrentSection(0); }}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 mb-2">
          <ChevronLeft className="w-3.5 h-3.5" /> All Surveys
        </button>
        <h2 className="text-2xl font-bold text-gray-800">{active.title}</h2>
        <p className="text-sm text-gray-500">{active.description}</p>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Survey Progress</span>
          <span className="text-sm font-bold text-blue-700">{totalAnswered}/{questions.length} answered</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#1B3A6B,#2B5BA8)' }} />
        </div>
        {/* flex-wrap so many/long section names stack onto extra lines on
            a narrow screen instead of squeezing into unreadable slivers;
            min-w keeps a wrapped button from shrinking to nothing, and
            truncate+title keeps one long name from blowing out its row. */}
        <div className="flex flex-wrap items-center gap-2">
          {sections.map((s, i) => (
            <button key={s} onClick={() => setCurrentSection(i)} title={s}
              className={`flex-1 min-w-[100px] py-1.5 px-2 rounded-lg text-xs font-semibold truncate transition-colors ${currentSection === i ? 'text-white' : i < currentSection ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              style={currentSection === i ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
              {i < currentSection ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        <h3 className="font-bold text-gray-800 text-lg border-b pb-3">{sections[currentSection]}</h3>
        {sectionQuestions.map((q, qi) => {
          const answer = answers[q.id];
          return (
          <div key={q.id} className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              {qi + 1}. {q.question} {q.required && <span className="text-red-500">*</span>}
            </p>
            {(q.type === 'radio' || q.type === 'multiple_choice') && q.options && (
              <div className="space-y-2">
                {q.options.map(opt => (
                  <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${answer === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answer === opt ? 'border-blue-600' : 'border-gray-300'}`}>
                      {answer === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <input type="radio" name={q.id} value={opt} checked={answer === opt} onChange={() => setAnswer(q.id, opt)} className="hidden" />
                    <span className="text-sm text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            {q.type === 'checkboxes' && q.options && (
              <div className="space-y-2">
                {q.options.map(opt => {
                  const checked = Array.isArray(answer) && answer.includes(opt);
                  return (
                    <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                        {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => toggleCheckboxAnswer(q.id, opt)} className="hidden" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {q.type === 'dropdown' && q.options && (
              <select value={typeof answer === 'string' ? answer : ''} onChange={e => setAnswer(q.id, e.target.value)}
                className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400 bg-white">
                <option value="" disabled>Select an option…</option>
                {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {q.type === 'linear_scale' && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                {q.scaleLowLabel && <span className="text-xs text-gray-400 flex-shrink-0">{q.scaleLowLabel}</span>}
                <div className="flex flex-wrap items-center gap-2 flex-1 justify-center">
                  {LINEAR_SCALE_VALUES.map(n => {
                    const selected = answer === String(n);
                    return (
                      <button key={n} type="button" onClick={() => setAnswer(q.id, String(n))}
                        className={`w-10 h-10 rounded-full border-2 text-sm font-semibold transition-colors flex-shrink-0 ${selected ? 'text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        style={selected ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
                        {n}
                      </button>
                    );
                  })}
                </div>
                {q.scaleHighLabel && <span className="text-xs text-gray-400 flex-shrink-0">{q.scaleHighLabel}</span>}
              </div>
            )}
            {(q.type === 'text' || q.type === 'short_answer') && (
              <input value={typeof answer === 'string' ? answer : ''} onChange={e => setAnswer(q.id, e.target.value)}
                placeholder={q.placeholder} className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400" />
            )}
            {(q.type === 'textarea' || q.type === 'paragraph') && (
              <textarea value={typeof answer === 'string' ? answer : ''} onChange={e => setAnswer(q.id, e.target.value)}
                placeholder={q.placeholder} rows={4} className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400 resize-none" />
            )}
          </div>
          );
        })}
      </div>

      {unmetRequired.length > 0 && (
        <p className="text-xs text-red-500 text-right -mt-2">
          Answer {unmetRequired.length === 1 ? 'the required question' : `all ${unmetRequired.length} required questions`} above to continue.
        </p>
      )}

      {/* Navigation — wraps (Previous on its own line above Next/Submit)
          rather than the two buttons ever overlapping on a narrow screen. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setCurrentSection(s => Math.max(0, s - 1))} disabled={currentSection === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        {currentSection < sections.length - 1 ? (
          <button onClick={() => setCurrentSection(s => s + 1)} disabled={unmetRequired.length > 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || unmetRequired.length > 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
            <Send className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit Survey'}
          </button>
        )}
      </div>
    </div>
  );
}
