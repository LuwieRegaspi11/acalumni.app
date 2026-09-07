import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { useDarkMode } from './DarkModeContext';
import { supabase } from '../../../lib/supabaseClient';
import { Briefcase, Pencil, Check, X, ClipboardList } from 'lucide-react';
import { Field, RadioGroup, CheckboxGroup, RatingInput } from '../alumni/tracerFieldControls';
import {
  EMPLOYMENT_STATUS_OPTIONS, NOT_EMPLOYED_STATUSES, EMPLOYMENT_CLASSIFICATION_OPTIONS,
  JOB_CLASSIFICATION_OPTIONS, INDUSTRY_SECTOR_OPTIONS, JOB_RELATED_OPTIONS, JOB_RELATED_HINT, TIME_TO_FIRST_JOB_OPTIONS,
  NUMBER_OF_EMPLOYERS_OPTIONS, REASON_FOR_LEAVING_JOB_OPTIONS, COMPANY_CHANGE_REASON_OPTIONS,
  SALARY_RANGE_OPTIONS, FIRST_JOB_SOURCE_OPTIONS, WORK_LOCATION_OPTIONS, JOB_SECURING_FACTOR_OPTIONS,
} from '../../../lib/graduateTracerSurveyOptions';

// =====================================================================
// JOB INFO CARD — the alumni/rep Profile page's editable "Job
// Information" section. Reads and writes the SAME graduate_tracer_responses
// row GraduateTracerForm.tsx's mandatory survey created (keyed by
// respondent_id) but only touches the Employment Status + Employment
// Information columns, the one part of that row still writable after
// status = 'submitted' — enforced at the database layer by
// supabase/graduate_tracer_job_info_edit.sql's trigger, not just this UI.
//
// Because everything else the alumnus submitted (Graduate Profile,
// Curriculum, Licensure, Feedback) stays permanent, this component never
// reads or writes those columns — see GraduateTracerForm.tsx for that
// full, still-locked, read-only record.
//
// Since admin/faculty's "Alumni Tracer" and "Tracer Responses" screens
// (shared/AlumniManagementView.tsx, shared/TracerResponsesView.tsx) query
// graduate_tracer_responses live on every load, a save here shows up
// there automatically — no admin-side wiring needed beyond that.
//
// Editing Company / Organization to a genuinely different value (see
// isChangingCompany below) requires picking why — a required, single-select
// "Reason for Changing Employer" field (3 common reasons + "Other", see
// COMPANY_CHANGE_REASON_OPTIONS) that appears right under it and blocks
// Save until answered, same as this card's other conditional-required
// fields (e.g. "Other" free-text boxes).
//
// Beyond those (see JOB_REQUIREMENTS below for the exact list), saving
// never requires completing the whole section — an alumnus can change
// just one field and save that alone, same as shared/ProfilePage.tsx's
// own Personal Information card.
// =====================================================================

interface JobAnswers {
  employment_status: string; employment_classification: string;
  company_organization: string; company_change_reason: string; company_change_reason_other: string;
  job_title: string; job_classification: string; job_classification_other: string;
  industry_sector: string; industry_sector_other: string; job_related_to_degree: string;
  time_to_first_job: string;
  number_of_employers: string; reasons_for_leaving_job: string[]; reasons_for_leaving_job_other: string;
  monthly_salary_range: string; first_job_source: string; first_job_source_other: string;
  current_work_location: string; job_satisfaction_rating: string;
  job_securing_factors: string[]; job_securing_factors_other: string;
}

const JOB_SELECT_COLUMNS = [
  'status', 'employment_status', 'employment_classification', 'company_organization',
  'company_change_reason', 'company_change_reason_other', 'job_title',
  'job_classification', 'job_classification_other', 'industry_sector', 'industry_sector_other',
  'job_related_to_degree', 'time_to_first_job',
  'number_of_employers', 'reasons_for_leaving_job', 'reasons_for_leaving_job_other',
  'monthly_salary_range',
  'first_job_source', 'first_job_source_other', 'current_work_location',
  'job_satisfaction_rating', 'job_securing_factors', 'job_securing_factors_other',
];

const isEmployed = (status: string) => status !== '' && !NOT_EMPLOYED_STATUSES.includes(status);
// Same as tracerSurveySections.tsx's hasChangedEmployers — independent
// of isEmployed, since someone currently unemployed may still have left
// a previous job worth asking about.
const hasChangedEmployers = (a: JobAnswers) => !!a.number_of_employers && a.number_of_employers !== NUMBER_OF_EMPLOYERS_OPTIONS[0];

function rowToJobAnswers(row: any): JobAnswers {
  return {
    employment_status: row.employment_status || '', employment_classification: row.employment_classification || '',
    company_organization: row.company_organization || '',
    company_change_reason: row.company_change_reason || '', company_change_reason_other: row.company_change_reason_other || '',
    job_title: row.job_title || '',
    job_classification: row.job_classification || '',
    job_classification_other: row.job_classification_other || '',
    industry_sector: row.industry_sector || '', industry_sector_other: row.industry_sector_other || '',
    job_related_to_degree: row.job_related_to_degree || '',
    time_to_first_job: row.time_to_first_job || '',
    number_of_employers: row.number_of_employers || '',
    reasons_for_leaving_job: row.reasons_for_leaving_job || [], reasons_for_leaving_job_other: row.reasons_for_leaving_job_other || '',
    monthly_salary_range: row.monthly_salary_range || '',
    first_job_source: row.first_job_source || '', first_job_source_other: row.first_job_source_other || '',
    current_work_location: row.current_work_location || '',
    job_satisfaction_rating: row.job_satisfaction_rating ? String(row.job_satisfaction_rating) : '',
    job_securing_factors: row.job_securing_factors || [], job_securing_factors_other: row.job_securing_factors_other || '',
  };
}

function jobAnswersToPatch(a: JobAnswers) {
  return {
    employment_status: a.employment_status || null, employment_classification: a.employment_classification || null,
    company_organization: a.company_organization || null,
    company_change_reason: a.company_change_reason || null, company_change_reason_other: a.company_change_reason_other || null,
    job_title: a.job_title || null,
    job_classification: a.job_classification || null,
    job_classification_other: a.job_classification_other || null,
    industry_sector: a.industry_sector || null, industry_sector_other: a.industry_sector_other || null,
    job_related_to_degree: a.job_related_to_degree || null,
    time_to_first_job: a.time_to_first_job || null,
    number_of_employers: a.number_of_employers || null,
    reasons_for_leaving_job: a.reasons_for_leaving_job, reasons_for_leaving_job_other: a.reasons_for_leaving_job_other || null,
    monthly_salary_range: a.monthly_salary_range || null,
    first_job_source: a.first_job_source || null, first_job_source_other: a.first_job_source_other || null,
    current_work_location: a.current_work_location || null,
    job_satisfaction_rating: a.job_satisfaction_rating ? Number(a.job_satisfaction_rating) : null,
    job_securing_factors: a.job_securing_factors, job_securing_factors_other: a.job_securing_factors_other || null,
  };
}

// Unlike GraduateTracerForm.tsx's first-submit REQUIREMENTS (every one of
// these fields has to be answered before the survey can be submitted at
// all), a follow-up edit here never has to complete the whole Employment
// section just to save one correction — e.g. fixing a typo'd Job Title
// shouldn't be blocked by Monthly Salary Range having been left blank on
// a historical, bulk-imported record (see admin/BulkImportResponses.tsx,
// which happily writes those fields as null). So the only things that
// still block Save are tied directly to what the alumnus is actively
// choosing in THIS edit, never to a pre-existing gap elsewhere:
//   - picking "Other" on any single-select/checkbox field requires the
//     matching free-text detail (the alumnus typed a dropdown value OR
//     "Other" + specifics — either way, that value is what gets saved
//     and appears on the Alumni Tracer automatically)
//   - changing Company/Organization to a genuinely different value (see
//     isChangingCompany below) requires picking why — handled separately
//     by extraMissing, not this list.
const JOB_REQUIREMENTS: { check: (a: JobAnswers) => boolean; label: string }[] = [
  { check: a => a.job_classification !== 'Other' || !!a.job_classification_other.trim(), label: 'Please specify your job classification.' },
  { check: a => a.industry_sector !== 'Other' || !!a.industry_sector_other.trim(), label: 'Please specify your industry/sector.' },
  { check: a => !a.reasons_for_leaving_job.includes('Other') || !!a.reasons_for_leaving_job_other.trim(), label: 'Please specify the other reason for leaving your previous job.' },
  { check: a => a.first_job_source !== 'Other' || !!a.first_job_source_other.trim(), label: 'Please specify how you obtained your first job.' },
  { check: a => !a.job_securing_factors.includes('Other') || !!a.job_securing_factors_other.trim(), label: 'Please specify the other factor that helped you secure your job.' },
];

function fmt(v: string | string[]): string {
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return v || '—';
}

export default function JobInfoCard() {
  const { user } = useAuth();
  const { dark } = useDarkMode();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasSubmittedTracer, setHasSubmittedTracer] = useState(false);
  const [answers, setAnswers] = useState<JobAnswers | null>(null);
  const [original, setOriginal] = useState<JobAnswers | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('graduate_tracer_responses')
        .select(JOB_SELECT_COLUMNS.join(', ')).eq('respondent_id', user.id).maybeSingle();
      if (!active) return;
      if (data && (data as any).status === 'submitted') {
        const a = rowToJobAnswers(data);
        setAnswers(a);
        setOriginal(a);
        setHasSubmittedTracer(true);
      } else {
        setHasSubmittedTracer(false);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  const card = dark
    ? 'bg-gray-800 border border-gray-700 rounded-xl p-5'
    : 'bg-white border border-gray-100 rounded-xl p-5 shadow-sm';
  const label = dark ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs';
  const value = dark ? 'text-white text-sm font-medium' : 'text-gray-800 text-sm font-medium';

  if (loading) return null;

  if (!hasSubmittedTracer || !answers) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="w-4 h-4 text-gray-400" />
          <h3 className={dark ? 'text-white font-bold text-base' : 'text-gray-800 font-bold text-base'}>Job Information</h3>
        </div>
        <p className={`text-sm mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Complete your Graduate Tracer Survey to add and manage your job information here.
        </p>
        <button onClick={() => navigate(`/${user?.role}/tracer-form`)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
          style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
          <ClipboardList className="w-3.5 h-3.5" /> Go to Graduate Tracer Survey
        </button>
      </div>
    );
  }

  const setField = <K extends keyof JobAnswers>(key: K, v: JobAnswers[K]) => setAnswers(a => a && ({ ...a, [key]: v }));
  // True only once there's an actual change to compare against — filling
  // Company/Organization in for the first time, or clearing it out, isn't
  // "changing employers" and doesn't ask why.
  const isChangingCompany = (a: JobAnswers) => {
    const prev = (original?.company_organization || '').trim().toLowerCase();
    const curr = (a.company_organization || '').trim().toLowerCase();
    return !!prev && !!curr && prev !== curr;
  };
  const extraMissing = (a: JobAnswers): string[] => [
    ...(isChangingCompany(a) && !a.company_change_reason ? ['Please select a reason for changing your company/employer.'] : []),
    ...(a.company_change_reason === 'Other' && !a.company_change_reason_other.trim() ? ['Please specify your reason for changing employer.'] : []),
  ];
  const missing = saveAttempted ? [...JOB_REQUIREMENTS.filter(r => !r.check(answers)).map(r => r.label), ...extraMissing(answers)] : [];
  const employed = isEmployed(answers.employment_status);

  const startEditing = () => { setSaveAttempted(false); setSaveError(null); setEditing(true); };
  const cancelEditing = () => { setAnswers(original); setSaveAttempted(false); setSaveError(null); setEditing(false); };

  const handleSave = async () => {
    const stillMissing = [...JOB_REQUIREMENTS.filter(r => !r.check(answers)).map(r => r.label), ...extraMissing(answers)];
    if (stillMissing.length > 0) { setSaveAttempted(true); return; }
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('graduate_tracer_responses')
      .update(jobAnswersToPatch(answers)).eq('respondent_id', user.id);
    setSaving(false);
    if (error) {
      console.error('[JobInfoCard] save failed', error);
      setSaveError('Could not save your changes. Please try again.');
      return;
    }
    setOriginal(answers);
    setEditing(false);
    setSaveAttempted(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 4000);
  };

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gray-400" />
          <h3 className={dark ? 'text-white font-bold text-base' : 'text-gray-800 font-bold text-base'}>Job Information</h3>
        </div>
        {!editing ? (
          <button onClick={startEditing} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEditing} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border ${dark ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
      <p className={`text-xs mb-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        From your Graduate Tracer Survey — updates here appear automatically on the school's Alumni Tracer records. The rest of your survey submission stays permanent.
      </p>

      {savedNotice && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 mb-4">
          Your job information has been updated.
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{saveError}</div>
      )}
      {missing.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">
          <p className="font-semibold mb-1">Please complete the following before saving:</p>
          <ul className="list-disc list-inside space-y-0.5">{missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ['Current Employment Status', answers.employment_status],
            ['Employment Classification', answers.employment_classification],
            ['Company / Organization', answers.company_organization],
            ['Reason for Changing Employer', answers.company_change_reason === 'Other' ? answers.company_change_reason_other : answers.company_change_reason],
            ['Job Title', answers.job_title],
            ['Job Classification', answers.job_classification === 'Other' ? answers.job_classification_other : answers.job_classification],
            ['Industry / Sector', answers.industry_sector === 'Other' ? answers.industry_sector_other : answers.industry_sector],
            ['Job Related to Degree', answers.job_related_to_degree],
            ['Time to First Job', answers.time_to_first_job],
            ['Number of Companies Worked For Since Graduation', answers.number_of_employers],
            ['Reasons for Leaving Previous Job', answers.reasons_for_leaving_job.map(f => f === 'Other' ? answers.reasons_for_leaving_job_other || 'Other' : f)],
            ['Monthly Salary Range', answers.monthly_salary_range],
            ['How First Job Was Obtained', answers.first_job_source === 'Other' ? answers.first_job_source_other : answers.first_job_source],
            ['Current Work Location', answers.current_work_location],
            ['Job Satisfaction', answers.job_satisfaction_rating ? `${answers.job_satisfaction_rating} / 5` : ''],
            ['Factors That Helped Secure Job', answers.job_securing_factors.map(f => f === 'Other' ? answers.job_securing_factors_other || 'Other' : f)],
          ].map(([l, v]) => (
            <div key={l as string} className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <p className={label}>{l as string}</p>
              <p className={value}>{fmt(v as string | string[])}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Field label="Current Employment Status" required>
            <RadioGroup options={EMPLOYMENT_STATUS_OPTIONS} value={answers.employment_status} onChange={v => setField('employment_status', v)} />
          </Field>
          <Field label="Employment Classification" required>
            <RadioGroup options={EMPLOYMENT_CLASSIFICATION_OPTIONS} value={answers.employment_classification} onChange={v => setField('employment_classification', v)} />
          </Field>

          {!employed && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              Since you indicated you're currently unemployed, studying, or not seeking work, the fields below are optional — answer what applies to your most recent job, if any.
            </div>
          )}
          <Field label="Company / Organization" required={employed}>
            <input className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400" value={answers.company_organization} onChange={e => setField('company_organization', e.target.value)} />
          </Field>
          {isChangingCompany(answers) && (
            <Field label="You're changing your company/employer — what's the primary reason?" required>
              <RadioGroup options={COMPANY_CHANGE_REASON_OPTIONS} value={answers.company_change_reason} onChange={v => setField('company_change_reason', v)} hasOther otherValue={answers.company_change_reason_other} onOtherChange={v => setField('company_change_reason_other', v)} />
            </Field>
          )}
          <Field label="Job Title" required={employed}>
            <input className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400" value={answers.job_title} onChange={e => setField('job_title', e.target.value)} placeholder="e.g. Software Engineer II" />
          </Field>
          <Field label="Job Classification" required={employed}>
            <RadioGroup options={JOB_CLASSIFICATION_OPTIONS} value={answers.job_classification} onChange={v => setField('job_classification', v)} hasOther otherValue={answers.job_classification_other} onOtherChange={v => setField('job_classification_other', v)} />
          </Field>
          <Field label="Industry / Sector" required={employed}>
            <RadioGroup options={INDUSTRY_SECTOR_OPTIONS} value={answers.industry_sector} onChange={v => setField('industry_sector', v)} hasOther otherValue={answers.industry_sector_other} onOtherChange={v => setField('industry_sector_other', v)} />
          </Field>
          <Field label="Is your current job related to your degree?" required={employed} hint={JOB_RELATED_HINT}>
            <RadioGroup options={JOB_RELATED_OPTIONS} value={answers.job_related_to_degree} onChange={v => setField('job_related_to_degree', v)} />
          </Field>
          <Field label="How long did it take you to obtain your first job after graduation?" required={employed}>
            <RadioGroup options={TIME_TO_FIRST_JOB_OPTIONS} value={answers.time_to_first_job} onChange={v => setField('time_to_first_job', v)} />
          </Field>
          <Field label="How many companies have you worked for since graduation?" required={employed}>
            <RadioGroup options={NUMBER_OF_EMPLOYERS_OPTIONS} value={answers.number_of_employers} onChange={v => setField('number_of_employers', v)} />
          </Field>
          {hasChangedEmployers(answers) && (
            <Field label="If you have changed employers, what were the primary reasons for leaving your previous job? (select up to 3)">
              <CheckboxGroup options={REASON_FOR_LEAVING_JOB_OPTIONS} value={answers.reasons_for_leaving_job} onChange={v => setField('reasons_for_leaving_job', v)} maxSelect={3} hasOther otherValue={answers.reasons_for_leaving_job_other} onOtherChange={v => setField('reasons_for_leaving_job_other', v)} />
            </Field>
          )}
          <Field label="Monthly Salary Range" required={employed}>
            <RadioGroup options={SALARY_RANGE_OPTIONS} value={answers.monthly_salary_range} onChange={v => setField('monthly_salary_range', v)} />
          </Field>
          <Field label="How did you obtain your first job?" required={employed}>
            <RadioGroup options={FIRST_JOB_SOURCE_OPTIONS} value={answers.first_job_source} onChange={v => setField('first_job_source', v)} hasOther otherValue={answers.first_job_source_other} onOtherChange={v => setField('first_job_source_other', v)} />
          </Field>
          <Field label="Current Work Location" required={employed}>
            <RadioGroup options={WORK_LOCATION_OPTIONS} value={answers.current_work_location} onChange={v => setField('current_work_location', v)} />
          </Field>
          <Field label="Job Satisfaction" required={employed}>
            <RatingInput value={answers.job_satisfaction_rating} onChange={v => setField('job_satisfaction_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" />
          </Field>
          <Field label="What factors helped you secure your job? (select all that apply)">
            <CheckboxGroup options={JOB_SECURING_FACTOR_OPTIONS} value={answers.job_securing_factors} onChange={v => setField('job_securing_factors', v)} hasOther otherValue={answers.job_securing_factors_other} onOtherChange={v => setField('job_securing_factors_other', v)} />
          </Field>
        </div>
      )}
    </div>
  );
}
