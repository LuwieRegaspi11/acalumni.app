import { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Tooltip,
  FormControl, Select, MenuItem, type SelectChangeEvent,
} from '@mui/material';
import { Upload, AlertTriangle, Download, CheckCircle, XCircle, Ban, Copy } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { PROGRAMS_BY_DEPT } from '../../../lib/academicPrograms';
import {
  EMPLOYMENT_STATUS_OPTIONS, EMPLOYMENT_CLASSIFICATION_OPTIONS, JOB_CLASSIFICATION_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS, TIME_TO_FIRST_JOB_OPTIONS, SALARY_RANGE_OPTIONS, FIRST_JOB_SOURCE_OPTIONS,
  WORK_LOCATION_OPTIONS, JOB_SECURING_FACTOR_OPTIONS, PROGRAM_RELEVANCE_OPTIONS, COMPETENCIES,
  EMPLOYABILITY_EXPERIENCE_OPTIONS, AREAS_TO_STRENGTHEN_OPTIONS, LICENSURE_STATUS_OPTIONS,
  ALUMNI_ACTIVITY_OPTIONS, PROGRAM_IMPROVEMENT_OPTIONS, ADDITIONAL_SERVICES_OPTIONS, RECOMMEND_OPTIONS,
} from '../../../lib/graduateTracerSurveyOptions';

// =====================================================================
// BULK IMPORT RESPONSES — a migration path for Graduate Tracer Survey
// responses collected outside this app (a Google Forms export). Each
// row already has a real email and a complete, genuine set of answers,
// so it's treated as admin-verified: this creates a real account per
// row directly (no roster matching) via the `tracer-intake` Edge
// Function's admin-only "bulk_import" action, and hands back a
// downloadable CSV of the generated credentials since showing 15-20
// passwords one at a time isn't practical.
//
// Every row is checked against existing alumni BEFORE anything is
// imported (by email — a real match, this is the same account — and by
// name — a softer signal, could be the same person resubmitting under
// a different email, or just a coincidence) and, within the same file,
// against every earlier row (re-uploading the same export, or a file
// with repeated rows). Any match is surfaced in the preview, and the
// admin picks ONE action that applies to every match in the batch —
// Skip, Update the existing records, or Import as new accounts anyway
// — before the import button unlocks; nothing is silently overwritten
// or silently duplicated. A row that only repeats an earlier row in
// the same file has no existing account to update, so that one is
// always skipped automatically regardless of the chosen action.
//
// Column layout below is fixed to this specific export shape (Google
// Forms' own "Graduate Tracer Survey (Responses)" sheet) — matched by
// position, with a header sanity-check that warns (but doesn't block)
// if an uploaded file doesn't look like this shape. This is a one-off
// admin tool, not a generic importer: a different export shape needs
// its column indices updated here by hand.
//
// Known data-quality issues this deliberately works around:
//   - No reliable identifying column to match against the roster —
//     accounts are created directly, no match required.
//   - The file's own encoding is corrupted (peso signs and en-dashes
//     came through as "â"/"â±" mojibake) — every option match below
//     normalizes both sides (letters/digits only) before comparing, so
//     "1â3 Months" still matches "1–3 Months".
//   - A few questions the live Google Form apparently allowed multiple
//     selections for, where this app models a single choice (e.g. "Is
//     your current job related to your degree?", "How did you obtain
//     your first job?") — the first recognizable value is used as the
//     answer and the full raw text is preserved in that field's "Other"
//     companion column so nothing is silently lost.
// Anything that can't be confidently mapped is flagged in the preview
// instead of guessed at — nothing is imported until the admin reviews
// and confirms.
// =====================================================================

const COL = {
  timestamp: 0, email: 1, consent: 2, firstName: 3, lastName: 4, mobile: 5, social: 6,
  currentAddress: 7, permanentAddress: 8, sex: 9, civilStatus: 10, yearGraduated: 11,
  yearGraduatedFallback: 12, department: 13, program: 14, employmentStatus: 15, company: 16,
  jobClassification: 17, industry: 18, industryOther: 19, employmentClassification: 20,
  jobRelated: 21, timeToFirstJob: 22, salaryRange: 23, firstJobSource: 24, workLocation: 25,
  jobSatisfaction: 26, jobSecuringFactors: 27, educationQuality: 28, programRelevance: 29,
  competencyStart: 30, // 10 columns, 30-39, in COMPETENCIES order
  employabilityExperiences: 40, areasToStrengthen: 41, trainingSatisfaction: 42,
  licensureStatus: 43, hasCertifications: 44, hasProfessionalTraining: 45,
  interestedAlumniActivities: 46, preferredAlumniActivities: 47, programImprovements: 48,
  additionalServices: 49, wouldRecommend: 50, additionalComments: 51,
};
const EXPECTED_COLUMN_COUNT = 52;

const DEPARTMENT_NAME_TO_CODE: Record<string, string> = {
  computerstudiesandengineering: 'CSE',
  businessadministrationandaccountancy: 'BAA',
  hospitalityandtourismmanagement: 'CTHM',
};

// ---------------------------------------------------------------------
// Minimal CSV parser — quoted fields, CRLF/LF, leading BOM, embedded
// commas/newlines inside quotes (Google Forms exports every free-text
// and multi-select answer this way). Same shape as the one in
// shared/AlumniManagementView.tsx's roster importer.
// ---------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

// Strips everything but letters/digits before comparing, so mojibake
// punctuation (₱, –, etc. corrupted to "â"/"â±"), stray whitespace, and
// minor formatting differences ("Others" vs "Other") all wash out.
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function matchOption(raw: string, options: readonly string[]): string | null {
  const target = norm(raw);
  if (!target) return null;
  for (const opt of options) if (norm(opt) === target) return opt;
  // "Others"/"Other (please specify)"/etc. all collapse to a leading
  // "other" after normalizing — catches the option list's own escape
  // hatch even when it isn't spelled exactly the same.
  if (target.startsWith('other') && options.includes('Other')) return 'Other';
  return null;
}
// Splits a multi-value cell (comma-joined option names — none of this
// survey's option lists contain a literal comma themselves) and sorts
// each token into recognized options vs. leftover raw text.
function splitMulti(raw: string, options: readonly string[]): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(token => {
    const m = matchOption(token, options);
    if (m && !matched.includes(m)) matched.push(m);
    else if (!m) unmatched.push(token);
  });
  return { matched, unmatched };
}

function mapDepartment(raw: string): { code: string | null; warning?: string } {
  const code = DEPARTMENT_NAME_TO_CODE[norm(raw)];
  if (code) return { code };
  return { code: null, warning: raw ? `Unrecognized department "${raw}"` : 'Missing department' };
}

function mapProgram(raw: string, deptCode: string | null): { code: string | null; warning?: string } {
  const pool = deptCode ? PROGRAMS_BY_DEPT[deptCode as keyof typeof PROGRAMS_BY_DEPT] || [] : Object.values(PROGRAMS_BY_DEPT).flat();
  const target = norm(raw);
  const found = pool.find(p => norm(p.name) === target || norm(p.name.replace(/\s*\([^)]*\)\s*$/, '')) === target);
  if (found) return { code: found.code };
  return { code: null, warning: raw ? `Unrecognized program "${raw}"` : 'Missing program' };
}

// Google Forms free-text answers sometimes land in the wrong cell when
// a respondent's answer to one question runs into the next field's
// expected shape (e.g. a compound surname typed across two boxes) —
// this is a light sanity check, not real phone validation, just enough
// to flag "this doesn't look like a phone number, check this row" in
// the preview instead of silently importing a name fragment as a phone.
function looksLikePhoneNumber(raw: string): boolean {
  const digits = (raw.match(/\d/g) || []).length;
  return digits >= 6;
}

// "Related(long explanation...)" / "Not Related(long explanation...)",
// occasionally both comma-joined together if the live form allowed more
// than one — this app models it as a single Related/Not Related choice,
// so the first one found wins and a warning notes if there were more.
function extractJobRelated(raw: string): { value: string; warning?: string } {
  if (!raw) return { value: '' };
  const hasRelated = /^related/i.test(raw.trim()) || /,\s*related/i.test(raw);
  const hasNotRelated = /not related/i.test(raw);
  if (hasNotRelated && /^not related/i.test(raw.trim())) return { value: 'Not Related', warning: hasRelated ? 'Multiple values selected — used "Not Related"' : undefined };
  if (/^related/i.test(raw.trim())) return { value: 'Related', warning: hasNotRelated ? 'Multiple values selected — used "Related"' : undefined };
  if (hasNotRelated) return { value: 'Not Related' };
  if (hasRelated) return { value: 'Related' };
  return { value: '', warning: `Unrecognized value "${raw}"` };
}

// Loose enough to survive minor formatting drift (case, punctuation,
// extra whitespace) between how a name was typed this time vs. however
// it's stored on an existing profile — this is a "maybe the same
// person" signal, not an exact-identity check, so it's deliberately
// forgiving rather than strict.
function normalizeNameForMatch(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------
// Duplicate detection — checked once, right after parsing, against
// existing alumni AND against every earlier row in this same file.
// `email` is a hard match (that's literally the same account); `name`
// and `batch` are softer signals surfaced for a human decision, not
// auto-resolved either way.
// ---------------------------------------------------------------------
interface DuplicateMatch {
  kind: 'email' | 'name' | 'batch';
  profileId?: string;      // set for 'email' / 'name' — the existing account this matches
  existingName?: string;
  existingEmail?: string;
  batchRowNum?: number;     // set for 'batch' — the earlier row in this file it matches
}
type Resolution = 'new' | 'update' | 'skip';

export interface MappedRow {
  rowNum: number;
  name: string;
  email: string;
  data: Record<string, unknown>;
  warnings: string[];
  fatal?: string; // missing email/first/last name — can't be imported at all
  duplicate?: DuplicateMatch;
}

function mapRow(cols: string[], rowNum: number): MappedRow {
  const warnings: string[] = [];
  const get = (i: number) => (cols[i] ?? '').trim();

  const firstName = get(COL.firstName);
  const lastName = get(COL.lastName);
  const email = get(COL.email).toLowerCase();
  const name = [firstName, lastName].filter(Boolean).join(' ') || email;

  if (!email) return { rowNum, name: name || `Row ${rowNum}`, email: '', data: {}, warnings, fatal: 'Missing email address' };
  if (!firstName || !lastName) return { rowNum, name: name || email, email, data: {}, warnings, fatal: 'Missing first or last name' };

  const mobile = get(COL.mobile);
  if (mobile && !looksLikePhoneNumber(mobile)) {
    warnings.push(`Mobile Number "${mobile}" doesn't look like a phone number — check for a shifted column in this row (e.g. a name split across the wrong fields).`);
  }

  const dept = mapDepartment(get(COL.department));
  if (dept.warning) warnings.push(dept.warning);
  const program = mapProgram(get(COL.program), dept.code);
  if (program.warning) warnings.push(program.warning);

  const yearRaw = get(COL.yearGraduated) || get(COL.yearGraduatedFallback);
  const year = Number.parseInt(yearRaw, 10);
  if (!Number.isFinite(year)) warnings.push(`Unrecognized/missing year graduated ("${yearRaw}")`);

  const employmentStatus = matchOption(get(COL.employmentStatus), EMPLOYMENT_STATUS_OPTIONS);
  if (get(COL.employmentStatus) && !employmentStatus) warnings.push(`Unrecognized employment status "${get(COL.employmentStatus)}" — stored as-is`);

  const employmentClassification = matchOption(get(COL.employmentClassification), EMPLOYMENT_CLASSIFICATION_OPTIONS);
  if (get(COL.employmentClassification) && !employmentClassification) warnings.push(`Unrecognized employment classification "${get(COL.employmentClassification)}" — stored as-is`);

  // "Job Classification" in this export reads like actual job titles
  // (e.g. "CSR", "Staff", "Project Coordinator") rather than the
  // Supervisory/Managerial/Rank-and-File picklist this app models —
  // kept verbatim as Job Title, and also matched against the picklist
  // when it happens to line up (e.g. "Managerial").
  const jobTitleRaw = get(COL.jobClassification);
  const jobClassification = matchOption(jobTitleRaw, JOB_CLASSIFICATION_OPTIONS);

  const industryRaw = get(COL.industry);
  const industry = matchOption(industryRaw, INDUSTRY_SECTOR_OPTIONS);
  if (industryRaw && !industry) warnings.push(`Unrecognized industry/sector "${industryRaw}" — filed under Other`);

  const jobRelated = extractJobRelated(get(COL.jobRelated));
  if (jobRelated.warning) warnings.push(jobRelated.warning);

  const timeToFirstJob = matchOption(get(COL.timeToFirstJob), TIME_TO_FIRST_JOB_OPTIONS);
  if (get(COL.timeToFirstJob) && !timeToFirstJob) warnings.push(`Unrecognized time-to-first-job "${get(COL.timeToFirstJob)}"`);

  const salaryRange = matchOption(get(COL.salaryRange), SALARY_RANGE_OPTIONS);
  if (get(COL.salaryRange) && !salaryRange) warnings.push(`Unrecognized salary range "${get(COL.salaryRange)}"`);

  // "How did you obtain your first job?" — same multi-vs-single mismatch
  // as job-related-to-degree; first recognizable token wins, full raw
  // text kept in the Other companion field either way for reference.
  const firstJobSourceRaw = get(COL.firstJobSource);
  const firstJobSourceTokens = firstJobSourceRaw.split(',').map(s => s.trim()).filter(Boolean);
  const firstJobSource = firstJobSourceTokens.map(t => matchOption(t, FIRST_JOB_SOURCE_OPTIONS)).find(Boolean) || (firstJobSourceRaw ? 'Other' : '');
  if (firstJobSourceRaw && !FIRST_JOB_SOURCE_OPTIONS.includes(firstJobSourceRaw as any)) {
    warnings.push(firstJobSourceTokens.length > 1 ? `Multiple values for "how first job was obtained" — kept all in Other` : `Unrecognized "how first job was obtained" value — kept in Other`);
  }

  const workLocation = matchOption(get(COL.workLocation), WORK_LOCATION_OPTIONS);
  if (get(COL.workLocation) && !workLocation) warnings.push(`Unrecognized work location "${get(COL.workLocation)}"`);

  const jobSecuring = splitMulti(get(COL.jobSecuringFactors), JOB_SECURING_FACTOR_OPTIONS);
  const programRelevance = matchOption(get(COL.programRelevance), PROGRAM_RELEVANCE_OPTIONS);
  if (get(COL.programRelevance) && !programRelevance) warnings.push(`Unrecognized program relevance "${get(COL.programRelevance)}"`);

  const competencyRatings: Record<string, string> = {};
  COMPETENCIES.forEach((c, idx) => {
    const v = get(COL.competencyStart + idx);
    if (v) competencyRatings[c] = v;
  });

  const employability = splitMulti(get(COL.employabilityExperiences), EMPLOYABILITY_EXPERIENCE_OPTIONS);
  const areasToStrengthen = splitMulti(get(COL.areasToStrengthen), AREAS_TO_STRENGTHEN_OPTIONS);

  const licensureStatus = matchOption(get(COL.licensureStatus), LICENSURE_STATUS_OPTIONS);
  if (get(COL.licensureStatus) && !licensureStatus) warnings.push(`Unrecognized licensure status "${get(COL.licensureStatus)}"`);

  const preferredActivities = splitMulti(get(COL.preferredAlumniActivities), ALUMNI_ACTIVITY_OPTIONS);
  const programImprovements = splitMulti(get(COL.programImprovements), PROGRAM_IMPROVEMENT_OPTIONS);
  const additionalServices = splitMulti(get(COL.additionalServices), ADDITIONAL_SERVICES_OPTIONS);

  const wouldRecommend = matchOption(get(COL.wouldRecommend), RECOMMEND_OPTIONS);
  if (get(COL.wouldRecommend) && !wouldRecommend) warnings.push(`Unrecognized "would recommend" value "${get(COL.wouldRecommend)}"`);

  const data: Record<string, unknown> = {
    email, first_name: firstName, last_name: lastName,
    mobile_number: get(COL.mobile) || null, social_network_id: get(COL.social) || null,
    current_address: get(COL.currentAddress) || null, permanent_address: get(COL.permanentAddress) || null,
    sex: get(COL.sex) || null, civil_status: get(COL.civilStatus) || null,
    year_graduated: Number.isFinite(year) ? year : null,
    college_department: dept.code, program_graduated: program.code,
    employment_status: employmentStatus || get(COL.employmentStatus) || null,
    employment_classification: employmentClassification || get(COL.employmentClassification) || null,
    company_organization: get(COL.company) || null,
    job_title: jobTitleRaw || null,
    job_classification: jobClassification || (jobTitleRaw ? 'Other' : null),
    job_classification_other: jobClassification ? null : (jobTitleRaw || null),
    industry_sector: industry || (industryRaw ? 'Other' : null),
    industry_sector_other: industry ? (get(COL.industryOther) || null) : (get(COL.industryOther) || industryRaw || null),
    job_related_to_degree: jobRelated.value || null,
    time_to_first_job: timeToFirstJob || null,
    monthly_salary_range: salaryRange || null,
    first_job_source: firstJobSource || null,
    first_job_source_other: firstJobSourceTokens.length > 1 || (firstJobSourceRaw && !FIRST_JOB_SOURCE_OPTIONS.includes(firstJobSourceRaw as any)) ? firstJobSourceRaw : null,
    current_work_location: workLocation || null,
    job_satisfaction_rating: get(COL.jobSatisfaction) ? Number(get(COL.jobSatisfaction)) : null,
    job_securing_factors: jobSecuring.matched,
    job_securing_factors_other: jobSecuring.unmatched.join('; ') || null,
    education_quality_rating: get(COL.educationQuality) ? Number(get(COL.educationQuality)) : null,
    program_relevance: programRelevance || null,
    competency_ratings: competencyRatings,
    employability_experiences: employability.matched,
    employability_experiences_other: employability.unmatched.join('; ') || null,
    areas_to_strengthen: areasToStrengthen.matched,
    areas_to_strengthen_other: areasToStrengthen.unmatched.join('; ') || null,
    training_satisfaction_rating: get(COL.trainingSatisfaction) ? Number(get(COL.trainingSatisfaction)) : null,
    licensure_exam_status: licensureStatus || get(COL.licensureStatus) || null,
    has_certifications: get(COL.hasCertifications) || null,
    has_professional_training: get(COL.hasProfessionalTraining) || null,
    interested_in_alumni_activities: get(COL.interestedAlumniActivities) || null,
    preferred_alumni_activities: preferredActivities.matched,
    preferred_alumni_activities_other: preferredActivities.unmatched.join('; ') || null,
    program_improvements: programImprovements.matched,
    program_improvements_other: programImprovements.unmatched.join('; ') || null,
    additional_services_needed: additionalServices.matched,
    additional_services_needed_other: additionalServices.unmatched.join('; ') || null,
    would_recommend_college: wouldRecommend || get(COL.wouldRecommend) || null,
    additional_comments: get(COL.additionalComments) || null,
  };

  return { rowNum, name, email, data, warnings };
}

type Step = 'upload' | 'checking' | 'preview' | 'importing' | 'results';
interface ResultRow { email: string; name: string; status: 'created' | 'updated' | 'skipped' | 'failed'; password?: string; reason?: string }

// One decision applies to every possible-duplicate row in the batch —
// there's no per-row picking. A row that repeats an earlier row in the
// same file (kind 'batch') has no existing record to update and
// creating two accounts with the same email would just fail, so those
// are always auto-skipped regardless of the chosen action; only
// 'email'/'name' matches (against an already-existing alumnus) go
// through `duplicateAction`, which stays unset (blocking import) until
// the admin picks one.
function rowResolution(row: MappedRow, duplicateAction: Resolution | ''): Resolution | 'unresolved' {
  if (row.fatal) return 'skip';
  if (!row.duplicate) return 'new';
  if (row.duplicate.kind === 'batch') return 'skip';
  return duplicateAction || 'unresolved';
}

export default function BulkImportResponses({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [headerWarning, setHeaderWarning] = useState<string | null>(null);
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<Resolution | ''>('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep('upload'); setHeaderWarning(null); setRows([]); setDuplicateAction(''); setResults([]); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setStep('checking');
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) { setError('That file has no data rows.'); setStep('upload'); return; }
      const header = table[0];
      const keywordChecks = [
        norm(header[COL.firstName] || '').includes('firstname'),
        norm(header[COL.lastName] || '').includes('lastname'),
        norm(header[COL.email] || '').includes('email'),
        norm(header[COL.department] || '') === 'department',
        norm(header[COL.programRelevance] || '').includes('relevant'),
      ];
      const passed = keywordChecks.filter(Boolean).length;
      if (header.length !== EXPECTED_COLUMN_COUNT || passed < 4) {
        setHeaderWarning(
          `This file has ${header.length} column(s) and only ${passed}/5 expected headers matched (looking for ` +
          `${EXPECTED_COLUMN_COUNT} columns from the Asian College Graduate Tracer Survey Google Form export). ` +
          `Mapping may be wrong — check every row below carefully before importing.`
        );
      } else {
        setHeaderWarning(null);
      }
      const mapped = table.slice(1).map((cols, i) => mapRow(cols, i + 2));

      // Duplicate check #1: against every alumnus already in the
      // database, by email (a real match) and by name (a softer one).
      const { data: existingProfiles, error: fetchErr } = await supabase
        .from('profiles').select('id, name, email').eq('role', 'alumni');
      if (fetchErr) throw fetchErr;
      const byEmail = new Map((existingProfiles || []).map(p => [String(p.email || '').toLowerCase(), p]));
      const byName = new Map((existingProfiles || []).map(p => [normalizeNameForMatch(p.name), p]));

      // Duplicate check #2: against earlier rows in this same file
      // (re-uploading the same export, or a file with repeated rows).
      const seenEmails = new Map<string, number>();

      const withDuplicates = mapped.map(r => {
        if (r.fatal) return r;
        const batchMatch = seenEmails.get(r.email);
        if (batchMatch !== undefined) {
          return { ...r, duplicate: { kind: 'batch', batchRowNum: batchMatch } as DuplicateMatch };
        }
        seenEmails.set(r.email, r.rowNum);
        const emailMatch = byEmail.get(r.email);
        if (emailMatch) {
          return { ...r, duplicate: { kind: 'email', profileId: emailMatch.id, existingName: emailMatch.name, existingEmail: emailMatch.email } as DuplicateMatch };
        }
        const nameMatch = byName.get(normalizeNameForMatch(r.name));
        if (nameMatch) {
          return { ...r, duplicate: { kind: 'name', profileId: nameMatch.id, existingName: nameMatch.name, existingEmail: nameMatch.email } as DuplicateMatch };
        }
        return r;
      });

      setRows(withDuplicates);
      setDuplicateAction('');
      setStep('preview');
    } catch (err) {
      setError(`Could not read that file: ${err instanceof Error ? err.message : String(err)}`);
      setStep('upload');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const toProcess = rows.filter(r => rowResolution(r, duplicateAction) !== 'skip' && rowResolution(r, duplicateAction) !== 'unresolved' && !r.fatal);
    if (toProcess.length === 0) { setError('No rows selected.'); return; }
    setStep('importing');
    setError('');
    const payloadRows = toProcess.map(r => {
      const resolution = rowResolution(r, duplicateAction);
      return resolution === 'update' && r.duplicate?.profileId
        ? { data: r.data, updateExistingProfileId: r.duplicate.profileId }
        : { data: r.data };
    });
    const { data, error: fnError } = await supabase.functions.invoke('tracer-intake', {
      body: { action: 'bulk_import', rows: payloadRows },
    });
    if (fnError || !data?.results) {
      let message = 'The import failed. Please try again.';
      try { const body = await fnError?.context?.json?.(); if (body?.error) message = body.error; } catch { /* keep generic */ }
      setError(message);
      setStep('preview');
      return;
    }
    setResults(data.results);
    setStep('results');
    onImported();
  };

  const downloadCredentials = () => {
    const created = results.filter(r => r.status === 'created');
    const lines = ['name,email,password', ...created.map(r => `"${r.name.replace(/"/g, '""')}",${r.email},${r.password}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-import-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resolvedRows = rows.map(r => ({ row: r, resolution: rowResolution(r, duplicateAction) }));
  const selectedCount = resolvedRows.filter(x => x.resolution !== 'skip' && x.resolution !== 'unresolved').length;
  const updateCount = resolvedRows.filter(x => x.resolution === 'update').length;
  const unresolvedCount = resolvedRows.filter(x => x.resolution === 'unresolved').length;
  const flaggedCount = rows.filter(r => !r.fatal && r.warnings.length > 0).length;
  // Only 'email'/'name' matches ever need a decision — a 'batch' repeat
  // is always auto-skipped (see rowResolution) so it's not counted here.
  const decidableDuplicateCount = rows.filter(r => r.duplicate && r.duplicate.kind !== 'batch').length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import Historical Responses</DialogTitle>
      <DialogContent>
        {step === 'upload' && (
          <div className="py-6 space-y-4">
            <p className="text-sm text-gray-600">
              Import a CSV of already-completed Graduate Tracer Survey responses (e.g. a Google Forms export)
              collected before this app existed. Each row is checked against existing alumni and against the rest
              of the file before anything is created — you'll review every row and resolve any duplicates first.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This importer is built for one specific export shape (Asian College's own Graduate Tracer Survey
                Google Form). A file with different columns will likely map incorrectly — you'll get a warning if
                that looks like the case, and every row's mapped data is shown before import either way.
              </p>
            </div>
            {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button variant="contained" startIcon={<Upload className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()}>
              Choose CSV File
            </Button>
          </div>
        )}

        {step === 'checking' && (
          <div className="py-16 text-center text-sm text-gray-500">Checking for duplicates…</div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 py-2">
            {headerWarning && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {headerWarning}
              </div>
            )}
            {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>}
            {decidableDuplicateCount > 0 && (
              <div className={`px-3 py-2 rounded-md text-sm flex items-center gap-3 flex-wrap ${unresolvedCount > 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
                <Copy className="w-4 h-4 flex-shrink-0" />
                <span>
                  {decidableDuplicateCount} possible duplicate{decidableDuplicateCount === 1 ? '' : 's'} found (flagged in the Match column below).
                  Choose what to do with all of them:
                </span>
                <FormControl size="small" error={unresolvedCount > 0}>
                  <Select
                    displayEmpty
                    value={duplicateAction}
                    onChange={(e: SelectChangeEvent) => setDuplicateAction(e.target.value as Resolution)}
                    sx={{ fontSize: '0.8rem', height: 32, minWidth: 230, bgcolor: 'white' }}
                  >
                    <MenuItem value="" disabled><em>Choose action…</em></MenuItem>
                    <MenuItem value="skip">Skip — don't import them</MenuItem>
                    <MenuItem value="update">Update the existing records</MenuItem>
                    <MenuItem value="new">Import as new accounts anyway</MenuItem>
                  </Select>
                </FormControl>
              </div>
            )}
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {rows.length} row(s) parsed — {selectedCount} will be processed
                {updateCount > 0 ? ` (${updateCount} as an update to an existing record)` : ''}, {flaggedCount} flagged with data-quality warnings, {rows.filter(r => r.fatal).length} unusable.
              </span>
            </div>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Department / Program</TableCell>
                    <TableCell>Data Quality</TableCell>
                    <TableCell>Match</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(r => {
                    const resolution = rowResolution(r, duplicateAction);
                    return (
                      <TableRow key={r.rowNum} hover selected={resolution === 'unresolved'}>
                        <TableCell>{r.rowNum}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.email || '—'}</TableCell>
                        <TableCell>{r.data.college_department as string || '—'} / {r.data.program_graduated as string || '—'}</TableCell>
                        <TableCell>
                          {r.fatal ? (
                            <Chip size="small" color="error" icon={<Ban className="w-3 h-3" />} label={r.fatal} />
                          ) : r.warnings.length > 0 ? (
                            <Tooltip title={<div>{r.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div>}>
                              <Chip size="small" color="warning" icon={<AlertTriangle className="w-3 h-3" />} label={`${r.warnings.length} warning(s)`} />
                            </Tooltip>
                          ) : (
                            <Chip size="small" color="success" icon={<CheckCircle className="w-3 h-3" />} label="Looks good" />
                          )}
                        </TableCell>
                        <TableCell>
                          {!r.duplicate ? (
                            <span className="text-xs text-gray-400">New</span>
                          ) : r.duplicate.kind === 'email' ? (
                            <Tooltip title={`Existing account: ${r.duplicate.existingName} <${r.duplicate.existingEmail}> — will be ${resolution === 'update' ? 'updated' : resolution === 'new' ? 'imported as a separate new account' : 'skipped'}`}>
                              <Chip size="small" color="error" label="Already has an account" />
                            </Tooltip>
                          ) : r.duplicate.kind === 'name' ? (
                            <Tooltip title={`Existing account with the same name: ${r.duplicate.existingName} <${r.duplicate.existingEmail}> — will be ${resolution === 'update' ? 'updated' : resolution === 'new' ? 'imported as a separate new account' : 'skipped'}`}>
                              <Chip size="small" color="warning" label="Same name exists" />
                            </Tooltip>
                          ) : (
                            <Tooltip title={`Same email already appears at row ${r.duplicate.batchRowNum} in this file — the repeat is always skipped`}>
                              <Chip size="small" color="warning" label={`Repeats row ${r.duplicate.batchRowNum} — skipped`} />
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-16 text-center text-sm text-gray-500">Creating and updating accounts…</div>
        )}

        {step === 'results' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1 text-green-700"><CheckCircle className="w-4 h-4" /> {results.filter(r => r.status === 'created').length} created</span>
              <span className="flex items-center gap-1 text-blue-700"><Copy className="w-4 h-4" /> {results.filter(r => r.status === 'updated').length} updated</span>
              <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-4 h-4" /> {results.filter(r => r.status === 'skipped').length} skipped</span>
              <span className="flex items-center gap-1 text-red-700"><XCircle className="w-4 h-4" /> {results.filter(r => r.status === 'failed').length} failed</span>
            </div>
            {results.some(r => r.status === 'created') && (
              <Button variant="contained" startIcon={<Download className="w-4 h-4" />} onClick={downloadCredentials}>
                Download Credentials CSV
              </Button>
            )}
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.email}</TableCell>
                      <TableCell>
                        <Chip size="small"
                          color={r.status === 'created' ? 'success' : r.status === 'updated' ? 'info' : r.status === 'skipped' ? 'warning' : 'error'}
                          label={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {r.reason || (r.status === 'created' ? 'Password shown in the download above' : r.status === 'updated' ? "Existing record refreshed — sign-in details unchanged" : '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              The credentials CSV is shown only once and can't be regenerated — download it now if you haven't.
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{step === 'results' ? 'Done' : 'Cancel'}</Button>
        {step === 'preview' && (
          <Button variant="contained" disabled={selectedCount === 0 || unresolvedCount > 0} onClick={handleImport}>
            {unresolvedCount > 0 ? 'Choose a Duplicate Action Above First' : `Import ${selectedCount} Row${selectedCount === 1 ? '' : 's'}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
