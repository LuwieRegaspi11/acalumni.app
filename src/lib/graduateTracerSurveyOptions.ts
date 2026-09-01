// =====================================================================
// GRADUATE TRACER SURVEY — shared question/option catalog.
// Single source of truth for every picklist used by the alumni-facing
// form (alumni/GraduateTracerForm.tsx) AND the admin analytics module
// (admin/TracerResponses.tsx), so the two can't drift out of sync the
// same way src/lib/academicPrograms.ts keeps department/program
// pickers in sync across the app.
// =====================================================================

export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];

export const EMPLOYMENT_STATUS_OPTIONS = [
  'Regular/Permanent', 'Temporary', 'Contractual', 'Casual', 'Job Order',
  'Probationary', 'Self-Employed', 'Currently Pursuing Further/Graduate Studies',
  'Unemployed', 'Not Seeking Employment',
];
// Statuses that mean "not currently working" — softens Employment
// Information's required-ness on the form; irrelevant to the admin side.
export const NOT_EMPLOYED_STATUSES = ['Currently Pursuing Further/Graduate Studies', 'Unemployed', 'Not Seeking Employment'];

export const EMPLOYMENT_CLASSIFICATION_OPTIONS = [
  'Private Sector', 'Government/Public Sector', 'Government-Owned or Controlled Corporation',
  'Non-Government Organization (NGO)', 'Self-Employed/Own Business', 'Family-Owned Business',
  'Freelance/Consultant', 'International/Overseas Employer', 'Not Applicable',
];
export const JOB_CLASSIFICATION_OPTIONS = [
  'Managerial/Executive', 'Supervisory', 'Technical/Professional', 'Clerical/Administrative',
  'Skilled Worker', 'Semi-Skilled Worker', 'Sales/Marketing', 'Other',
];
export const INDUSTRY_SECTOR_OPTIONS = [
  'Information Technology', 'Business/Finance/BPO', 'Tourism/Hospitality', 'Education',
  'Healthcare', 'Manufacturing', 'Government', 'Agriculture', 'Other',
];
export const JOB_RELATED_OPTIONS = ['Highly Related', 'Moderately Related', 'Slightly Related', 'Not Related'];
export const TIME_TO_FIRST_JOB_OPTIONS = ['Less than 1 month', '1–3 months', '4–6 months', '7–12 months', 'More than 1 year', 'Not applicable'];
export const SALARY_RANGE_OPTIONS = [
  'Below ₱10,000', '₱10,000 – ₱15,000', '₱15,001 – ₱20,000', '₱20,001 – ₱25,000',
  '₱25,001 – ₱30,000', '₱30,001 – ₱40,000', '₱40,001 – ₱50,000', 'Above ₱50,000',
];
export const FIRST_JOB_SOURCE_OPTIONS = [
  'School Placement Office', 'Job Fair', 'Online Job Portal (e.g. JobStreet, LinkedIn)',
  'Referral (Family/Friend)', 'Walk-in Application', 'Social Media', 'Company Website', 'Other',
];
export const WORK_LOCATION_OPTIONS = ['Local (same city/province)', 'Domestic (different region)', 'International/Overseas'];
export const JOB_SECURING_FACTOR_OPTIONS = [
  'Academic Performance/Grades', 'Relevant Skills/Competencies', 'Work Experience/OJT',
  'Personal Connections/Referrals', 'Certifications/Licenses', 'Communication Skills',
  'School Reputation', 'Other',
];
export const PROGRAM_RELEVANCE_OPTIONS = ['Highly Relevant', 'Moderately Relevant', 'Slightly Relevant', 'Not Relevant'];
export const COMPETENCIES = [
  'Communication Skills', 'Critical Thinking & Problem Solving', 'Technical/Professional Knowledge',
  'Teamwork & Collaboration', 'Leadership Skills', 'Adaptability/Flexibility', 'Time Management',
  'Information Technology/Computer Literacy', 'Research Skills', 'Ethical & Professional Values',
];
export const COMPETENCY_LEVELS = ['Excellent', 'Very Good', 'Good', 'Poor'];
export const EMPLOYABILITY_EXPERIENCE_OPTIONS = [
  'On-the-Job Training/Internship', 'Classroom Lectures & Discussions', 'Group Projects & Case Studies',
  'Laboratory/Hands-on Activities', 'Seminars & Workshops', 'Extracurricular Activities/Student Organizations',
  'Community Extension Programs', 'Research Projects/Thesis', 'Industry Immersion/Field Trips',
  'Mentoring from Faculty', 'Part-time/Working Student Experience', 'Other',
];
export const AREAS_TO_STRENGTHEN_OPTIONS = [
  'Curriculum Content', 'Laboratory Facilities & Equipment', 'Internship/OJT Program',
  'Faculty Teaching Competence', 'Industry Partnerships', 'Career Guidance & Counseling',
  'Research Support', 'Library Resources', 'Communication Skills Training', 'Computer/IT Skills Training',
  'Foreign Language Training', 'Entrepreneurship Training', 'Extracurricular Opportunities',
  'Alumni Networking', 'Job Placement Assistance', 'Scholarship/Financial Support', 'Other',
];
export const LICENSURE_STATUS_OPTIONS = [
  'Passed the Licensure Examination', 'Took the Exam but Did Not Pass', 'Currently Reviewing for the Exam',
  'Not Yet Taken the Examination', 'Not Applicable (Program has No Licensure Exam)',
];
export const ALUMNI_ACTIVITY_OPTIONS = [
  'Alumni Homecoming/Reunion', 'Mentorship Program for Current Students', 'Job Fairs & Career Events',
  'Continuing Education/Seminars', 'Sports Fest/Social Events', 'Community Service/Outreach Programs',
  'Fundraising/Donation Drives', 'Networking Events', 'Guest Lecturing/Resource Speaking', 'Other',
];
export const PROGRAM_IMPROVEMENT_OPTIONS = [
  'Update Curriculum to Match Industry Needs', 'Improve Laboratory/Facility Equipment',
  'Strengthen OJT/Internship Partnerships', 'Enhance Faculty Training & Qualifications',
  'Expand Scholarship Opportunities', 'Improve Career Placement Services',
  'Increase Industry Guest Speakers', 'Modernize Teaching Methods/Technology', 'Other',
];
export const ADDITIONAL_SERVICES_OPTIONS = [
  'Job Placement Assistance', 'Continuing Education Programs', 'Alumni Networking Events',
  'Career Counseling Services', 'Skills Training/Certification Programs', 'Health & Wellness Programs',
  'Financial/Livelihood Assistance', 'Legal Assistance', 'Other',
];
export const RECOMMEND_OPTIONS = ['Definitely Yes', 'Probably Yes', 'Not Sure', 'Probably Not', 'Definitely Not'];

export const CONSENT_TEXT =
  'In compliance with the Data Privacy Act of 2012 (RA 10173), Asian College collects and processes the ' +
  'personal information you provide in this survey solely to track graduate employment outcomes, improve ' +
  'academic programs, and enhance alumni services. Your responses are treated with strict confidentiality, ' +
  'stored securely, and accessed only by authorized Alumni Office personnel. Aggregated, anonymized data may ' +
  'be used in institutional reports. You may contact the Alumni Office at any time to inquire about, correct, ' +
  'or request deletion of your personal data. By checking the box below, you acknowledge that you have read ' +
  'and understood this notice and voluntarily consent to the collection and processing of your personal data ' +
  'for the stated purposes.';

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
// addresses) and department/program/year, which View 1's table/filters
// already surface — this list is the "aggregatable opinion" questions.
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
    { key: 'job_classification', label: 'Job Classification' }, { key: 'job_classification_other', label: 'Job Classification (Other)' },
    { key: 'industry_sector', label: 'Industry / Sector' }, { key: 'industry_sector_other', label: 'Industry / Sector (Other)' },
    { key: 'job_related_to_degree', label: 'Job Related to Degree' },
    { key: 'time_to_first_job', label: 'Time to First Job' }, { key: 'monthly_salary_range', label: 'Monthly Salary Range' },
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
  { key: 'sex', label: 'Sex', section: 'Graduate Profile', type: 'single', options: ['Male', 'Female'] },
  { key: 'civil_status', label: 'Civil Status', section: 'Graduate Profile', type: 'single', options: CIVIL_STATUS_OPTIONS },
  { key: 'employment_status', label: 'Current Employment Status', section: 'Employment Status', type: 'single', options: EMPLOYMENT_STATUS_OPTIONS },
  { key: 'employment_classification', label: 'Employment Classification', section: 'Employment Status', type: 'single', options: EMPLOYMENT_CLASSIFICATION_OPTIONS },
  { key: 'job_classification', label: 'Job Classification', section: 'Employment Information', type: 'single', options: JOB_CLASSIFICATION_OPTIONS },
  { key: 'industry_sector', label: 'Industry / Sector', section: 'Employment Information', type: 'single', options: INDUSTRY_SECTOR_OPTIONS },
  { key: 'job_related_to_degree', label: 'Job Related to Degree', section: 'Employment Information', type: 'single', options: JOB_RELATED_OPTIONS },
  { key: 'time_to_first_job', label: 'Time to First Job', section: 'Employment Information', type: 'single', options: TIME_TO_FIRST_JOB_OPTIONS },
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
