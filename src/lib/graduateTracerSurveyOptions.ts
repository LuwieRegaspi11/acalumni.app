// =====================================================================
// GRADUATE TRACER SURVEY — shared question/option catalog.
// Single source of truth for every picklist used by the alumni-facing
// forms (alumni/GraduateTracerForm.tsx — the mandatory post-login
// gate for already-approved accounts, and alumni/PublicTracerSurveyPage.tsx
// — the public pre-account intake form that replaced self-registration)
// AND the admin analytics module (admin/TracerResponses.tsx), so none of
// them can drift out of sync with each other.
//
// Every question and answer choice here is copied verbatim from the
// college's official Graduate Tracer Survey document (Asian College
// Alumni Association) so the in-app survey matches the paper/PDF
// instrument exactly, plus a few deliberate additions beyond that
// document:
//   - Birthdate and Email (needed to create a submission's login; the
//     match to an existing alumni record is by name + department +
//     program — see supabase/functions/tracer-intake/index.ts) and a
//     free-text Job Title (distinct from the categorical Job
//     Classification below; maps to profiles.current_position).
//   - Number of Companies Worked For Since Graduation / Reasons for
//     Leaving Previous Job (NUMBER_OF_EMPLOYERS_OPTIONS /
//     REASON_FOR_LEAVING_JOB_OPTIONS below) — not in the official
//     document, briefly dropped from the in-app survey during an
//     earlier realignment to that document, then reinstated by request.
//     graduate_tracer_responses/alumni_tracer_intake had already kept
//     the (until-then dormant) number_of_employers/reasons_for_leaving_job
//     (+_other) columns from before that realignment (see
//     graduate_tracer_job_history.sql), so reinstating the question
//     needed no new response-table columns — only
//     alumni_tracer_intake_job_history.sql, mirroring them onto the
//     intake table, which never had them at all.
// =====================================================================

export const SEX_OPTIONS = ['Male', 'Female'];
export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];

export const EMPLOYMENT_STATUS_OPTIONS = [
  'Employed (Full-Time)', 'Employed (Part-Time)', 'Self-Employed', 'Business Owner',
  'Freelancer', 'Contract-Based Worker', 'Pursuing Graduate Studies',
  'Preparing for Licensure Examination',
  'Currently Unemployed (Seeking Employment)', 'Currently Unemployed (Not Seeking Employment)',
];
// Statuses that mean "not currently working" — softens Employment
// Information's required-ness on the form; irrelevant to the admin side.
export const NOT_EMPLOYED_STATUSES = [
  'Pursuing Graduate Studies', 'Preparing for Licensure Examination',
  'Currently Unemployed (Seeking Employment)', 'Currently Unemployed (Not Seeking Employment)',
];

export const EMPLOYMENT_CLASSIFICATION_OPTIONS = [
  'Permanent', 'Regular', 'Probationary', 'Contractual', 'Casual',
  'Project-Based', 'Seasonal', 'Freelance', 'Self-Employed',
];
export const JOB_CLASSIFICATION_OPTIONS = [
  'Supervisory', 'Managerial', 'Rank and File (Administrative & Support)', 'Other',
];
export const INDUSTRY_SECTOR_OPTIONS = [
  'Government', 'Education', 'Banking and Finance', 'Hospitality', 'Tourism',
  'Information Technology', 'Engineering', 'Manufacturing', 'Construction', 'Healthcare',
  'Retail', 'Business Process Outsourcing (BPO)', 'Telecommunications', 'Logistics',
  'Marketing and Advertising', 'Media and Communications', 'Agriculture',
  'Non-Government Organization (NGO)', 'Freelancing', 'Entrepreneurship', 'Other',
];
export const JOB_RELATED_OPTIONS = ['Related', 'Not Related'];
export const JOB_RELATED_HINT =
  'Related: your primary daily tasks, core job responsibilities, or required qualifications directly ' +
  'utilize the knowledge, specialized skills, or technical training acquired from your degree program. ' +
  'Not Related: your current role operates in a completely different field or function, where the ' +
  'specific technical knowledge or specialized training from your degree is not required or utilized.';
export const TIME_TO_FIRST_JOB_OPTIONS = [
  'Before Graduation', 'Less than 1 Month', '1–3 Months', '4–6 Months', '7–12 Months', 'More than 1 year',
];
// Asked right after Time to First Job (same placement as the original
// graduate_tracer_job_history.sql design): first, how many employers an
// alumnus has had since graduating; the second question only appears on
// the form at all once that isn't "first employer" (see
// tracerSurveySections.tsx's hasChangedEmployers) — no point asking why
// someone left a previous job if they've never had one.
export const NUMBER_OF_EMPLOYERS_OPTIONS = [
  '1 (Current employer is my first employer)', '2', '3', '4', '5 or more',
];
export const REASON_FOR_LEAVING_JOB_OPTIONS = [
  'Higher Salary / Better Compensation', 'Career Advancement or Promotion', 'Job Not Related to Degree',
  'Contract or Project Ended', 'Company Downsizing or Closure', 'Relocation',
  'Better Work-Life Balance', 'Health Reasons', 'Family Reasons', 'Pursued Further Studies',
  'Work Environment or Management Issues', 'Other',
];
// A lighter-weight, single-select companion question — asked on
// shared/JobInfoCard.tsx every time an alumnus actually edits Company /
// Organization to something new (not the broader "select up to 3"
// question above, which is only asked once, at initial survey
// submission). 3 common reasons plus a free-text "Other", same
// RadioGroup+hasOther pattern as every other single-select question here.
export const COMPANY_CHANGE_REASON_OPTIONS = [
  'Better Opportunity / Higher Salary', 'Contract Ended / Company Downsizing or Closure',
  'Personal or Family Reasons', 'Other',
];
export const SALARY_RANGE_OPTIONS = [
  'Below ₱15,000', '₱15,000–24,999', '₱25,000–39,999', '₱40,000–59,999',
  '₱60,000–79,999', '₱80,000–99,999', '₱100,000 and above', 'Prefer not to answer',
];
export const FIRST_JOB_SOURCE_OPTIONS = [
  'School Referral', 'Internship/OJT', 'Job Fair', 'JobStreet', 'LinkedIn', 'Facebook',
  'Walk-in Application', 'Family/Friend Referral', 'Other',
];
export const WORK_LOCATION_OPTIONS = ['Within Negros Island Region', 'Other Province in the Philippines', 'Overseas'];
export const JOB_SECURING_FACTOR_OPTIONS = [
  'Academic Knowledge', 'Technical Skills', 'Internship/OJT Experience',
  'Communication Skills', 'Leadership Skills', 'Other',
];
export const PROGRAM_RELEVANCE_OPTIONS = ['Highly Relevant', 'Moderately Relevant', 'Slightly Relevant', 'Not Relevant'];
export const COMPETENCIES = [
  'Communication Skills', 'Critical Thinking', 'Leadership Skills', 'Teamwork and Collaboration',
  'Technical/Professional Competence', 'Digital Literacy', 'Professional Ethics',
  'Entrepreneurial Skills', 'Research Skills', 'Adaptability and Lifelong Learning',
];
export const COMPETENCY_LEVELS = ['Excellent', 'Very Good', 'Good', 'Poor'];
export const EMPLOYABILITY_EXPERIENCE_OPTIONS = [
  'Classroom Instruction', 'Laboratory Activities', 'Internship / On-the-Job Training (OJT)',
  'Community Extension Programs', 'Student Organizations', 'Research Projects',
  'Seminars and Workshops', 'Industry Visits', 'Capstone Project / Thesis',
  'Career Guidance Services', 'Other',
];
export const AREAS_TO_STRENGTHEN_OPTIONS = [
  'Communication Skills', 'Technical Skills', 'Leadership Development', 'Critical Thinking',
  'Problem-Solving Skills', 'Research Skills', 'Entrepreneurship', 'Digital Literacy',
  'Artificial Intelligence (AI)', 'Data Analytics', 'Customer Service', 'Industry Certifications',
  'Internship/OJT Opportunities', 'Career Placement Services', 'Foreign Language Skills', 'Other',
];
export const LICENSURE_STATUS_OPTIONS = [
  'Yes, Passed', 'Yes, Did Not Pass', 'Currently Preparing', 'Not Yet Taken', 'Not Applicable',
];
export const ALUMNI_ACTIVITY_OPTIONS = [
  'Alumni Homecoming', 'Career Talks and Seminars', 'Professional Development and Skills Training',
  'Networking Events', 'Community Outreach Programs', 'Sports and Recreational Activities',
  'Entrepreneurship Programs', 'Volunteer Activities', 'Alumni Reunions', 'Other',
];
export const PROGRAM_IMPROVEMENT_OPTIONS = [
  'Curriculum & Content', 'Hands-on Training', 'Industry Integration', 'Technical Skills',
  'Soft Skills', 'Research & Innovation', 'Faculty & Instruction', 'Elective Courses', 'Other',
];
export const ADDITIONAL_SERVICES_OPTIONS = [
  'Professional Training', 'Soft Skills & Career Training', 'Modernized Facilities',
  'Learning Resources', 'Career & Placement Services', 'Internship / OJT Support',
  'Student Counseling & Mentorship', 'Incubation & Innovation', 'Other',
];
export const RECOMMEND_OPTIONS = ['Definitely Yes', 'Probably Yes', 'Not Sure', 'Probably No', 'Definitely No'];

export const CONSENT_TEXT =
  'I have read and understood the purpose of this survey. I voluntarily agree to participate in the ' +
  'Asian College Graduate Tracer Survey and consent to the collection, processing, and use of my personal ' +
  'information for educational, research, quality assurance, alumni engagement, and institutional ' +
  'development purposes, in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).';

export const CONSENT_CHECKBOX_LABEL =
  'I have read, understood, and agree to participate in the Asian College Graduate Tracer Survey';

export const ALL_SECTIONS = [
  { key: 'consent', title: 'Consent' },
  { key: 'profile', title: 'Graduate Profile' },
  { key: 'employment_status', title: 'Employment Status' },
  { key: 'employment_info', title: 'Employment Information' },
  { key: 'curriculum', title: 'Curriculum & Outcomes' },
  { key: 'licensure', title: 'Licensure & Development' },
  { key: 'feedback', title: 'Feedback' },
] as const;

// -- Per-question breakdown catalog (admin/TracerResponses.tsx View 2) --
// Deliberately excludes free-text identity/contact fields (name, phone,
// addresses, birthdate, email) and department/program/year,
// which View 1's table/filters already surface — this list is the
// "aggregatable opinion" questions.
export type TracerQuestionType = 'single' | 'multi' | 'rating' | 'text';

export interface TracerQuestion {
  key: string;
  label: string;
  section: string;
  type: TracerQuestionType;
  options?: string[];
}

// Full field list per section — every graduate_tracer_responses column,
// grouped the same way GraduateTracerForm.tsx sections them. Shared by
// admin/TracerResponses.tsx (the "View" dialog) and admin/AlumniInformation.tsx
// (the alumni detail page's Graduate Tracer Survey summary), so both read
// the exact same field/label list instead of drifting apart. Keyed the
// same as ALL_SECTIONS above so a caller can pick a subset of sections
// (e.g. everything except 'curriculum') and still find its fields here.
export const TRACER_DETAIL_FIELDS: Record<string, { key: string; label: string }[]> = {
  profile: [
    { key: 'first_name', label: 'First Name' }, { key: 'last_name', label: 'Last Name' },
    { key: 'date_of_birth', label: 'Birthdate' },
    { key: 'email', label: 'Email' },
    { key: 'mobile_number', label: 'Mobile Number' }, { key: 'social_network_id', label: 'Social Network ID' },
    { key: 'current_address', label: 'Current Address' }, { key: 'permanent_address', label: 'Permanent Address' },
    { key: 'sex', label: 'Sex' }, { key: 'civil_status', label: 'Civil Status' },
    { key: 'year_graduated', label: 'Year Graduated' }, { key: 'college_department', label: 'College Department' },
    { key: 'program_graduated', label: 'Program Graduated' },
  ],
  employment_status: [
    { key: 'employment_status', label: 'Current Employment Status' },
    { key: 'employment_classification', label: 'Employment Classification' },
  ],
  employment_info: [
    { key: 'company_organization', label: 'Company / Organization' },
    { key: 'company_change_reason', label: 'Reason for Changing Employer' }, { key: 'company_change_reason_other', label: 'Reason for Changing Employer (Other)' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'job_classification', label: 'Job Classification' }, { key: 'job_classification_other', label: 'Job Classification (Other)' },
    { key: 'industry_sector', label: 'Industry / Sector' }, { key: 'industry_sector_other', label: 'Industry / Sector (Other)' },
    { key: 'job_related_to_degree', label: 'Job Related to Degree' },
    { key: 'time_to_first_job', label: 'Time to First Job' },
    { key: 'number_of_employers', label: 'Number of Companies Worked For Since Graduation' },
    { key: 'reasons_for_leaving_job', label: 'Reasons for Leaving Previous Job' }, { key: 'reasons_for_leaving_job_other', label: 'Reasons for Leaving (Other)' },
    { key: 'monthly_salary_range', label: 'Monthly Salary Range' },
    { key: 'first_job_source', label: 'How First Job Was Obtained' }, { key: 'first_job_source_other', label: 'How First Job Was Obtained (Other)' },
    { key: 'current_work_location', label: 'Current Work Location' },
    { key: 'job_satisfaction_rating', label: 'Job Satisfaction (1–5)' },
    { key: 'job_securing_factors', label: 'Factors That Helped Secure Job' }, { key: 'job_securing_factors_other', label: 'Other Factor' },
  ],
  curriculum: [
    { key: 'education_quality_rating', label: 'Education Quality (1–5)' },
    { key: 'program_relevance', label: 'Program Relevance' },
    { key: 'employability_experiences', label: 'Experiences That Helped Employability' }, { key: 'employability_experiences_other', label: 'Other Experience' },
    { key: 'areas_to_strengthen', label: 'Areas to Strengthen' }, { key: 'areas_to_strengthen_other', label: 'Other Area' },
    { key: 'training_satisfaction_rating', label: 'Training Satisfaction (1–5)' },
  ],
  licensure: [
    { key: 'licensure_exam_status', label: 'Licensure Exam Status' },
    { key: 'has_certifications', label: 'Certifications Since Graduating' }, { key: 'certifications_detail', label: 'Certifications (Detail)' },
    { key: 'has_professional_training', label: 'Professional Training/Seminars' }, { key: 'professional_training_detail', label: 'Training (Detail)' },
    { key: 'interested_in_alumni_activities', label: 'Interested in Future Alumni Activities' },
    { key: 'preferred_alumni_activities', label: 'Preferred Alumni Activities' }, { key: 'preferred_alumni_activities_other', label: 'Other Activity' },
  ],
  feedback: [
    { key: 'program_improvements', label: 'Suggested Program Improvements' }, { key: 'program_improvements_other', label: 'Other Improvement' },
    { key: 'additional_services_needed', label: 'Additional Services Needed' }, { key: 'additional_services_needed_other', label: 'Other Service' },
    { key: 'would_recommend_college', label: 'Would Recommend College' },
    { key: 'additional_comments', label: 'Additional Comments' },
  ],
};

export const TRACER_QUESTIONS: TracerQuestion[] = [
  { key: 'sex', label: 'Sex', section: 'Graduate Profile', type: 'single', options: SEX_OPTIONS },
  { key: 'civil_status', label: 'Civil Status', section: 'Graduate Profile', type: 'single', options: CIVIL_STATUS_OPTIONS },
  { key: 'employment_status', label: 'Current Employment Status', section: 'Employment Status', type: 'single', options: EMPLOYMENT_STATUS_OPTIONS },
  { key: 'employment_classification', label: 'Employment Classification', section: 'Employment Status', type: 'single', options: EMPLOYMENT_CLASSIFICATION_OPTIONS },
  { key: 'company_change_reason', label: 'Reason for Changing Employer', section: 'Employment Information', type: 'single', options: COMPANY_CHANGE_REASON_OPTIONS },
  { key: 'job_classification', label: 'Job Classification', section: 'Employment Information', type: 'single', options: JOB_CLASSIFICATION_OPTIONS },
  { key: 'industry_sector', label: 'Industry / Sector', section: 'Employment Information', type: 'single', options: INDUSTRY_SECTOR_OPTIONS },
  { key: 'job_related_to_degree', label: 'Job Related to Degree', section: 'Employment Information', type: 'single', options: JOB_RELATED_OPTIONS },
  { key: 'time_to_first_job', label: 'Time to First Job', section: 'Employment Information', type: 'single', options: TIME_TO_FIRST_JOB_OPTIONS },
  { key: 'number_of_employers', label: 'Number of Companies Worked For Since Graduation', section: 'Employment Information', type: 'single', options: NUMBER_OF_EMPLOYERS_OPTIONS },
  { key: 'reasons_for_leaving_job', label: 'Reasons for Leaving Previous Job', section: 'Employment Information', type: 'multi', options: REASON_FOR_LEAVING_JOB_OPTIONS },
  { key: 'monthly_salary_range', label: 'Monthly Salary Range', section: 'Employment Information', type: 'single', options: SALARY_RANGE_OPTIONS },
  { key: 'first_job_source', label: 'How First Job Was Obtained', section: 'Employment Information', type: 'single', options: FIRST_JOB_SOURCE_OPTIONS },
  { key: 'current_work_location', label: 'Current Work Location', section: 'Employment Information', type: 'single', options: WORK_LOCATION_OPTIONS },
  { key: 'job_satisfaction_rating', label: 'Job Satisfaction (1–5)', section: 'Employment Information', type: 'rating' },
  { key: 'job_securing_factors', label: 'Factors That Helped Secure Job', section: 'Employment Information', type: 'multi', options: JOB_SECURING_FACTOR_OPTIONS },
  { key: 'education_quality_rating', label: 'Education Quality (1–5)', section: 'Curriculum & Outcomes', type: 'rating' },
  { key: 'program_relevance', label: 'Program Relevance', section: 'Curriculum & Outcomes', type: 'single', options: PROGRAM_RELEVANCE_OPTIONS },
  { key: 'employability_experiences', label: 'Experiences That Helped Employability', section: 'Curriculum & Outcomes', type: 'multi', options: EMPLOYABILITY_EXPERIENCE_OPTIONS },
  { key: 'areas_to_strengthen', label: 'Areas to Strengthen', section: 'Curriculum & Outcomes', type: 'multi', options: AREAS_TO_STRENGTHEN_OPTIONS },
  { key: 'training_satisfaction_rating', label: 'Training Satisfaction (1–5)', section: 'Curriculum & Outcomes', type: 'rating' },
  { key: 'licensure_exam_status', label: 'Licensure Exam Status', section: 'Licensure & Development', type: 'single', options: LICENSURE_STATUS_OPTIONS },
  { key: 'has_certifications', label: 'Earned Certifications Since Graduating', section: 'Licensure & Development', type: 'single', options: ['Yes', 'No'] },
  { key: 'has_professional_training', label: 'Attended Professional Training/Seminars', section: 'Licensure & Development', type: 'single', options: ['Yes', 'No'] },
  { key: 'interested_in_alumni_activities', label: 'Interested in Future Alumni Activities', section: 'Licensure & Development', type: 'single', options: ['Yes', 'No'] },
  { key: 'preferred_alumni_activities', label: 'Preferred Alumni Activities', section: 'Licensure & Development', type: 'multi', options: ALUMNI_ACTIVITY_OPTIONS },
  { key: 'program_improvements', label: 'Suggested Program Improvements', section: 'Feedback', type: 'multi', options: PROGRAM_IMPROVEMENT_OPTIONS },
  { key: 'additional_services_needed', label: 'Additional Services Needed', section: 'Feedback', type: 'multi', options: ADDITIONAL_SERVICES_OPTIONS },
  { key: 'would_recommend_college', label: 'Would Recommend College', section: 'Feedback', type: 'single', options: RECOMMEND_OPTIONS },
  { key: 'additional_comments', label: 'Additional Comments', section: 'Feedback', type: 'text' },
];
