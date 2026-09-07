import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Download, ChevronDown, Users, BarChart3 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';
import { supabase } from '../../../lib/supabaseClient';
import { getBatchYearOptions } from '../../../lib/batchYears';
import {
  DEPARTMENTS as ACADEMIC_DEPARTMENTS,
  ALL_PROGRAM_CODES,
  PROGRAMS_BY_DEPT,
  PROGRAM_TO_DEPARTMENT,
  normalizeProgramCode,
} from '../../../lib/academicPrograms';
import {
  JOB_RELATED_OPTIONS, TIME_TO_FIRST_JOB_OPTIONS,
} from '../../../lib/graduateTracerSurveyOptions';
import { useDarkMode } from './DarkModeContext';

// ================= [SHARED: ALUMNIMANAGEMENTVIEW] =================
// The full Alumni Tracer screen (labeled "Alumni Tracer" in both the admin
// and faculty nav — this file/component name is the one holdover from its
// old "Alumni Management" name), search/filter, export, and each alumnus's
// Graduate Profile columns, shared verbatim between the admin page
// (admin/AlumniManagement.tsx) and the faculty page
// (faculty/FacultyAlumniManagement.tsx) — one implementation so a feature
// added here reaches both roles instead of two copies silently drifting
// apart. Mirrors the split already used for Donation Management — see
// shared/DonationManagementView.tsx's header comment for the same
// rationale. Read-only from here — no verifying, no donation modal, no
// per-row edit action — since an alumnus's own record (including the
// Graduate Profile columns below) is only ever editable by that alumnus,
// from their own Profile page.
//

// `department` is the ONLY behavioral difference between the two:
//   - omitted (admin): sees every department's alumni, unrestricted.
//   - set (faculty): every list, stat, and filter below is scoped to
//     just that department, and the Department filter/column is hidden
//     (nothing to switch between). This is a UI convenience only — the
//     real boundary is enforced at the database via RLS (see
//     supabase/faculty_alumni_tracer_scope.sql, and the pre-existing
//     "Faculty can view alumni in their department" policy), so a
//     faculty account can't reach another department's alumni even by
//     bypassing this screen.

// Graduate Profile fields, rendered as their own columns on the Alumni
// Management table below so every alumnus's self-reported profile is
// visible at a glance. `key` matches the graduate_tracer_responses column
// name exactly, so it doubles as the bulk-select list in loadAlumni.
const GRADUATE_PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: 'mobile_number', label: 'Mobile Number' },
  { key: 'current_address', label: 'Current Address' },
  { key: 'permanent_address', label: 'Permanent Address' },
  { key: 'sex', label: 'Sex' },
  { key: 'civil_status', label: 'Civil Status' },
  { key: 'year_graduated', label: 'Year Graduated' },
  { key: 'college_department', label: 'College Department' },
  { key: 'program_graduated', label: 'Program Graduated' },
  { key: 'social_network_id', label: 'Social Network ID' },
];

// Job Information columns — the one part of an alumnus's Graduate Tracer
// Survey response that stays editable after submission, from their own
// Profile page (see shared/JobInfoCard.tsx, and the database trigger in
// supabase/graduate_tracer_job_info_edit.sql that actually enforces
// which columns that screen may still change). Rendered as their own
// column group, right after Graduate Profile, so an edit an alumnus
// makes there shows up here automatically the next time this loads —
// no extra wiring beyond the shared bulk fetch below.
const JOB_INFO_FIELDS: { key: string; label: string }[] = [
  { key: 'employment_status', label: 'Employment Status' },
  { key: 'employment_classification', label: 'Employment Classification' },
  { key: 'company_organization', label: 'Company / Organization' },
  { key: 'job_classification', label: 'Job Classification' },
  { key: 'industry_sector', label: 'Industry / Sector' },
  { key: 'job_related_to_degree', label: 'Job Related to Degree' },
  { key: 'monthly_salary_range', label: 'Monthly Salary Range' },
  { key: 'current_work_location', label: 'Current Work Location' },
];

// Employment fields the Analytics Report's charts need beyond
// JOB_INFO_FIELDS above — fetched in the same bulk query but not shown
// as their own table columns.
const ANALYTICS_EXTRA_FIELDS = ['time_to_first_job', 'job_satisfaction_rating'];

function fmtTracerValue(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

// ---- Analytics Report ----
// Moved here from shared/TracerResponsesView.tsx (previously the
// "Analytics Report" view under admin/faculty Tracer Responses) so it
// runs off Alumni Tracer's own already-loaded roster instead of a
// separate fetch — every chart below reflects the exact same alumni (and
// the same search/filters) as the table on the "Alumni Records" tab.
//
// Collapses the granular employment_status picklist into the four outcome
// buckets an actual tracer study reports on, so "employment rate" means
// something consistent across every chart/table below.
type EmploymentBucket = 'Employed' | 'Further Studies' | 'Unemployed' | 'Not Seeking' | 'No Response';
const EMPLOYMENT_BUCKETS: EmploymentBucket[] = ['Employed', 'Further Studies', 'Unemployed', 'Not Seeking', 'No Response'];
const EMPLOYMENT_BUCKET_COLORS: Record<EmploymentBucket, string> = {
  Employed: '#10b981', 'Further Studies': '#3b82f6', Unemployed: '#ef4444', 'Not Seeking': '#f59e0b', 'No Response': '#9ca3af',
};

// Per-department color coding — Analytics Report only (the Alumni Records
// table's own "College Department" column stays plain text). Fixed per
// department rather than assigned by array index/order, so a department's
// color stays the same regardless of sort order or which departments are
// currently present in the filtered data. Keyed by the DEPARTMENTS codes
// in lib/academicPrograms.ts ('BAA'/'CSE'/'CTHM' — CTHM is "THM").
const DEPARTMENT_COLORS: Record<string, string> = {
  BAA: '#eab308', // yellow
  CSE: '#a855f7', // purple
  CTHM: '#ef4444', // red
};
// Readable text color to pair with each DEPARTMENT_COLORS fill above, e.g.
// for the Chip in the Employment Rate by Program table — yellow needs a
// dark label for contrast, purple/red read fine with white.
const DEPARTMENT_TEXT_COLORS: Record<string, string> = {
  BAA: '#422006',
  CSE: '#ffffff',
  CTHM: '#ffffff',
};
const DEFAULT_DEPARTMENT_COLOR = '#9ca3af'; // any department not in the map above (shouldn't happen, but keeps charts from breaking on stale/legacy data)

// Kept in sync by hand with EMPLOYMENT_STATUS_OPTIONS in
// lib/graduateTracerSurveyOptions.ts (copied from the official Graduate
// Tracer Survey document) — same judgment call as the tracer-intake
// Edge Function's EMPLOYMENT_STATUS_MAP for "Preparing for Licensure
// Examination" (closer to Unemployed than Further Studies, which is
// specifically about further/graduate studies).
function classifyEmployment(status: string | null | undefined): EmploymentBucket {
  if (!status) return 'No Response';
  if (status === 'Pursuing Graduate Studies') return 'Further Studies';
  if (status === 'Preparing for Licensure Examination') return 'Unemployed';
  if (status === 'Currently Unemployed (Seeking Employment)') return 'Unemployed';
  if (status === 'Currently Unemployed (Not Seeking Employment)') return 'Not Seeking';
  return 'Employed';
}

// Counts how many alumni (among those who've submitted a Graduate Tracer
// Survey response) picked each option for a single-select field.
function aggregateBucket(rows: AlumniRow[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach(a => {
    const v = a.graduateProfile?.[key];
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return counts;
}

// Bulk export of the (scoped) alumni database. Tabular/structured formats
// only — this is alumni records, not a document, so no Word/OpenDocument,
// RTF, zipped HTML, EPUB, or Markdown options.
const EXPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel (.xlsx)' },
  { id: 'csv', label: 'CSV (.csv)' },
  { id: 'pdf', label: 'PDF (.pdf)' },
] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number]['id'];

// Fixed column order shared by every export format, so a filtered-down (or
// empty) result set doesn't change which columns show up.
const EXPORT_COLUMNS = ['Name', 'Email', 'Department', 'Program', 'Batch Year', 'Status', 'Record State'] as const;

// Department/program options now come from the shared catalog (see
// src/lib/academicPrograms.ts) so this filter/editor can't drift out of
// sync with the signup form or any other picker in the app.
const DEPARTMENTS = ['All', ...ACADEMIC_DEPARTMENTS];

const ALL_PROGRAMS = ALL_PROGRAM_CODES;

const normalizeProgram = normalizeProgramCode;

const BATCH_YEARS = getBatchYearOptions().map(String);

interface AlumniRow {
  id: string;
  name: string;
  email: string;
  department: string;
  program: string;
  batchYear: number;
  verified: boolean;
  active: boolean;
  // Graduate Profile fields from the alumnus's own submitted Graduate
  // Tracer Survey response (see GRADUATE_PROFILE_FIELDS) — null until the
  // bulk fetch in loadAlumni resolves, then null forever if they haven't
  // submitted a response. Keyed by the same snake_case column names as
  // graduate_tracer_responses.
  graduateProfile: Record<string, any> | null;
}

// "Lastname, Firstname M." — e.g. "Luwie E. Regaspi" -> "Regaspi, Luwie E.".
// `profiles.name` is stored as a single free-text string (first + last
// joined with a space at account-creation time — see tracer-intake's
// provisionAccount()), and a middle initial typed into the First Name
// field just becomes an extra token before the last one, so the last
// whitespace-separated token is always treated as the last name and
// everything before it (first name, plus any middle name/initial) stays
// in its original order, just capitalized.
function capitalizeNamePart(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatDisplayName(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return capitalizeNamePart(parts[0]);
  const last = parts[parts.length - 1];
  const firstAndMiddle = parts.slice(0, -1).map(capitalizeNamePart).join(' ');
  return `${capitalizeNamePart(last)}, ${firstAndMiddle}`;
}

// Same last-name convention as formatDisplayName above (last whitespace
// token) — used to sort the roster by surname instead of by given name.
function lastNameOf(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function mapRow(p: any): AlumniRow {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    department: p.department || '—',
    program: p.program || '—',
    batchYear: p.batch_year || 0,
    verified: !!p.batch_verified,
    active: p.active !== false,
    graduateProfile: null,
  };
}

interface Props {
  // Faculty pass their own department here to lock the whole screen to
  // it; admin renders this with no department at all.
  department?: string;
}

export default function AlumniManagementView({ department }: Props) {
  const { dark } = useDarkMode();
  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'records' | 'analytics'>('records');

  // Analytics Report's own Department filter — kept entirely separate from
  // the Alumni Records filter above (filterDept etc.) so narrowing the
  // report down doesn't also narrow the roster table, or vice versa. Just
  // Department (unlike the Records filter's Department/Program/Batch Year)
  // since that's the one breakdown the report's charts need to scope by.
  // See `analyticsFiltered` below for where this is applied.
  const [analyticsFilterDept, setAnalyticsFilterDept] = useState('All');
  const [showAnalyticsFilters, setShowAnalyticsFilters] = useState(false);
  const analyticsFilterMenuRef = useRef<HTMLDivElement>(null);

  const loadAlumni = async () => {
    // Only admin-approved accounts belong here — Pending Registrations
    // (and Rejected) are handled on their own screen. Without this filter
    // an account still awaiting approval (or turned down) would already
    // show up in this list before the admin ever acted on it.
    let query = supabase.from('profiles').select('*').eq('role', 'alumni').eq('registration_status', 'approved');
    if (department) query = query.eq('department', department);
    const { data } = await query.order('created_at', { ascending: false });
    const rows = (data || []).map(mapRow);

    // Bulk-fetch every listed alumnus's submitted Graduate Tracer Survey
    // response in one query and merge it onto their row — GRADUATE_PROFILE_FIELDS
    // and JOB_INFO_FIELDS both render as table columns (JOB_INFO_FIELDS is the
    // one group an alumnus can keep updating post-submission from their
    // Profile page), and ANALYTICS_EXTRA_FIELDS feeds the Analytics Report tab's
    // charts only.
    if (rows.length) {
      const { data: tracerRows } = await supabase
        .from('graduate_tracer_responses')
        .select(['respondent_id', ...GRADUATE_PROFILE_FIELDS.map(f => f.key), ...JOB_INFO_FIELDS.map(f => f.key), ...ANALYTICS_EXTRA_FIELDS].join(', '))
        .in('respondent_id', rows.map(r => r.id))
        .eq('status', 'submitted');
      const byRespondent = new Map((tracerRows || []).map((t: any) => [t.respondent_id, t]));
      rows.forEach(r => { r.graduateProfile = byRespondent.get(r.id) || null; });
    }

    setAlumni(rows);
    setLoading(false);
  };

  useEffect(() => { loadAlumni(); }, [department]);

  useEffect(() => {
    if (!exportOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [exportOpen]);

  useEffect(() => {
    if (!showAnalyticsFilters) return;
    const onClickOutside = (e: MouseEvent) => {
      if (analyticsFilterMenuRef.current && !analyticsFilterMenuRef.current.contains(e.target as Node)) setShowAnalyticsFilters(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showAnalyticsFilters]);

  // Which department's program list the Program filter/editor should
  // offer — faculty always see just their own department's programs;
  // admin sees whatever department is currently picked in the filter
  // (or every program, until one is).
  const effectiveDeptForPrograms = department || filterDept;

  const filtered = alumni.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.includes(q);
    const matchDept = department ? true : (filterDept === 'All' || a.department === filterDept);
    const matchProgram = filterProgram === 'All' || normalizeProgram(a.program) === filterProgram;
    const matchYear = filterYear === 'All' || a.batchYear.toString() === filterYear;
    return matchSearch && matchDept && matchProgram && matchYear;
  }).sort((a, b) => lastNameOf(a.name).localeCompare(lastNameOf(b.name)) || a.name.localeCompare(b.name));

  // Analytics Report's own filter — just Department (see analyticsFilterDept
  // above), independent of the Alumni Records tab's filter.
  const analyticsFiltered = alumni.filter(a => {
    return department ? true : (analyticsFilterDept === 'All' || a.department === analyticsFilterDept);
  });

  // Whenever the report ends up scoped to exactly one department — either
  // the whole screen is department-locked (faculty) or an admin picked one
  // in the Analytics Report's own Department filter — the "College
  // Department" pie chart below would just be a single 100% slice, so it's
  // hidden instead of shown as a redundant chart (see analyticsSingleDept
  // usage further down).
  const analyticsSingleDept = department || (analyticsFilterDept !== 'All' ? analyticsFilterDept : null);

  // Analytics Report data — all derived from `analyticsFiltered` (its own
  // filter, independent of the "Alumni Records" tab's), then narrowed to
  // `submitted` for anything that needs actual survey answers (an alumnus
  // with no Graduate Tracer Survey response has nothing to chart).
  const submitted = useMemo(() => analyticsFiltered.filter(a => a.graduateProfile !== null), [analyticsFiltered]);
  const responseCoveragePct = analyticsFiltered.length ? (submitted.length / analyticsFiltered.length) * 100 : 0;

  const yearGraduatedDistribution = useMemo(() => {
    const counts = aggregateBucket(submitted, 'year_graduated');
    return Object.keys(counts).sort((a, b) => Number(a) - Number(b)).map(year => ({ year, value: counts[year] }));
  }, [submitted]);

  const collegeDeptDistribution = useMemo(() => {
    const counts = aggregateBucket(submitted, 'college_department');
    const total = submitted.length;
    return (analyticsSingleDept ? [analyticsSingleDept] : ACADEMIC_DEPARTMENTS)
      .map(dept => ({ name: dept, value: counts[dept] || 0, pct: total ? ((counts[dept] || 0) / total) * 100 : 0 }))
      .filter(d => d.value > 0);
  }, [submitted, analyticsSingleDept]);

  const programGraduatedDistribution = useMemo(() => {
    const counts = aggregateBucket(submitted, 'program_graduated');
    const total = submitted.length;
    return Object.keys(counts)
      .map(program => ({ name: program, value: counts[program], pct: total ? (counts[program] / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [submitted]);

  const employmentOverview = useMemo(() => {
    const counts: Record<EmploymentBucket, number> = { Employed: 0, 'Further Studies': 0, Unemployed: 0, 'Not Seeking': 0, 'No Response': 0 };
    submitted.forEach(a => { counts[classifyEmployment(a.graduateProfile?.employment_status)]++; });
    const total = submitted.length;
    return EMPLOYMENT_BUCKETS
      .map(bucket => ({ name: bucket, value: counts[bucket], pct: total ? (counts[bucket] / total) * 100 : 0, color: EMPLOYMENT_BUCKET_COLORS[bucket] }))
      .filter(b => b.value > 0);
  }, [submitted]);

  const employmentByDept = useMemo(() => (analyticsSingleDept ? [analyticsSingleDept] : ACADEMIC_DEPARTMENTS).map(dept => {
    const deptRows = submitted.filter(a => a.department === dept);
    const total = deptRows.length;
    const counts: Record<EmploymentBucket, number> = { Employed: 0, 'Further Studies': 0, Unemployed: 0, 'Not Seeking': 0, 'No Response': 0 };
    deptRows.forEach(a => { counts[classifyEmployment(a.graduateProfile?.employment_status)]++; });
    const pct = (bucket: EmploymentBucket) => total ? Math.round((counts[bucket] / total) * 1000) / 10 : 0;
    return {
      department: dept, total,
      Employed: pct('Employed'), 'Further Studies': pct('Further Studies'),
      Unemployed: pct('Unemployed'), 'Not Seeking': pct('Not Seeking'), 'No Response': pct('No Response'),
    };
  }).filter(d => d.total > 0), [submitted, analyticsSingleDept]);

  const employmentByProgram = useMemo(() => {
    const programs = Array.from(new Set(submitted.map(a => normalizeProgram(a.program)).filter(Boolean)));
    return programs.map(program => {
      const programRows = submitted.filter(a => normalizeProgram(a.program) === program);
      const total = programRows.length;
      const employed = programRows.filter(a => classifyEmployment(a.graduateProfile?.employment_status) === 'Employed').length;
      return { program, department: PROGRAM_TO_DEPARTMENT[program] || '—', total, employedPct: total ? (employed / total) * 100 : 0 };
    }).sort((a, b) => a.department.localeCompare(b.department) || a.program.localeCompare(b.program));
  }, [submitted]);

  const trendByBatchYear = useMemo(() => {
    const years = Array.from(new Set(submitted.map(a => a.batchYear).filter((y): y is number => !!y))).sort((a, b) => a - b);
    return years.map(year => {
      const yearRows = submitted.filter(a => a.batchYear === year);
      const employed = yearRows.filter(a => classifyEmployment(a.graduateProfile?.employment_status) === 'Employed').length;
      const satVals = yearRows.map(a => a.graduateProfile?.job_satisfaction_rating).filter((v: any) => typeof v === 'number');
      const avgSat = satVals.length ? satVals.reduce((s: number, v: number) => s + v, 0) / satVals.length : null;
      return {
        year: String(year), respondents: yearRows.length,
        employmentRate: yearRows.length ? (employed / yearRows.length) * 100 : 0,
        avgSatisfaction: avgSat,
      };
    });
  }, [submitted]);

  const jobRelevance = useMemo(() => {
    const counts = aggregateBucket(submitted, 'job_related_to_degree');
    const total = submitted.length;
    return JOB_RELATED_OPTIONS.map(opt => ({ name: opt, value: counts[opt] || 0, pct: total ? ((counts[opt] || 0) / total) * 100 : 0 }));
  }, [submitted]);

  const timeToFirstJob = useMemo(() => {
    const counts = aggregateBucket(submitted, 'time_to_first_job');
    const total = submitted.length;
    return TIME_TO_FIRST_JOB_OPTIONS.map(opt => ({ name: opt, value: counts[opt] || 0, pct: total ? ((counts[opt] || 0) / total) * 100 : 0 }));
  }, [submitted]);

  // Chart colors — same dark/light pairing PopulationAnalytics.tsx and
  // Reports.tsx use, so these charts match the rest of the dashboard
  // instead of staying a bright light-mode box when dark mode is on.
  const chartAxisColor = dark ? '#b8d4f0' : '#4b5563';
  const chartLineColor = dark ? '#334155' : '#d1d5db';
  const chartGridColor = dark ? '#334155' : '#e5e7eb';
  const chartTooltipStyle = {
    background: dark ? '#1a2332' : '#ffffff',
    border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
    borderRadius: 8,
    color: dark ? '#e8f2ff' : '#111827',
  };

  const exportAlumni = (format: ExportFormat) => {
    setExportOpen(false);
    const rows: Record<(typeof EXPORT_COLUMNS)[number], string | number>[] = filtered.map(a => ({
      Name: formatDisplayName(a.name),
      Email: a.email,
      Department: a.department,
      Program: a.program,
      'Batch Year': a.batchYear || '',
      Status: a.verified ? 'Verified' : 'Unverified',
      'Record State': a.active ? 'Active' : 'Archived',
    }));
    const timestamp = new Date().toISOString().slice(0, 10);
    const generatedAt = `Generated ${new Date().toLocaleString()} • ${rows.length} alumni${department ? ` • ${department}` : ''}`;

    const download = (content: BlobPart, mimeType: string, extension: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alumni-tracer-${department ? `${department}-` : ''}${timestamp}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    };

    switch (format) {
      case 'csv': {
        const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
        download(XLSX.utils.sheet_to_csv(sheet), 'text/csv;charset=utf-8;', 'csv');
        break;
      }
      case 'xlsx': {
        const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Alumni');
        // Build the raw xlsx bytes ourselves (rather than XLSX.writeFile, which
        // downloads with a generic application/octet-stream MIME type) so the
        // browser gets the real OOXML content-type alongside the .xlsx extension.
        const xlsxBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        download(xlsxBytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
        break;
      }
      case 'pdf': {
        // Rendered as an actual formatted table/report (title + generated-on
        // line + a real table), not a dump of raw JSON/CSV text.
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Alumni Tracer Report', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(generatedAt, 14, 21);
        autoTable(doc, {
          startY: 26,
          head: [[...EXPORT_COLUMNS]],
          body: rows.map(r => EXPORT_COLUMNS.map(c => String(r[c]))),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [27, 58, 107] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        });
        download(doc.output('blob'), 'application/pdf', 'pdf');
        break;
      }
    }
  };

  const filterFields = [
    ...(department ? [] : [{
      label: 'Department', value: filterDept, opts: DEPARTMENTS,
      onChange: (v: string) => { setFilterDept(v); setFilterProgram('All'); },
    }]),
    {
      label: 'Program', value: filterProgram,
      opts: ['All', ...(effectiveDeptForPrograms === 'All' ? ALL_PROGRAMS : (PROGRAMS_BY_DEPT[effectiveDeptForPrograms as keyof typeof PROGRAMS_BY_DEPT] || []).map(p => p.code))],
      onChange: setFilterProgram,
    },
    { label: 'Batch Year', value: filterYear, opts: ['All', ...BATCH_YEARS], onChange: setFilterYear },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Alumni Tracer</h2>
          <p className="text-sm text-gray-500">
            {department
              ? <>Track <strong>{department}</strong> department alumni records</>
              : 'Track all registered alumni records'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {view === 'records' && (
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setExportOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Download className="w-4 h-4" /> Export <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-20">
                  <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Download as</p>
                  {EXPORT_FORMATS.map(({ id, label }) => (
                    <button key={id} onClick={() => exportAlumni(id)}
                      className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {department && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-amber-600">🔒</span>
          <p className="text-xs text-amber-700 font-medium">
            You can only see alumni for <strong>{department}</strong>. Other departments are out of reach — enforced by database policy, not just this screen.
          </p>
        </div>
      )}

      {/* Tab switcher — Alumni Records (the roster table) vs. Analytics
          Report (charts, moved here from Tracer Responses so they run off
          this same roster/filters instead of a separate fetch). There used
          to be a third, admin-only "Alumni Roster" tab for the registrar
          match-source importer (admin/AlumniRoster.tsx) — that component
          and its `alumni_roster` matching logic are untouched, it's just
          not surfaced here anymore. */}
      <div className="flex gap-2">
        <button onClick={() => setView('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'records' ? 'text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          style={view === 'records' ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
          <Users className="w-4 h-4" /> Alumni Records
        </button>
        <button onClick={() => setView('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === 'analytics' ? 'text-white' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          style={view === 'analytics' ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
          <BarChart3 className="w-4 h-4" /> Analytics Report
        </button>
      </div>

      {view === 'records' && (
      <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {filterFields.map(f => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
                <select value={f.value} onChange={e => f.onChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">
            {loading ? 'Loading…' : `${filtered.length} alumni found`}
          </span>
        </div>
        {/* Bounded height + its own scroll (both axes) — needed for the
            sticky header row and frozen Name column below to actually
            work: CSS `position: sticky` only sticks relative to its
            nearest scrolling ancestor, and without a bounded height here
            that ancestor would just grow to fit every row, leaving the
            header nothing to stick against as the page itself scrolls. */}
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {/* Name is frozen on BOTH axes (sticky top-0 left-0) — it's
                    the corner cell, so it has to out-rank (z-30) both the
                    rest of the sticky header row (z-20) and the frozen
                    body column beneath it (z-10) at their overlap. */}
                <th className="sticky top-0 left-0 z-30 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left bg-gray-50 border-b border-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Name</th>
                {GRADUATE_PROFILE_FIELDS.map(f => (
                  <th key={f.key} className="sticky top-0 z-20 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left bg-gray-50 border-b border-gray-100">{f.label}</th>
                ))}
                {/* Job Information — kept current by the alumnus themself
                    from their Profile page even after their tracer survey
                    is otherwise locked; see JOB_INFO_FIELDS above. */}
                {JOB_INFO_FIELDS.map(f => (
                  <th key={f.key} className="sticky top-0 z-20 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left bg-blue-50/60 border-b border-gray-100">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={1 + GRADUATE_PROFILE_FIELDS.length + JOB_INFO_FIELDS.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  No alumni registered yet.
                </td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 z-10 px-4 py-3 bg-white group-hover:bg-gray-50 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    <div className="font-semibold text-gray-800">{formatDisplayName(a.name)}</div>
                    <div className="text-xs text-gray-400">{a.email}</div>
                  </td>
                  {/* Graduate Profile columns — from the alumnus's own submitted
                      Graduate Tracer Survey response, merged in by loadAlumni.
                      '—' for anyone who hasn't submitted one yet. */}
                  {GRADUATE_PROFILE_FIELDS.map(f => {
                    // Addresses run long enough that a single-line
                    // truncate + hover-title (every other column's
                    // treatment) still hides most of it — let these two
                    // wrap onto a couple of lines instead so the whole
                    // thing is visible without hovering.
                    const isAddress = f.key === 'current_address' || f.key === 'permanent_address';
                    return (
                      <td
                        key={f.key}
                        className={`px-4 py-3 text-gray-600 ${isAddress ? 'max-w-[260px] min-w-[200px] whitespace-normal break-words' : 'max-w-[180px] truncate'}`}
                        title={!isAddress && a.graduateProfile ? fmtTracerValue(a.graduateProfile[f.key]) : undefined}
                      >
                        {a.graduateProfile ? fmtTracerValue(a.graduateProfile[f.key]) : '—'}
                      </td>
                    );
                  })}
                  {/* Job Information columns — still editable by the alumnus
                      after submission, so these reflect their latest save. */}
                  {JOB_INFO_FIELDS.map(f => (
                    <td key={f.key} className="px-4 py-3 text-gray-600 max-w-[180px] truncate bg-blue-50/30" title={a.graduateProfile ? fmtTracerValue(a.graduateProfile[f.key]) : undefined}>
                      {a.graduateProfile ? fmtTracerValue(a.graduateProfile[f.key]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {view === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Ties the report back to the full Alumni Records roster —
                not just whoever happened to submit a response. */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-1">
              {analyticsFiltered.length === 0 ? (
                <p className="text-sm text-gray-400 py-1">No alumni match this filter.</p>
              ) : (
                <>
                  <span className="text-sm text-gray-600">Graduate Tracer Survey Response Rate</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{responseCoveragePct.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400 mt-1">{submitted.length} of {analyticsFiltered.length} alumni have submitted a response</p>
                </>
              )}
            </div>

            {/* This report's own Department filter, positioned right beside
                the Response Rate card — separate from the Alumni Records
                tab's filter above, so narrowing one doesn't narrow the
                other. Just Department (see analyticsFilterDept above). */}
            {!department && (
              <div className="relative shrink-0" ref={analyticsFilterMenuRef}>
                <button onClick={() => setShowAnalyticsFilters(f => !f)}
                  className="flex items-center gap-2 px-4 py-2 h-full rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white">
                  <Filter className="w-4 h-4" /> Filters <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAnalyticsFilters ? 'rotate-180' : ''}`} />
                </button>
                {showAnalyticsFilters && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl border border-gray-100 shadow-lg p-3 z-20">
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Department</label>
                    <select value={analyticsFilterDept} onChange={e => setAnalyticsFilterDept(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
                      {DEPARTMENTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {analyticsFiltered.length > 0 && (
            submitted.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
                None of these alumni have submitted a Graduate Tracer Survey response yet.
              </div>
            ) : (
                <>
                  {/* ---- Graduate Profile ---- */}
                  <h3 className="text-lg font-bold text-gray-800">Graduate Profile</h3>
                  <Card><CardContent>
                    <h3 className="font-bold text-gray-800 mb-3">Year Graduated</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={yearGraduatedDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="year" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                        <YAxis tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} allowDecimals={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="value" fill="#10b981" name="Alumni" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent></Card>

                  {analyticsSingleDept ? (
                    // Already scoped to one department (faculty lock, or the
                    // Department filter above) — a "College Department" pie
                    // chart would just be a single 100% slice, so skip it
                    // and let Program Graduated take the full width instead.
                    <Card><CardContent>
                      <h3 className="font-bold text-gray-800 mb-3">Program Graduated</h3>
                      <ResponsiveContainer width="100%" height={Math.max(240, programGraduatedDistribution.length * 28)}>
                        <BarChart data={programGraduatedDistribution} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fill: chartAxisColor, fontSize: 11 }} axisLine={{ stroke: chartLineColor }} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct.toFixed(0)}%)`, 'Alumni']} />
                          <Bar dataKey="value" fill="#3b82f6" name="Alumni" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card><CardContent>
                        <h3 className="font-bold text-gray-800 mb-3">College Department</h3>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={collegeDeptDistribution} cx="50%" cy="50%" labelLine={false} outerRadius={85} dataKey="value"
                              label={(entry: any) => `${entry.name}: ${entry.pct.toFixed(0)}%`}
                            >
                              {collegeDeptDistribution.map((entry, i) => <Cell key={i} fill={DEPARTMENT_COLORS[entry.name] || DEFAULT_DEPARTMENT_COLOR} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              formatter={(value: any, name: any, props: any) => [`${value} (${props.payload.pct.toFixed(1)}%)`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent></Card>
                      <Card><CardContent>
                        <h3 className="font-bold text-gray-800 mb-3">Program Graduated</h3>
                        <ResponsiveContainer width="100%" height={Math.max(240, programGraduatedDistribution.length * 28)}>
                          <BarChart data={programGraduatedDistribution} layout="vertical" margin={{ left: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                            <XAxis type="number" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fill: chartAxisColor, fontSize: 11 }} axisLine={{ stroke: chartLineColor }} />
                            <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct.toFixed(0)}%)`, 'Alumni']} />
                            <Bar dataKey="value" fill="#3b82f6" name="Alumni" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent></Card>
                    </div>
                  )}

                  {/* ---- Employment Outcomes (moved here from Tracer
                      Responses' old "Analytics Report" view, verbatim) ---- */}
                  <h3 className="text-lg font-bold text-gray-800 pt-2">Employment Outcomes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {employmentOverview.map(b => (
                      <Card key={b.name}><CardContent>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{b.name}</span>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                        </div>
                        <p className="text-2xl">{b.pct.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400">{b.value} of {submitted.length}</p>
                      </CardContent></Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card><CardContent>
                      <h3 className="font-bold text-gray-800 mb-3">Employment Outcomes</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={employmentOverview} cx="50%" cy="50%" labelLine={false} outerRadius={95} dataKey="value"
                            label={(entry: any) => `${entry.name}: ${entry.pct.toFixed(0)}%`}
                          >
                            {employmentOverview.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            formatter={(value: any, name: any, props: any) => [`${value} (${props.payload.pct.toFixed(1)}%)`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent></Card>

                    <Card><CardContent>
                      <h3 className="font-bold text-gray-800 mb-3">{analyticsSingleDept ? 'Employment Outcomes' : 'Employment Rate by Department'}</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={employmentByDept}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="department" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <YAxis unit="%" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => `${v}%`} />
                          <Legend wrapperStyle={{ color: chartAxisColor }} />
                          {EMPLOYMENT_BUCKETS.map(bucket => (
                            <Bar key={bucket} dataKey={bucket} stackId="outcome" fill={EMPLOYMENT_BUCKET_COLORS[bucket]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                  </div>

                  <Card><CardContent>
                    <h3 className="font-bold text-gray-800 mb-3">Employment Rate & Job Satisfaction Trend by Batch Year</h3>
                    {trendByBatchYear.length === 0 ? (
                      <p className="text-sm text-gray-400">No batch year data to trend.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendByBatchYear}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="year" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <YAxis yAxisId="left" unit="%" domain={[0, 100]} tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend wrapperStyle={{ color: chartAxisColor }} />
                          <Line yAxisId="left" type="monotone" dataKey="employmentRate" name="Employment Rate (%)" stroke="#10b981" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="avgSatisfaction" name="Avg Job Satisfaction (/5)" stroke="#f59e0b" strokeWidth={2} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent></Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card><CardContent>
                      <h3 className="font-bold text-gray-800 mb-3">Job–Degree Relevance</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={jobRelevance}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="name" tick={{ fill: chartAxisColor, fontSize: 11 }} axisLine={{ stroke: chartLineColor }} />
                          <YAxis tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct.toFixed(0)}%)`, 'Respondents']} />
                          <Bar dataKey="value" fill="#8b5cf6" name="Respondents" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>

                    <Card><CardContent>
                      <h3 className="font-bold text-gray-800 mb-3">Time to First Job</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={timeToFirstJob} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" tick={{ fill: chartAxisColor }} axisLine={{ stroke: chartLineColor }} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fill: chartAxisColor, fontSize: 11 }} axisLine={{ stroke: chartLineColor }} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, _n: any, p: any) => [`${v} (${p.payload.pct.toFixed(0)}%)`, 'Respondents']} />
                          <Bar dataKey="value" fill="#3b82f6" name="Respondents" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                  </div>

                  <Card><CardContent>
                    <h3 className="font-bold text-gray-800 mb-3">Employment Rate by Program</h3>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Program</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell align="right">Alumni</TableCell>
                            <TableCell align="right">Employment Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {employmentByProgram.map(p => (
                            <TableRow key={p.program}>
                              <TableCell>{p.program}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={p.department}
                                  sx={{
                                    backgroundColor: DEPARTMENT_COLORS[p.department] || DEFAULT_DEPARTMENT_COLOR,
                                    color: DEPARTMENT_TEXT_COLORS[p.department] || '#ffffff',
                                    fontWeight: 600,
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">{p.total}</TableCell>
                              <TableCell align="right">{p.employedPct.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent></Card>
                </>
              )
          )}
        </div>
      )}

    </div>
  );
}
