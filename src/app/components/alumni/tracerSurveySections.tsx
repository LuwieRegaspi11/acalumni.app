import { PROGRAMS_BY_DEPT, type DepartmentCode } from '../../../lib/academicPrograms';
import { getBatchYearOptions } from '../../../lib/batchYears';
import { DEPARTMENT_LABELS } from '../AuthPage';
import {
  ShieldCheck, IdCard, Briefcase, Building2, GraduationCap, Award, MessageSquare, ClipboardList,
} from 'lucide-react';
import {
  SEX_OPTIONS, CIVIL_STATUS_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, NOT_EMPLOYED_STATUSES, EMPLOYMENT_CLASSIFICATION_OPTIONS,
  JOB_CLASSIFICATION_OPTIONS, INDUSTRY_SECTOR_OPTIONS, JOB_RELATED_OPTIONS, JOB_RELATED_HINT, TIME_TO_FIRST_JOB_OPTIONS,
  NUMBER_OF_EMPLOYERS_OPTIONS, REASON_FOR_LEAVING_JOB_OPTIONS,
  SALARY_RANGE_OPTIONS, FIRST_JOB_SOURCE_OPTIONS, WORK_LOCATION_OPTIONS, JOB_SECURING_FACTOR_OPTIONS,
  PROGRAM_RELEVANCE_OPTIONS, COMPETENCIES, COMPETENCY_LEVELS, EMPLOYABILITY_EXPERIENCE_OPTIONS,
  AREAS_TO_STRENGTHEN_OPTIONS, LICENSURE_STATUS_OPTIONS, ALUMNI_ACTIVITY_OPTIONS, PROGRAM_IMPROVEMENT_OPTIONS,
  ADDITIONAL_SERVICES_OPTIONS, RECOMMEND_OPTIONS, CONSENT_TEXT, CONSENT_CHECKBOX_LABEL, ALL_SECTIONS,
} from '../../../lib/graduateTracerSurveyOptions';
import { inputCls, Field, RadioGroup, CheckboxGroup, RatingInput } from './tracerFieldControls';

// =====================================================================
// TRACER SURVEY SECTIONS — the Answers shape, validation engine, and
// section-rendering markup for the Asian College Graduate Tracer
// Survey, shared by BOTH places it's filled out:
//
//   - alumni/GraduateTracerForm.tsx — the mandatory post-login gate for
//     an already-approved account (email/identity fields are locked to
//     what's already on the account).
//   - alumni/PublicTracerSurveyPage.tsx — the public pre-account intake
//     form that replaced self-registration (email/identity fields are
//     live input, since matching + account creation depends on them).
//
// Extracted out of GraduateTracerForm.tsx (which used to own all of
// this directly) so the two forms can't drift apart — single source of
// truth, same as tracerFieldControls.tsx / graduateTracerSurveyOptions.ts.
//
// `mode` on each render function controls only the two identity
// fields that behave differently between the two forms:
//   'public' -> Birthdate, Email are live inputs (required — this,
//               plus name/department/program, is how a submission gets
//               matched — see supabase/functions/tracer-intake/index.ts).
//   'account' -> those two are pre-filled from the signed-in account
//               and disabled (identity is set once, at intake time —
//               see graduate_tracer_job_info_edit.sql's edit-lock,
//               which also treats them as permanent).
// =====================================================================

export interface Answers {
  first_name: string; last_name: string;
  date_of_birth: string; email: string;
  mobile_number: string; social_network_id: string;
  current_address: string; permanent_address: string; sex: string; civil_status: string;
  year_graduated: string; college_department: string; program_graduated: string;

  employment_status: string; employment_classification: string;

  company_organization: string; job_title: string;
  job_classification: string; job_classification_other: string;
  industry_sector: string; industry_sector_other: string; job_related_to_degree: string;
  time_to_first_job: string;
  number_of_employers: string; reasons_for_leaving_job: string[]; reasons_for_leaving_job_other: string;
  monthly_salary_range: string;
  first_job_source: string; first_job_source_other: string; current_work_location: string;
  job_satisfaction_rating: string;
  job_securing_factors: string[]; job_securing_factors_other: string;

  education_quality_rating: string;
  program_relevance: string;
  competency_ratings: Record<string, string>;
  employability_experiences: string[]; employability_experiences_other: string;
  areas_to_strengthen: string[]; areas_to_strengthen_other: string;
  training_satisfaction_rating: string;

  licensure_exam_status: string;
  has_certifications: string; certifications_detail: string;
  has_professional_training: string; professional_training_detail: string;
  interested_in_alumni_activities: string;
  preferred_alumni_activities: string[]; preferred_alumni_activities_other: string;

  program_improvements: string[]; program_improvements_other: string;
  additional_services_needed: string[]; additional_services_needed_other: string;
  would_recommend_college: string; additional_comments: string;

  consent: boolean;
}

export interface Requirement { check: (a: Answers) => boolean; label: string; blocking?: boolean }

// A small icon per section — purely decorative; keyed off ALL_SECTIONS'
// `key`, with ClipboardList as a safe fallback if a key is ever added
// there without a matching entry here.
export const SECTION_ICONS: Record<string, typeof ClipboardList> = {
  consent: ShieldCheck,
  profile: IdCard,
  employment_status: Briefcase,
  employment_info: Building2,
  curriculum: GraduationCap,
  licensure: Award,
  feedback: MessageSquare,
};

export const isEmployed = (a: Answers) => a.employment_status !== '' && !NOT_EMPLOYED_STATUSES.includes(a.employment_status);

// Whether "reasons for leaving your previous job" applies at all —
// independent of isEmployed, since someone currently unemployed may
// still have left a previous job. Only meaningful once an answer to
// "how many companies have you worked for" is actually given, and only
// true past the "this is my first employer" option.
export const hasChangedEmployers = (a: Answers) =>
  !!a.number_of_employers && a.number_of_employers !== NUMBER_OF_EMPLOYERS_OPTIONS[0];

// Shared by both forms so "First Name is required" etc. always means
// the same thing everywhere. The 'public' mode also requires the two
// identity/login fields — an 'account' response already has them fixed
// to the signed-in user, so re-validating them there is meaningless.
export function buildRequirements(mode: 'public' | 'account'): Record<string, Requirement[]> {
  return {
    consent: [
      { check: a => a.consent === true, label: 'Please check the box to acknowledge the data privacy notice.', blocking: true },
    ],
    profile: [
      { check: a => !!a.first_name.trim(), label: 'First Name is required.' },
      { check: a => !!a.last_name.trim(), label: 'Last Name is required.' },
      ...(mode === 'public' ? [
        { check: (a: Answers) => !!a.date_of_birth, label: 'Birthdate is required.' },
        { check: (a: Answers) => !!a.email.trim(), label: 'Email is required.' },
      ] : []),
      { check: a => !!a.mobile_number.trim(), label: 'Mobile Number is required.' },
      { check: a => !!a.current_address.trim(), label: 'Current Address is required.' },
      { check: a => !!a.permanent_address.trim(), label: 'Permanent Address is required.' },
      { check: a => !!a.sex, label: 'Sex is required.' },
      { check: a => !!a.civil_status, label: 'Civil Status is required.' },
      { check: a => !!a.year_graduated, label: 'Year Graduated is required.' },
      { check: a => !!a.college_department, label: 'College Department is required.' },
      { check: a => !!a.program_graduated, label: 'Program Graduated is required.' },
    ],
    employment_status: [
      { check: a => !!a.employment_status, label: 'Current Employment Status is required.' },
      { check: a => !!a.employment_classification, label: 'Employment Classification is required.' },
    ],
    employment_info: [
      { check: a => !isEmployed(a) || !!a.company_organization.trim(), label: 'Company/Organization is required.' },
      { check: a => !isEmployed(a) || !!a.job_title.trim(), label: 'Job Title is required.' },
      { check: a => !isEmployed(a) || !!a.job_classification, label: 'Job Classification is required.' },
      { check: a => a.job_classification !== 'Other' || !!a.job_classification_other.trim(), label: 'Please specify your job classification.', blocking: true },
      { check: a => !isEmployed(a) || !!a.industry_sector, label: 'Industry/Sector is required.' },
      { check: a => a.industry_sector !== 'Other' || !!a.industry_sector_other.trim(), label: 'Please specify your industry/sector.', blocking: true },
      { check: a => !isEmployed(a) || !!a.job_related_to_degree, label: 'Please indicate if your job is related to your degree.' },
      { check: a => !isEmployed(a) || !!a.time_to_first_job, label: 'Time to first job is required.' },
      { check: a => !isEmployed(a) || !!a.number_of_employers, label: 'Number of companies worked for since graduation is required.' },
      { check: a => !hasChangedEmployers(a) || a.reasons_for_leaving_job.length > 0, label: 'Select at least one reason for leaving your previous job.' },
      { check: a => !a.reasons_for_leaving_job.includes('Other') || !!a.reasons_for_leaving_job_other.trim(), label: 'Please specify the other reason for leaving your previous job.', blocking: true },
      { check: a => !isEmployed(a) || !!a.monthly_salary_range, label: 'Monthly Salary Range is required.' },
      { check: a => !isEmployed(a) || !!a.first_job_source, label: 'How you obtained your first job is required.' },
      { check: a => a.first_job_source !== 'Other' || !!a.first_job_source_other.trim(), label: 'Please specify how you obtained your first job.', blocking: true },
      { check: a => !isEmployed(a) || !!a.current_work_location, label: 'Current Work Location is required.' },
      { check: a => !isEmployed(a) || !!a.job_satisfaction_rating, label: 'Job Satisfaction rating is required.' },
      { check: a => !isEmployed(a) || a.job_securing_factors.length > 0, label: 'Select at least one factor that helped you secure your job.' },
      { check: a => !a.job_securing_factors.includes('Other') || !!a.job_securing_factors_other.trim(), label: 'Please specify the other factor that helped you secure your job.', blocking: true },
    ],
    curriculum: [
      { check: a => !!a.education_quality_rating, label: 'Education Quality rating is required.' },
      { check: a => !!a.program_relevance, label: 'Program Relevance is required.' },
      { check: a => COMPETENCIES.every(c => !!a.competency_ratings[c]), label: 'Please rate every competency listed.' },
      { check: a => a.employability_experiences.length >= 3, label: 'Select at least 3 learning experiences that helped your employability.', blocking: true },
      { check: a => !a.employability_experiences.includes('Other') || !!a.employability_experiences_other.trim(), label: 'Please specify the other learning experience.', blocking: true },
      { check: a => a.areas_to_strengthen.length >= 3, label: 'Select at least 3 areas to strengthen.', blocking: true },
      { check: a => !a.areas_to_strengthen.includes('Other') || !!a.areas_to_strengthen_other.trim(), label: 'Please specify the other area to strengthen.', blocking: true },
      { check: a => !!a.training_satisfaction_rating, label: 'Training Satisfaction rating is required.' },
    ],
    licensure: [
      { check: a => !!a.licensure_exam_status, label: 'Licensure Exam Status is required.' },
      { check: a => !!a.has_certifications, label: 'Please indicate if you have certifications after graduation.' },
      { check: a => a.has_certifications !== 'Yes' || !!a.certifications_detail.trim(), label: 'Please specify your certifications.', blocking: true },
      { check: a => !!a.has_professional_training, label: 'Please indicate if you attended professional training/seminars.' },
      { check: a => a.has_professional_training !== 'Yes' || !!a.professional_training_detail.trim(), label: 'Please specify your professional training/seminars.', blocking: true },
      { check: a => !!a.interested_in_alumni_activities, label: 'Please indicate your interest in future alumni activities.' },
      { check: a => a.preferred_alumni_activities.length >= 3, label: 'Select at least 3 preferred alumni activities.', blocking: true },
      { check: a => !a.preferred_alumni_activities.includes('Other') || !!a.preferred_alumni_activities_other.trim(), label: 'Please specify the other preferred activity.', blocking: true },
    ],
    feedback: [
      { check: a => a.program_improvements.length >= 3, label: 'Select at least 3 program improvements.', blocking: true },
      { check: a => !a.program_improvements.includes('Other') || !!a.program_improvements_other.trim(), label: 'Please specify the other program improvement.', blocking: true },
      { check: a => a.additional_services_needed.length >= 3, label: 'Select at least 3 additional services needed.', blocking: true },
      { check: a => !a.additional_services_needed.includes('Other') || !!a.additional_services_needed_other.trim(), label: 'Please specify the other service needed.', blocking: true },
      { check: a => !!a.would_recommend_college, label: 'Please indicate if you would recommend the college.' },
      { check: a => !!a.additional_comments.trim(), label: 'Additional comments is required.' },
    ],
  };
}

export function sectionMissing(requirements: Record<string, Requirement[]>, key: string, a: Answers, blockingOnly: boolean): string[] {
  return (requirements[key] || [])
    .filter(r => !blockingOnly || r.blocking)
    .filter(r => !r.check(a))
    .map(r => r.label);
}

export function getAllMissing(requirements: Record<string, Requirement[]>, a: Answers): { sectionKey: string; labels: string[] }[] {
  return Object.keys(requirements)
    .filter(k => k !== 'consent')
    .map(k => ({ sectionKey: k, labels: sectionMissing(requirements, k, a, false) }))
    .filter(s => s.labels.length > 0);
}

export function computeProgress(requirements: Record<string, Requirement[]>, a: Answers): number {
  const all = Object.keys(requirements).filter(k => k !== 'consent').flatMap(k => requirements[k]);
  if (all.length === 0) return 0;
  return Math.round((all.filter(r => r.check(a)).length / all.length) * 100);
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

// `account` is the signed-in user (GraduateTracerForm mode) — omit for
// the public form, which starts fully blank.
export function defaultAnswers(account?: {
  name?: string; phone?: string; address?: string; batchYear?: number; department?: string; program?: string;
  dateOfBirth?: string; email?: string;
} | null): Answers {
  const { first, last } = splitName(account?.name || '');
  return {
    first_name: first, last_name: last,
    date_of_birth: account?.dateOfBirth || '', email: account?.email || '',
    mobile_number: account?.phone || '', social_network_id: '',
    current_address: account?.address || '', permanent_address: '',
    sex: '', civil_status: '',
    year_graduated: account?.batchYear ? String(account.batchYear) : '',
    college_department: account?.department || '', program_graduated: account?.program || '',
    employment_status: '', employment_classification: '',
    company_organization: '', job_title: '', job_classification: '', job_classification_other: '',
    industry_sector: '', industry_sector_other: '',
    job_related_to_degree: '', time_to_first_job: '',
    number_of_employers: '', reasons_for_leaving_job: [], reasons_for_leaving_job_other: '',
    monthly_salary_range: '',
    first_job_source: '', first_job_source_other: '', current_work_location: '',
    job_satisfaction_rating: '', job_securing_factors: [], job_securing_factors_other: '',
    education_quality_rating: '', program_relevance: '', competency_ratings: {},
    employability_experiences: [], employability_experiences_other: '',
    areas_to_strengthen: [], areas_to_strengthen_other: '',
    training_satisfaction_rating: '',
    licensure_exam_status: '', has_certifications: '', certifications_detail: '',
    has_professional_training: '', professional_training_detail: '',
    interested_in_alumni_activities: '', preferred_alumni_activities: [], preferred_alumni_activities_other: '',
    program_improvements: [], program_improvements_other: '',
    additional_services_needed: [], additional_services_needed_other: '',
    would_recommend_college: '', additional_comments: '',
    consent: false,
  };
}

export function rowToAnswers(row: any): Answers {
  return {
    first_name: row.first_name || '', last_name: row.last_name || '',
    date_of_birth: row.date_of_birth || '', email: row.email || '',
    mobile_number: row.mobile_number || '', social_network_id: row.social_network_id || '',
    current_address: row.current_address || '', permanent_address: row.permanent_address || '',
    sex: row.sex || '', civil_status: row.civil_status || '',
    year_graduated: row.year_graduated ? String(row.year_graduated) : '',
    college_department: row.college_department || '', program_graduated: row.program_graduated || '',
    employment_status: row.employment_status || '', employment_classification: row.employment_classification || '',
    company_organization: row.company_organization || '', job_title: row.job_title || '',
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
    education_quality_rating: row.education_quality_rating ? String(row.education_quality_rating) : '',
    program_relevance: row.program_relevance || '',
    competency_ratings: row.competency_ratings || {},
    employability_experiences: row.employability_experiences || [], employability_experiences_other: row.employability_experiences_other || '',
    areas_to_strengthen: row.areas_to_strengthen || [], areas_to_strengthen_other: row.areas_to_strengthen_other || '',
    training_satisfaction_rating: row.training_satisfaction_rating ? String(row.training_satisfaction_rating) : '',
    licensure_exam_status: row.licensure_exam_status || '',
    has_certifications: row.has_certifications || '', certifications_detail: row.certifications_detail || '',
    has_professional_training: row.has_professional_training || '', professional_training_detail: row.professional_training_detail || '',
    interested_in_alumni_activities: row.interested_in_alumni_activities || '',
    preferred_alumni_activities: row.preferred_alumni_activities || [], preferred_alumni_activities_other: row.preferred_alumni_activities_other || '',
    program_improvements: row.program_improvements || [], program_improvements_other: row.program_improvements_other || '',
    additional_services_needed: row.additional_services_needed || [], additional_services_needed_other: row.additional_services_needed_other || '',
    would_recommend_college: row.would_recommend_college || '', additional_comments: row.additional_comments || '',
    consent: true,
  };
}

export function answersToRow(a: Answers) {
  return {
    first_name: a.first_name || null, last_name: a.last_name || null,
    date_of_birth: a.date_of_birth || null, email: a.email || null,
    mobile_number: a.mobile_number || null, social_network_id: a.social_network_id || null,
    current_address: a.current_address || null, permanent_address: a.permanent_address || null,
    sex: a.sex || null, civil_status: a.civil_status || null,
    year_graduated: a.year_graduated ? Number(a.year_graduated) : null,
    college_department: a.college_department || null, program_graduated: a.program_graduated || null,
    employment_status: a.employment_status || null, employment_classification: a.employment_classification || null,
    company_organization: a.company_organization || null, job_title: a.job_title || null,
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
    education_quality_rating: a.education_quality_rating ? Number(a.education_quality_rating) : null,
    program_relevance: a.program_relevance || null,
    competency_ratings: a.competency_ratings,
    employability_experiences: a.employability_experiences, employability_experiences_other: a.employability_experiences_other || null,
    areas_to_strengthen: a.areas_to_strengthen, areas_to_strengthen_other: a.areas_to_strengthen_other || null,
    training_satisfaction_rating: a.training_satisfaction_rating ? Number(a.training_satisfaction_rating) : null,
    licensure_exam_status: a.licensure_exam_status || null,
    has_certifications: a.has_certifications || null, certifications_detail: a.certifications_detail || null,
    has_professional_training: a.has_professional_training || null, professional_training_detail: a.professional_training_detail || null,
    interested_in_alumni_activities: a.interested_in_alumni_activities || null,
    preferred_alumni_activities: a.preferred_alumni_activities, preferred_alumni_activities_other: a.preferred_alumni_activities_other || null,
    program_improvements: a.program_improvements, program_improvements_other: a.program_improvements_other || null,
    additional_services_needed: a.additional_services_needed, additional_services_needed_other: a.additional_services_needed_other || null,
    would_recommend_college: a.would_recommend_college || null, additional_comments: a.additional_comments || null,
  };
}

export function CompetencyGrid({ competencies, value, onChange, disabled }: { competencies: string[]; value: Record<string, string>; onChange: (c: string, level: string) => void; disabled?: boolean }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Competency</th>
            {COMPETENCY_LEVELS.map(l => <th key={l} className="px-2 py-2 text-xs font-bold text-gray-500 uppercase text-center">{l}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {competencies.map(c => (
            <tr key={c}>
              <td className="px-3 py-2.5 text-gray-700 font-medium">{c}</td>
              {COMPETENCY_LEVELS.map(l => (
                <td key={l} className="px-2 py-2.5 text-center">
                  <input type="radio" name={`comp-${c}`} checked={value[c] === l} onChange={() => onChange(c, l)} disabled={disabled}
                    className={`w-4 h-4 accent-blue-600 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SetField = <K extends keyof Answers>(key: K, value: Answers[K]) => void;

export function renderConsentSection(answers: Answers, setField: SetField) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-gray-600 leading-relaxed max-h-64 overflow-y-auto">
        <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" /> Data Privacy Notice
        </p>
        <p>{CONSENT_TEXT}</p>
      </div>
      <label className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors border-gray-200 hover:border-gray-300">
        <input type="checkbox" checked={answers.consent} onChange={e => setField('consent', e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
        <span className="text-sm text-gray-700">{CONSENT_CHECKBOX_LABEL}</span>
      </label>
    </div>
  );
}

export function renderProfileSection(answers: Answers, setField: SetField, readOnly: boolean, mode: 'public' | 'account') {
  const deptOptions = Object.keys(PROGRAMS_BY_DEPT);
  const programOptions = answers.college_department
    ? (PROGRAMS_BY_DEPT[answers.college_department as DepartmentCode] || [])
    : Object.values(PROGRAMS_BY_DEPT).flat();
  // Identity/login fields: live input on the public intake form, locked
  // once already set on a real account (see graduate_tracer_job_info_edit.sql).
  const identityLocked = readOnly || mode === 'account';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <Field label="First Name" required><input disabled={readOnly} className={inputCls} value={answers.first_name} onChange={e => setField('first_name', e.target.value)} /></Field>
      <Field label="Last Name" required><input disabled={readOnly} className={inputCls} value={answers.last_name} onChange={e => setField('last_name', e.target.value)} /></Field>
      <Field label="Birthdate" required={mode === 'public'}>
        <input type="date" disabled={identityLocked} className={inputCls} value={answers.date_of_birth} onChange={e => setField('date_of_birth', e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Email" required={mode === 'public'}
          hint={mode === 'public' ? "This becomes your sign-in email if your info can be matched to an alumni record." : undefined}>
          <input type="email" disabled={identityLocked} className={inputCls} value={answers.email} onChange={e => setField('email', e.target.value)} />
        </Field>
      </div>
      <Field label="Mobile Number" required><input disabled={readOnly} className={inputCls} value={answers.mobile_number} onChange={e => setField('mobile_number', e.target.value)} placeholder="e.g. 0917 123 4567" /></Field>
      <Field label="Social Network ID"><input disabled={readOnly} className={inputCls} value={answers.social_network_id} onChange={e => setField('social_network_id', e.target.value)} placeholder="Facebook/Twitter name or link" /></Field>
      <div className="sm:col-span-2"><Field label="Current Address" required><input disabled={readOnly} className={inputCls} value={answers.current_address} onChange={e => setField('current_address', e.target.value)} /></Field></div>
      <div className="sm:col-span-2"><Field label="Permanent Address" required><input disabled={readOnly} className={inputCls} value={answers.permanent_address} onChange={e => setField('permanent_address', e.target.value)} /></Field></div>
      <Field label="Sex" required>
        <select disabled={readOnly} className={inputCls} value={answers.sex} onChange={e => setField('sex', e.target.value)}>
          <option value="">Select…</option>{SEX_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="Civil Status" required>
        <select disabled={readOnly} className={inputCls} value={answers.civil_status} onChange={e => setField('civil_status', e.target.value)}>
          <option value="">Select…</option>{CIVIL_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="Year Graduated" required>
        <select disabled={readOnly} className={inputCls} value={answers.year_graduated} onChange={e => setField('year_graduated', e.target.value)}>
          <option value="">Select…</option>{getBatchYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>
      <Field label="College Department" required>
        <select disabled={readOnly} className={inputCls} value={answers.college_department}
          onChange={e => {
            if (readOnly) return;
            const dept = e.target.value;
            setField('college_department', dept);
            if (!(PROGRAMS_BY_DEPT[dept as DepartmentCode] || []).some(p => p.code === answers.program_graduated)) {
              setField('program_graduated', '');
            }
          }}>
          <option value="">Select…</option>{deptOptions.map(d => <option key={d} value={d}>{DEPARTMENT_LABELS[d] || d}</option>)}
        </select>
      </Field>
      <Field label="Program Graduated" required>
        <select disabled={readOnly} className={inputCls} value={answers.program_graduated} onChange={e => setField('program_graduated', e.target.value)}>
          <option value="">Select…</option>{programOptions.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function renderEmploymentStatusSection(answers: Answers, setField: SetField, readOnly: boolean) {
  return (
    <div className="space-y-6">
      <Field label="Current Employment Status" required>
        <RadioGroup options={EMPLOYMENT_STATUS_OPTIONS} value={answers.employment_status} onChange={v => setField('employment_status', v)} disabled={readOnly} />
      </Field>
      <Field label="Employment Classification" required>
        <RadioGroup options={EMPLOYMENT_CLASSIFICATION_OPTIONS} value={answers.employment_classification} onChange={v => setField('employment_classification', v)} disabled={readOnly} />
      </Field>
    </div>
  );
}

export function renderEmploymentInfoSection(answers: Answers, setField: SetField, readOnly: boolean) {
  const employed = isEmployed(answers);
  return (
    <div className="space-y-6">
      {!employed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          Since you indicated you're currently unemployed, studying, or not seeking work, the fields below are optional — answer what applies to your most recent job, if any.
        </div>
      )}
      <Field label="Company / Organization" required={employed}><input disabled={readOnly} className={inputCls} value={answers.company_organization} onChange={e => setField('company_organization', e.target.value)} /></Field>
      <Field label="Job Title" required={employed}><input disabled={readOnly} className={inputCls} value={answers.job_title} onChange={e => setField('job_title', e.target.value)} placeholder="e.g. Software Engineer II" /></Field>
      <Field label="Job Classification" required={employed}>
        <RadioGroup options={JOB_CLASSIFICATION_OPTIONS} value={answers.job_classification} onChange={v => setField('job_classification', v)} hasOther otherValue={answers.job_classification_other} onOtherChange={v => setField('job_classification_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Industry / Sector" required={employed}>
        <RadioGroup options={INDUSTRY_SECTOR_OPTIONS} value={answers.industry_sector} onChange={v => setField('industry_sector', v)} hasOther otherValue={answers.industry_sector_other} onOtherChange={v => setField('industry_sector_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Is your current job related to your degree?" required={employed} hint={JOB_RELATED_HINT}>
        <RadioGroup options={JOB_RELATED_OPTIONS} value={answers.job_related_to_degree} onChange={v => setField('job_related_to_degree', v)} disabled={readOnly} />
      </Field>
      <Field label="How long did it take you to obtain your first job after graduation?" required={employed}>
        <RadioGroup options={TIME_TO_FIRST_JOB_OPTIONS} value={answers.time_to_first_job} onChange={v => setField('time_to_first_job', v)} disabled={readOnly} />
      </Field>
      <Field label="How many companies have you worked for since graduation?" required={employed}>
        <RadioGroup options={NUMBER_OF_EMPLOYERS_OPTIONS} value={answers.number_of_employers} onChange={v => setField('number_of_employers', v)} disabled={readOnly} />
      </Field>
      {hasChangedEmployers(answers) && (
        <Field label="If you have changed employers, what were the primary reasons for leaving your previous job? (select up to 3)" required>
          <CheckboxGroup options={REASON_FOR_LEAVING_JOB_OPTIONS} value={answers.reasons_for_leaving_job} onChange={v => setField('reasons_for_leaving_job', v)} maxSelect={3} hasOther otherValue={answers.reasons_for_leaving_job_other} onOtherChange={v => setField('reasons_for_leaving_job_other', v)} disabled={readOnly} />
        </Field>
      )}
      <Field label="Monthly Salary Range" required={employed}>
        <RadioGroup options={SALARY_RANGE_OPTIONS} value={answers.monthly_salary_range} onChange={v => setField('monthly_salary_range', v)} disabled={readOnly} />
      </Field>
      <Field label="How did you obtain your first job?" required={employed}>
        <RadioGroup options={FIRST_JOB_SOURCE_OPTIONS} value={answers.first_job_source} onChange={v => setField('first_job_source', v)} hasOther otherValue={answers.first_job_source_other} onOtherChange={v => setField('first_job_source_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Current Work Location" required={employed}>
        <RadioGroup options={WORK_LOCATION_OPTIONS} value={answers.current_work_location} onChange={v => setField('current_work_location', v)} disabled={readOnly} />
      </Field>
      <Field label="Overall, how satisfied are you with your current job?" required={employed}>
        <RatingInput value={answers.job_satisfaction_rating} onChange={v => setField('job_satisfaction_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" disabled={readOnly} />
      </Field>
      <Field label="Which factors helped you secure your current job?" required={employed}>
        <CheckboxGroup options={JOB_SECURING_FACTOR_OPTIONS} value={answers.job_securing_factors} onChange={v => setField('job_securing_factors', v)} hasOther otherValue={answers.job_securing_factors_other} onOtherChange={v => setField('job_securing_factors_other', v)} disabled={readOnly} />
      </Field>
    </div>
  );
}

export function renderCurriculumSection(answers: Answers, setField: SetField, readOnly: boolean) {
  return (
    <div className="space-y-6">
      <Field label="How satisfied are you with the overall quality of education you received at Asian College?" required>
        <RatingInput value={answers.education_quality_rating} onChange={v => setField('education_quality_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" disabled={readOnly} />
      </Field>
      <Field label="How relevant is your academic program to your current job?" required>
        <RadioGroup options={PROGRAM_RELEVANCE_OPTIONS} value={answers.program_relevance} onChange={v => setField('program_relevance', v)} disabled={readOnly} />
      </Field>
      <Field label="Please rate how well Asian College developed the following competencies during your studies." required>
        <CompetencyGrid competencies={COMPETENCIES} value={answers.competency_ratings} onChange={(c, l) => setField('competency_ratings', { ...answers.competency_ratings, [c]: l })} disabled={readOnly} />
      </Field>
      <Field label="Which learning experiences contributed most to your employability? (select at least 3)" required>
        <CheckboxGroup options={EMPLOYABILITY_EXPERIENCE_OPTIONS} value={answers.employability_experiences} onChange={v => setField('employability_experiences', v)} minSelect={3} hasOther otherValue={answers.employability_experiences_other} onOtherChange={v => setField('employability_experiences_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Which areas do you think Asian College should strengthen to better prepare future graduates? (select at least 3)" required>
        <CheckboxGroup options={AREAS_TO_STRENGTHEN_OPTIONS} value={answers.areas_to_strengthen} onChange={v => setField('areas_to_strengthen', v)} minSelect={3} hasOther otherValue={answers.areas_to_strengthen_other} onOtherChange={v => setField('areas_to_strengthen_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Overall, how satisfied are you with the education and training you received from Asian College?" required>
        <RatingInput value={answers.training_satisfaction_rating} onChange={v => setField('training_satisfaction_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" disabled={readOnly} />
      </Field>
    </div>
  );
}

export function renderLicensureSection(answers: Answers, setField: SetField, readOnly: boolean) {
  return (
    <div className="space-y-6">
      <Field label="Have you taken a professional licensure examination related to your program?" required>
        <RadioGroup options={LICENSURE_STATUS_OPTIONS} value={answers.licensure_exam_status} onChange={v => setField('licensure_exam_status', v)} disabled={readOnly} />
      </Field>
      <Field label="Have you earned any professional certifications after graduation?" required>
        <RadioGroup options={['Yes', 'No']} value={answers.has_certifications} onChange={v => setField('has_certifications', v)} disabled={readOnly} />
        {answers.has_certifications === 'Yes' && (
          <textarea disabled={readOnly} rows={2} className={`${inputCls} mt-2`} placeholder="Please specify…" value={answers.certifications_detail} onChange={e => setField('certifications_detail', e.target.value)} />
        )}
      </Field>
      <Field label="Have you attended professional training, seminars, or workshops after graduation?" required>
        <RadioGroup options={['Yes', 'No']} value={answers.has_professional_training} onChange={v => setField('has_professional_training', v)} disabled={readOnly} />
        {answers.has_professional_training === 'Yes' && (
          <textarea disabled={readOnly} rows={2} className={`${inputCls} mt-2`} placeholder="Please specify…" value={answers.professional_training_detail} onChange={e => setField('professional_training_detail', e.target.value)} />
        )}
      </Field>
      <Field label="Would you be interested in participating in future Asian College Alumni Association activities and programs?" required>
        <RadioGroup options={['Yes', 'No']} value={answers.interested_in_alumni_activities} onChange={v => setField('interested_in_alumni_activities', v)} disabled={readOnly} />
      </Field>
      <Field label="Which alumni activities would you like to participate in? (select at least 3)" required>
        <CheckboxGroup options={ALUMNI_ACTIVITY_OPTIONS} value={answers.preferred_alumni_activities} onChange={v => setField('preferred_alumni_activities', v)} minSelect={3} hasOther otherValue={answers.preferred_alumni_activities_other} onOtherChange={v => setField('preferred_alumni_activities_other', v)} disabled={readOnly} />
      </Field>
    </div>
  );
}

export function renderFeedbackSection(answers: Answers, setField: SetField, readOnly: boolean) {
  return (
    <div className="space-y-6">
      <Field label="What improvements do you recommend for your academic program? (select at least 3)" required>
        <CheckboxGroup options={PROGRAM_IMPROVEMENT_OPTIONS} value={answers.program_improvements} onChange={v => setField('program_improvements', v)} minSelect={3} hasOther otherValue={answers.program_improvements_other} onOtherChange={v => setField('program_improvements_other', v)} disabled={readOnly} />
      </Field>
      <Field label="What additional training, facilities, or student services should Asian College provide to better prepare future graduates for employment? (select at least 3)" required>
        <CheckboxGroup options={ADDITIONAL_SERVICES_OPTIONS} value={answers.additional_services_needed} onChange={v => setField('additional_services_needed', v)} minSelect={3} hasOther otherValue={answers.additional_services_needed_other} onOtherChange={v => setField('additional_services_needed_other', v)} disabled={readOnly} />
      </Field>
      <Field label="Would you recommend Asian College to your family, friends, or colleagues?" required>
        <RadioGroup options={RECOMMEND_OPTIONS} value={answers.would_recommend_college} onChange={v => setField('would_recommend_college', v)} disabled={readOnly} />
      </Field>
      <Field label="Please share any additional comments, suggestions, or messages for Asian College." required>
        <textarea disabled={readOnly} rows={4} className={inputCls} value={answers.additional_comments} onChange={e => setField('additional_comments', e.target.value)} placeholder="Share any other feedback or recommendations…" />
      </Field>
    </div>
  );
}

export { ALL_SECTIONS };
