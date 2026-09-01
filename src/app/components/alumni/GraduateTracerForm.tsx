import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, type User } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { PROGRAMS_BY_DEPT, type DepartmentCode } from '../../../lib/academicPrograms';
import { getBatchYearOptions } from '../../../lib/batchYears';
import { DEPARTMENT_LABELS } from '../AuthPage';
import {
  CheckCircle, ChevronRight, ChevronLeft, Send, ClipboardList, Clock, LogOut, Check,
  ShieldCheck, IdCard, Briefcase, Building2, GraduationCap, Award, MessageSquare,
} from 'lucide-react';
import asianCollegeLogo from '../../../imports/asiancollege_logo.jpeg';
import {
  CIVIL_STATUS_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, NOT_EMPLOYED_STATUSES, EMPLOYMENT_CLASSIFICATION_OPTIONS,
  JOB_CLASSIFICATION_OPTIONS, INDUSTRY_SECTOR_OPTIONS, JOB_RELATED_OPTIONS, TIME_TO_FIRST_JOB_OPTIONS,
  SALARY_RANGE_OPTIONS, FIRST_JOB_SOURCE_OPTIONS, WORK_LOCATION_OPTIONS, JOB_SECURING_FACTOR_OPTIONS,
  PROGRAM_RELEVANCE_OPTIONS, COMPETENCIES, COMPETENCY_LEVELS, EMPLOYABILITY_EXPERIENCE_OPTIONS,
  AREAS_TO_STRENGTHEN_OPTIONS, LICENSURE_STATUS_OPTIONS, ALUMNI_ACTIVITY_OPTIONS, PROGRAM_IMPROVEMENT_OPTIONS,
  ADDITIONAL_SERVICES_OPTIONS, RECOMMEND_OPTIONS, CONSENT_TEXT, ALL_SECTIONS,
} from '../../../lib/graduateTracerSurveyOptions';

// =====================================================================
// GRADUATE TRACER FORM — the mandatory post-approval survey gate.
// Backed by the new `graduate_tracer_responses` table (see
// supabase/graduate_tracer_survey.sql). Two distinct usage modes,
// decided purely from that row's `status`, no props needed:
//
//   status is null/'draft' -> "gate mode": rendered full-screen (hides
//     the normal dashboard chrome) because App.tsx's ProtectedRoute
//     routed here and the dashboard is locked until submission. Gated
//     for both alumni (/alumni/tracer-form) and batch representatives
//     (/representative/tracer-form) — see TRACER_GATED_ROLES in App.tsx.
//   status === 'submitted' -> "read-only mode": rendered inline, inside
//     the normal DashboardLayout chrome, reached voluntarily via the
//     optional "My Tracer Survey" nav item so someone can review what
//     they submitted. Responses are permanent once submitted — every
//     field is disabled and there is no way to resubmit from here (see
//     graduate_tracer_response_lock.sql, which enforces the same rule
//     at the database layer).
//
// Consent isn't persisted as a column (the schema intentionally has
// none) — it's a per-visit UI gate, not stored data, so re-opening a
// draft always re-shows the consent step before the rest of the form.
// =====================================================================

interface Answers {
  first_name: string; last_name: string; mobile_number: string; social_network_id: string;
  current_address: string; permanent_address: string; sex: string; civil_status: string;
  year_graduated: string; college_department: string; program_graduated: string;

  employment_status: string; employment_classification: string;

  company_organization: string; job_classification: string; job_classification_other: string;
  industry_sector: string; industry_sector_other: string; job_related_to_degree: string;
  time_to_first_job: string; monthly_salary_range: string;
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

interface Requirement { check: (a: Answers) => boolean; label: string; blocking?: boolean }

// A small icon per section — purely decorative (gives each step card a
// visual anchor instead of a bare text heading); keyed off ALL_SECTIONS'
// `key`, with ClipboardList as a safe fallback if a key is ever added
// there without a matching entry here.
const SECTION_ICONS: Record<string, typeof ClipboardList> = {
  consent: ShieldCheck,
  profile: IdCard,
  employment_status: Briefcase,
  employment_info: Building2,
  curriculum: GraduationCap,
  licensure: Award,
  feedback: MessageSquare,
};

const isEmployed = (a: Answers) => a.employment_status !== '' && !NOT_EMPLOYED_STATUSES.includes(a.employment_status);

const REQUIREMENTS: Record<string, Requirement[]> = {
  consent: [
    { check: a => a.consent === true, label: 'Please check the box to acknowledge the data privacy notice.', blocking: true },
  ],
  profile: [
    { check: a => !!a.first_name.trim(), label: 'First Name is required.' },
    { check: a => !!a.last_name.trim(), label: 'Last Name is required.' },
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
    { check: a => !isEmployed(a) || !!a.job_classification, label: 'Job Classification is required.' },
    { check: a => a.job_classification !== 'Other' || !!a.job_classification_other.trim(), label: 'Please specify your job classification.', blocking: true },
    { check: a => !isEmployed(a) || !!a.industry_sector, label: 'Industry/Sector is required.' },
    { check: a => a.industry_sector !== 'Other' || !!a.industry_sector_other.trim(), label: 'Please specify your industry/sector.', blocking: true },
    { check: a => !isEmployed(a) || !!a.job_related_to_degree, label: 'Please indicate if your job is related to your degree.' },
    { check: a => !isEmployed(a) || !!a.time_to_first_job, label: 'Time to first job is required.' },
    { check: a => !isEmployed(a) || !!a.monthly_salary_range, label: 'Monthly Salary Range is required.' },
    { check: a => !isEmployed(a) || !!a.first_job_source, label: 'How you obtained your first job is required.' },
    { check: a => a.first_job_source !== 'Other' || !!a.first_job_source_other.trim(), label: 'Please specify how you obtained your first job.', blocking: true },
    { check: a => !isEmployed(a) || !!a.current_work_location, label: 'Current Work Location is required.' },
    { check: a => !isEmployed(a) || !!a.job_satisfaction_rating, label: 'Job Satisfaction rating is required.' },
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

function sectionMissing(key: string, a: Answers, blockingOnly: boolean): string[] {
  return (REQUIREMENTS[key] || [])
    .filter(r => !blockingOnly || r.blocking)
    .filter(r => !r.check(a))
    .map(r => r.label);
}

function getAllMissing(a: Answers): { sectionKey: string; labels: string[] }[] {
  return Object.keys(REQUIREMENTS)
    .filter(k => k !== 'consent')
    .map(k => ({ sectionKey: k, labels: sectionMissing(k, a, false) }))
    .filter(s => s.labels.length > 0);
}

function computeProgress(a: Answers): number {
  const all = Object.keys(REQUIREMENTS).filter(k => k !== 'consent').flatMap(k => REQUIREMENTS[k]);
  if (all.length === 0) return 0;
  return Math.round((all.filter(r => r.check(a)).length / all.length) * 100);
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function defaultAnswers(user: User | null): Answers {
  const { first, last } = splitName(user?.name || '');
  return {
    first_name: first, last_name: last,
    mobile_number: user?.phone || '', social_network_id: '',
    current_address: user?.address || '', permanent_address: '',
    sex: '', civil_status: '',
    year_graduated: user?.batchYear ? String(user.batchYear) : '',
    college_department: user?.department || '', program_graduated: user?.program || '',
    employment_status: '', employment_classification: '',
    company_organization: '', job_classification: '', job_classification_other: '',
    industry_sector: '', industry_sector_other: '',
    job_related_to_degree: '', time_to_first_job: '', monthly_salary_range: '',
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

function rowToAnswers(row: any): Answers {
  return {
    first_name: row.first_name || '', last_name: row.last_name || '',
    mobile_number: row.mobile_number || '', social_network_id: row.social_network_id || '',
    current_address: row.current_address || '', permanent_address: row.permanent_address || '',
    sex: row.sex || '', civil_status: row.civil_status || '',
    year_graduated: row.year_graduated ? String(row.year_graduated) : '',
    college_department: row.college_department || '', program_graduated: row.program_graduated || '',
    employment_status: row.employment_status || '', employment_classification: row.employment_classification || '',
    company_organization: row.company_organization || '', job_classification: row.job_classification || '',
    job_classification_other: row.job_classification_other || '',
    industry_sector: row.industry_sector || '', industry_sector_other: row.industry_sector_other || '',
    job_related_to_degree: row.job_related_to_degree || '',
    time_to_first_job: row.time_to_first_job || '', monthly_salary_range: row.monthly_salary_range || '',
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

function answersToRow(a: Answers) {
  return {
    first_name: a.first_name || null, last_name: a.last_name || null,
    mobile_number: a.mobile_number || null, social_network_id: a.social_network_id || null,
    current_address: a.current_address || null, permanent_address: a.permanent_address || null,
    sex: a.sex || null, civil_status: a.civil_status || null,
    year_graduated: a.year_graduated ? Number(a.year_graduated) : null,
    college_department: a.college_department || null, program_graduated: a.program_graduated || null,
    employment_status: a.employment_status || null, employment_classification: a.employment_classification || null,
    company_organization: a.company_organization || null, job_classification: a.job_classification || null,
    job_classification_other: a.job_classification_other || null,
    industry_sector: a.industry_sector || null, industry_sector_other: a.industry_sector_other || null,
    job_related_to_degree: a.job_related_to_degree || null,
    time_to_first_job: a.time_to_first_job || null, monthly_salary_range: a.monthly_salary_range || null,
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

const inputCls = 'w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400';

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</p>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function RadioGroup({ options, value, onChange, hasOther, otherValue, onOtherChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value === opt ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${disabled ? '' : 'hover:border-gray-300'}`}`}>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-blue-600' : 'border-gray-300'}`}>
            {value === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
          </div>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} disabled={disabled} className="hidden" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {hasOther && value === 'Other' && (
        <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
          disabled={disabled} className={`${inputCls} mt-1`} />
      )}
    </div>
  );
}

function CheckboxGroup({ options, value, onChange, minSelect, hasOther, otherValue, onOtherChange, disabled }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; minSelect?: number;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; disabled?: boolean;
}) {
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value.includes(opt) ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${disabled ? '' : 'hover:border-gray-300'}`}`}>
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${value.includes(opt) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
            {value.includes(opt) && <Check className="w-3 h-3 text-white" />}
          </div>
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} disabled={disabled} className="hidden" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {hasOther && value.includes('Other') && (
        <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
          disabled={disabled} className={`${inputCls} mt-1`} />
      )}
      {typeof minSelect === 'number' && (
        <p className={`text-xs font-semibold ${value.length >= minSelect ? 'text-green-600' : 'text-amber-600'}`}>
          Selected {value.length} / at least {minSelect} required
        </p>
      )}
    </div>
  );
}

function RatingInput({ value, onChange, lowLabel, highLabel, disabled }: { value: string; onChange: (v: string) => void; lowLabel: string; highLabel: string; disabled?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" disabled={disabled} onClick={() => onChange(String(n))}
            className={`w-11 h-11 rounded-xl border-2 font-bold text-sm transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${value === String(n) ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={value === String(n) ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1 max-w-[13.5rem]">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </div>
  );
}

function CompetencyGrid({ competencies, value, onChange, disabled }: { competencies: string[]; value: Record<string, string>; onChange: (c: string, level: string) => void; disabled?: boolean }) {
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

export default function GraduateTracerForm() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loadingInit, setLoadingInit] = useState(true);
  const [existingStatus, setExistingStatus] = useState<'draft' | 'submitted' | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => defaultAnswers(user));
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
        setAnswers(defaultAnswers(user));
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
    const allMissing = getAllMissing(answers);
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
    const progress = computeProgress(answers);
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

  function renderConsent() {
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
          <span className="text-sm text-gray-700">I have read and understood the Data Privacy Notice above, and I voluntarily consent to the collection and processing of my personal data for this survey.</span>
        </label>
      </div>
    );
  }

  function renderProfileSection() {
    const deptOptions = Object.keys(PROGRAMS_BY_DEPT);
    const programOptions = answers.college_department
      ? (PROGRAMS_BY_DEPT[answers.college_department as DepartmentCode] || [])
      : Object.values(PROGRAMS_BY_DEPT).flat();
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="First Name" required><input disabled={readOnly} className={inputCls} value={answers.first_name} onChange={e => setField('first_name', e.target.value)} /></Field>
        <Field label="Last Name" required><input disabled={readOnly} className={inputCls} value={answers.last_name} onChange={e => setField('last_name', e.target.value)} /></Field>
        <Field label="Mobile Number" required><input disabled={readOnly} className={inputCls} value={answers.mobile_number} onChange={e => setField('mobile_number', e.target.value)} placeholder="e.g. 0917 123 4567" /></Field>
        <Field label="Social Network ID"><input disabled={readOnly} className={inputCls} value={answers.social_network_id} onChange={e => setField('social_network_id', e.target.value)} placeholder="Facebook name/link (optional)" /></Field>
        <div className="sm:col-span-2"><Field label="Current Address" required><input disabled={readOnly} className={inputCls} value={answers.current_address} onChange={e => setField('current_address', e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Permanent Address" required><input disabled={readOnly} className={inputCls} value={answers.permanent_address} onChange={e => setField('permanent_address', e.target.value)} /></Field></div>
        <Field label="Sex" required>
          <select disabled={readOnly} className={inputCls} value={answers.sex} onChange={e => setField('sex', e.target.value)}>
            <option value="">Select…</option><option>Male</option><option>Female</option>
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
              setAnswers(a => ({
                ...a, college_department: dept,
                program_graduated: (PROGRAMS_BY_DEPT[dept as DepartmentCode] || []).some(p => p.code === a.program_graduated) ? a.program_graduated : '',
              }));
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

  function renderEmploymentStatusSection() {
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

  function renderEmploymentInfoSection() {
    const employed = isEmployed(answers);
    return (
      <div className="space-y-6">
        {!employed && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
            Since you indicated you're currently unemployed, studying, or not seeking work, the fields below are optional — answer what applies to your most recent job, if any.
          </div>
        )}
        <Field label="Company / Organization" required={employed}><input disabled={readOnly} className={inputCls} value={answers.company_organization} onChange={e => setField('company_organization', e.target.value)} /></Field>
        <Field label="Job Classification" required={employed}>
          <RadioGroup options={JOB_CLASSIFICATION_OPTIONS} value={answers.job_classification} onChange={v => setField('job_classification', v)} hasOther otherValue={answers.job_classification_other} onOtherChange={v => setField('job_classification_other', v)} disabled={readOnly} />
        </Field>
        <Field label="Industry / Sector" required={employed}>
          <RadioGroup options={INDUSTRY_SECTOR_OPTIONS} value={answers.industry_sector} onChange={v => setField('industry_sector', v)} hasOther otherValue={answers.industry_sector_other} onOtherChange={v => setField('industry_sector_other', v)} disabled={readOnly} />
        </Field>
        <Field label="Is your current/most recent job related to your degree program?" required={employed}
          hint="Consider how closely the tasks, skills, and knowledge required by your job match what you studied.">
          <RadioGroup options={JOB_RELATED_OPTIONS} value={answers.job_related_to_degree} onChange={v => setField('job_related_to_degree', v)} disabled={readOnly} />
        </Field>
        <Field label="How long did it take you to land your first job after graduation?" required={employed}>
          <RadioGroup options={TIME_TO_FIRST_JOB_OPTIONS} value={answers.time_to_first_job} onChange={v => setField('time_to_first_job', v)} disabled={readOnly} />
        </Field>
        <Field label="Monthly Salary Range" required={employed}>
          <RadioGroup options={SALARY_RANGE_OPTIONS} value={answers.monthly_salary_range} onChange={v => setField('monthly_salary_range', v)} disabled={readOnly} />
        </Field>
        <Field label="How did you obtain your first job?" required={employed}>
          <RadioGroup options={FIRST_JOB_SOURCE_OPTIONS} value={answers.first_job_source} onChange={v => setField('first_job_source', v)} hasOther otherValue={answers.first_job_source_other} onOtherChange={v => setField('first_job_source_other', v)} disabled={readOnly} />
        </Field>
        <Field label="Current Work Location" required={employed}>
          <RadioGroup options={WORK_LOCATION_OPTIONS} value={answers.current_work_location} onChange={v => setField('current_work_location', v)} disabled={readOnly} />
        </Field>
        <Field label="Job Satisfaction" required={employed}>
          <RatingInput value={answers.job_satisfaction_rating} onChange={v => setField('job_satisfaction_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" disabled={readOnly} />
        </Field>
        <Field label="What factors helped you secure your job? (select all that apply)">
          <CheckboxGroup options={JOB_SECURING_FACTOR_OPTIONS} value={answers.job_securing_factors} onChange={v => setField('job_securing_factors', v)} hasOther otherValue={answers.job_securing_factors_other} onOtherChange={v => setField('job_securing_factors_other', v)} disabled={readOnly} />
        </Field>
      </div>
    );
  }

  function renderCurriculumSection() {
    return (
      <div className="space-y-6">
        <Field label="How would you rate the overall quality of education you received?" required>
          <RatingInput value={answers.education_quality_rating} onChange={v => setField('education_quality_rating', v)} lowLabel="Poor" highLabel="Excellent" disabled={readOnly} />
        </Field>
        <Field label="How relevant was your program to your current career/life?" required>
          <RadioGroup options={PROGRAM_RELEVANCE_OPTIONS} value={answers.program_relevance} onChange={v => setField('program_relevance', v)} disabled={readOnly} />
        </Field>
        <Field label="Rate how well your program developed each competency" required>
          <CompetencyGrid competencies={COMPETENCIES} value={answers.competency_ratings} onChange={(c, l) => setAnswers(a => ({ ...a, competency_ratings: { ...a.competency_ratings, [c]: l } }))} disabled={readOnly} />
        </Field>
        <Field label="Which learning experiences most helped your employability? (select at least 3)" required>
          <CheckboxGroup options={EMPLOYABILITY_EXPERIENCE_OPTIONS} value={answers.employability_experiences} onChange={v => setField('employability_experiences', v)} minSelect={3} hasOther otherValue={answers.employability_experiences_other} onOtherChange={v => setField('employability_experiences_other', v)} disabled={readOnly} />
        </Field>
        <Field label="Which areas should the college strengthen? (select at least 3)" required>
          <CheckboxGroup options={AREAS_TO_STRENGTHEN_OPTIONS} value={answers.areas_to_strengthen} onChange={v => setField('areas_to_strengthen', v)} minSelect={3} hasOther otherValue={answers.areas_to_strengthen_other} onOtherChange={v => setField('areas_to_strengthen_other', v)} disabled={readOnly} />
        </Field>
        <Field label="How satisfied are you with the practical/hands-on training you received?" required>
          <RatingInput value={answers.training_satisfaction_rating} onChange={v => setField('training_satisfaction_rating', v)} lowLabel="Very Dissatisfied" highLabel="Very Satisfied" disabled={readOnly} />
        </Field>
      </div>
    );
  }

  function renderLicensureSection() {
    return (
      <div className="space-y-6">
        <Field label="Licensure Examination Status" required>
          <RadioGroup options={LICENSURE_STATUS_OPTIONS} value={answers.licensure_exam_status} onChange={v => setField('licensure_exam_status', v)} disabled={readOnly} />
        </Field>
        <Field label="Have you earned any certifications since graduating?" required>
          <RadioGroup options={['Yes', 'No']} value={answers.has_certifications} onChange={v => setField('has_certifications', v)} disabled={readOnly} />
          {answers.has_certifications === 'Yes' && (
            <textarea disabled={readOnly} rows={2} className={`${inputCls} mt-2`} placeholder="Please specify…" value={answers.certifications_detail} onChange={e => setField('certifications_detail', e.target.value)} />
          )}
        </Field>
        <Field label="Have you attended professional training/seminars since graduating?" required>
          <RadioGroup options={['Yes', 'No']} value={answers.has_professional_training} onChange={v => setField('has_professional_training', v)} disabled={readOnly} />
          {answers.has_professional_training === 'Yes' && (
            <textarea disabled={readOnly} rows={2} className={`${inputCls} mt-2`} placeholder="Please specify…" value={answers.professional_training_detail} onChange={e => setField('professional_training_detail', e.target.value)} />
          )}
        </Field>
        <Field label="Are you interested in participating in future alumni activities?" required>
          <RadioGroup options={['Yes', 'No']} value={answers.interested_in_alumni_activities} onChange={v => setField('interested_in_alumni_activities', v)} disabled={readOnly} />
        </Field>
        <Field label="Which alumni activities would you be interested in? (select at least 3)" required>
          <CheckboxGroup options={ALUMNI_ACTIVITY_OPTIONS} value={answers.preferred_alumni_activities} onChange={v => setField('preferred_alumni_activities', v)} minSelect={3} hasOther otherValue={answers.preferred_alumni_activities_other} onOtherChange={v => setField('preferred_alumni_activities_other', v)} disabled={readOnly} />
        </Field>
      </div>
    );
  }

  function renderFeedbackSection() {
    return (
      <div className="space-y-6">
        <Field label="What should the college improve in the program? (select at least 3)" required>
          <CheckboxGroup options={PROGRAM_IMPROVEMENT_OPTIONS} value={answers.program_improvements} onChange={v => setField('program_improvements', v)} minSelect={3} hasOther otherValue={answers.program_improvements_other} onOtherChange={v => setField('program_improvements_other', v)} disabled={readOnly} />
        </Field>
        <Field label="What additional services do you need from the Alumni Office? (select at least 3)" required>
          <CheckboxGroup options={ADDITIONAL_SERVICES_OPTIONS} value={answers.additional_services_needed} onChange={v => setField('additional_services_needed', v)} minSelect={3} hasOther otherValue={answers.additional_services_needed_other} onOtherChange={v => setField('additional_services_needed_other', v)} disabled={readOnly} />
        </Field>
        <Field label="Would you recommend Asian College to others?" required>
          <RadioGroup options={RECOMMEND_OPTIONS} value={answers.would_recommend_college} onChange={v => setField('would_recommend_college', v)} disabled={readOnly} />
        </Field>
        <Field label="Additional Comments" required>
          <textarea disabled={readOnly} rows={4} className={inputCls} value={answers.additional_comments} onChange={e => setField('additional_comments', e.target.value)} placeholder="Share any other feedback or recommendations…" />
        </Field>
      </div>
    );
  }

  function renderForm() {
    // Read-only responses already passed every requirement at submit time —
    // section navigation shouldn't re-gate on them.
    const missingBlocking = readOnly ? [] : sectionMissing(currentKey, answers, true);
    const canGoNext = missingBlocking.length === 0;
    const isLast = sectionIdx === sections.length - 1;
    const attemptedMissing = submitAttempted ? (getAllMissing(answers).find(s => s.sectionKey === currentKey)?.labels || []) : [];
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
          {currentKey === 'consent' && renderConsent()}
          {currentKey === 'profile' && renderProfileSection()}
          {currentKey === 'employment_status' && renderEmploymentStatusSection()}
          {currentKey === 'employment_info' && renderEmploymentInfoSection()}
          {currentKey === 'curriculum' && renderCurriculumSection()}
          {currentKey === 'licensure' && renderLicensureSection()}
          {currentKey === 'feedback' && renderFeedbackSection()}
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
