import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DEPARTMENTS as ACADEMIC_DEPARTMENTS, ALL_PROGRAM_CODES, PROGRAM_TO_DEPARTMENT, normalizeProgramCode,
} from '../../../lib/academicPrograms';
import { getBatchYearOptions } from '../../../lib/batchYears';
import {
  EMPLOYMENT_STATUS_OPTIONS, WORK_LOCATION_OPTIONS, COMPETENCIES, COMPETENCY_LEVELS,
  ALL_SECTIONS, TRACER_QUESTIONS, JOB_RELATED_OPTIONS, TIME_TO_FIRST_JOB_OPTIONS,
} from '../../../lib/graduateTracerSurveyOptions';
import { useDarkMode } from './DarkModeContext';
import {
  ClipboardList, Search, Filter, Eye, X, Users, TrendingUp, Star, ListChecks,
  BarChart3, Download, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Card, CardContent, TextField, Button, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Chip,
} from '@mui/material';

// ================= [SHARED: TRACERRESPONSESVIEW — read-only analytics] =================
// Reads the graduate_tracer_responses table (see
// supabase/graduate_tracer_survey.sql) — filters, views, and aggregate
// breakdowns, no CRUD. Shared verbatim between admin/TracerResponses.tsx
// and faculty/FacultyTracerResponses.tsx — one implementation so a
// feature added here reaches both roles instead of two copies silently
// drifting apart. Same split as shared/DonationManagementView.tsx.
//
// `department` is the ONLY behavioral difference between the two:
//   - omitted (admin): sees every submitted response, unrestricted.
//   - set (faculty): every list, stat, filter, and chart below is scoped
//     to just that department's alumni, and the Department filter is
//     hidden (nothing to switch between). This is a UI convenience
//     only — the real boundary is enforced at the database via RLS (see
//     supabase/faculty_alumni_tracer_scope.sql's "Faculty can view
//     tracer responses in their department" policy), so a faculty
//     account can't reach another department's responses even by
//     bypassing this screen.
//
// Only `status = 'submitted'` rows are ever shown here — drafts are
// incomplete, not real submissions yet.

const DEPARTMENT_OPTIONS = ['All', ...ACADEMIC_DEPARTMENTS];
const PROGRAMS_BY_DEPT_CODES: Record<string, string[]> = ACADEMIC_DEPARTMENTS.reduce((acc, dept) => {
  acc[dept] = ALL_PROGRAM_CODES.filter(code => PROGRAM_TO_DEPARTMENT[code] === dept);
  return acc;
}, {} as Record<string, string[]>);
const BATCH_YEARS = getBatchYearOptions().map(String);

interface ResponseRow {
  id: string;
  respondentId: string;
  name: string;
  department: string;
  program: string;
  batchYear: number | null;
  submittedAt: string;
  raw: any; // full graduate_tracer_responses row, for the detail dialog + breakdown
}

function mapRow(r: any): ResponseRow {
  return {
    id: r.id,
    respondentId: r.respondent_id,
    name: r.respondent?.name || 'Unknown',
    department: r.respondent?.department || '—',
    program: r.respondent?.program || '—',
    batchYear: r.respondent?.batch_year ?? null,
    submittedAt: r.submitted_at,
    raw: r,
  };
}

function fmt(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

// Full field list per section for the "View" dialog — every column in
// the table, grouped the same way GraduateTracerForm.tsx sections them.
// (Broader than TRACER_QUESTIONS below, which only covers the subset
// worth aggregating in the Per-Question Breakdown view.)
const DETAIL_FIELDS: Record<string, { key: string; label: string }[]> = {
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

function aggregateBucket(rows: ResponseRow[], key: string, multi: boolean): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach(r => {
    const v = r.raw[key];
    if (multi) {
      (Array.isArray(v) ? v : []).forEach((opt: string) => { counts[opt] = (counts[opt] || 0) + 1; });
    } else if (v) {
      counts[v] = (counts[v] || 0) + 1;
    }
  });
  return counts;
}

function aggregateRating(rows: ResponseRow[], key: string) {
  const vals = rows.map(r => r.raw[key]).filter((v: any) => typeof v === 'number');
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  vals.forEach(v => { dist[v] = (dist[v] || 0) + 1; });
  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  return { avg, dist, count: vals.length };
}

// ---- Analytics Report ----
// Collapses the granular employment_status picklist into the four outcome
// buckets an actual tracer study reports on, so "employment rate" means
// something consistent across every chart/table below.
type EmploymentBucket = 'Employed' | 'Further Studies' | 'Unemployed' | 'Not Seeking' | 'No Response';
const EMPLOYMENT_BUCKETS: EmploymentBucket[] = ['Employed', 'Further Studies', 'Unemployed', 'Not Seeking', 'No Response'];
const EMPLOYMENT_BUCKET_COLORS: Record<EmploymentBucket, string> = {
  Employed: '#10b981', 'Further Studies': '#3b82f6', Unemployed: '#ef4444', 'Not Seeking': '#f59e0b', 'No Response': '#9ca3af',
};

function classifyEmployment(status: string | null | undefined): EmploymentBucket {
  if (!status) return 'No Response';
  if (status === 'Currently Pursuing Further/Graduate Studies') return 'Further Studies';
  if (status === 'Unemployed') return 'Unemployed';
  if (status === 'Not Seeking Employment') return 'Not Seeking';
  return 'Employed';
}

// Bulk export of the (filtered, scoped) tracer responses — tabular
// formats only, same rationale as AlumniManagementView's export.
const EXPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel (.xlsx)' },
  { id: 'csv', label: 'CSV (.csv)' },
  { id: 'pdf', label: 'PDF (.pdf)' },
] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number]['id'];
const EXPORT_COLUMNS = [
  'Name', 'Department', 'Program', 'Batch Year', 'Employment Status', 'Employment Classification',
  'Company / Organization', 'Industry / Sector', 'Job Related to Degree', 'Time to First Job',
  'Monthly Salary Range', 'Work Location', 'Job Satisfaction (1-5)', 'Would Recommend College', 'Submitted',
] as const;

interface Props {
  // Faculty pass their own department here to lock the whole screen to
  // it; admin renders this with no department at all.
  department?: string;
}

export default function TracerResponsesView({ department }: Props) {
  const { dark } = useDarkMode();
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [approvedAlumniCount, setApprovedAlumniCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'all' | 'breakdown' | 'analytics'>('all');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterEmployment, setFilterEmployment] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [viewTarget, setViewTarget] = useState<ResponseRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Which department's program list the Program filter should offer —
  // faculty always see just their own department's programs.
  const effectiveDeptForPrograms = department || filterDept;

  const load = async () => {
    setLoading(true);
    // `!inner` on the respondent embed lets PostgREST accept a filter on
    // an embedded column (respondent.department) — same technique the
    // old faculty tracer view used against the legacy survey table.
    // RLS (graduate_tracer_responses' faculty SELECT policy) already
    // scopes this independently; the explicit filter here just keeps
    // the query itself honest about what it's asking for.
    let query = supabase
      .from('graduate_tracer_responses')
      .select(`*, respondent:profiles${department ? '!inner' : ''}(name, department, program, batch_year)`)
      .eq('status', 'submitted');
    if (department) query = query.eq('respondent.department', department);

    // The mandatory tracer gate covers both alumni and batch representatives
    // (App.tsx's TRACER_GATED_ROLES — a rep is an alumnus first), so the
    // response-rate denominator counts both roles too; otherwise a rep's
    // submitted response would inflate the numerator with no matching
    // increase in the denominator.
    let approvedQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['alumni', 'representative']).eq('registration_status', 'approved');
    if (department) approvedQuery = approvedQuery.eq('department', department);

    const [{ data }, { count: drafts }, { count: approved }] = await Promise.all([
      query.order('submitted_at', { ascending: false }),
      supabase.from('graduate_tracer_responses').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
      approvedQuery,
    ]);
    setRows((data || []).map(mapRow));
    setDraftCount(drafts || 0);
    setApprovedAlumniCount(approved || 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [department]);

  useEffect(() => {
    if (!exportOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [exportOpen]);

  const filtered = useMemo(() => rows.filter(r => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q);
    const matchDept = department ? true : (filterDept === 'All' || r.department === filterDept);
    const matchProgram = filterProgram === 'All' || normalizeProgramCode(r.program) === filterProgram;
    const matchYear = filterYear === 'All' || String(r.batchYear || '') === filterYear;
    const matchEmployment = filterEmployment === 'All' || r.raw.employment_status === filterEmployment;
    const matchLocation = filterLocation === 'All' || r.raw.current_work_location === filterLocation;
    return matchSearch && matchDept && matchProgram && matchYear && matchEmployment && matchLocation;
  }), [rows, search, filterDept, filterProgram, filterYear, filterEmployment, filterLocation, department]);

  const clearFilters = () => {
    setSearch(''); setFilterDept('All'); setFilterProgram('All');
    setFilterYear('All'); setFilterEmployment('All'); setFilterLocation('All');
  };

  const responseRate = approvedAlumniCount ? (rows.length / approvedAlumniCount) * 100 : 0;
  const satisfactionVals = rows.map(r => r.raw.job_satisfaction_rating).filter((v: any) => typeof v === 'number');
  const avgSatisfaction = satisfactionVals.length ? satisfactionVals.reduce((s: number, v: number) => s + v, 0) / satisfactionVals.length : 0;

  // ---- Analytics Report data — all derived from `filtered`, so it always
  // reflects whatever's currently filtered to (and, for faculty, already
  // scoped to their own department). ----
  const employmentOverview = useMemo(() => {
    const counts: Record<EmploymentBucket, number> = { Employed: 0, 'Further Studies': 0, Unemployed: 0, 'Not Seeking': 0, 'No Response': 0 };
    filtered.forEach(r => { counts[classifyEmployment(r.raw.employment_status)]++; });
    const total = filtered.length;
    return EMPLOYMENT_BUCKETS
      .map(bucket => ({ name: bucket, value: counts[bucket], pct: total ? (counts[bucket] / total) * 100 : 0, color: EMPLOYMENT_BUCKET_COLORS[bucket] }))
      .filter(b => b.value > 0);
  }, [filtered]);

  const employmentByDept = useMemo(() => (department ? [department] : ACADEMIC_DEPARTMENTS).map(dept => {
    const deptRows = filtered.filter(r => r.department === dept);
    const total = deptRows.length;
    const counts: Record<EmploymentBucket, number> = { Employed: 0, 'Further Studies': 0, Unemployed: 0, 'Not Seeking': 0, 'No Response': 0 };
    deptRows.forEach(r => { counts[classifyEmployment(r.raw.employment_status)]++; });
    const pct = (bucket: EmploymentBucket) => total ? Math.round((counts[bucket] / total) * 1000) / 10 : 0;
    return {
      department: dept, total,
      Employed: pct('Employed'), 'Further Studies': pct('Further Studies'),
      Unemployed: pct('Unemployed'), 'Not Seeking': pct('Not Seeking'), 'No Response': pct('No Response'),
    };
  }).filter(d => d.total > 0), [filtered, department]);

  const employmentByProgram = useMemo(() => {
    const programs = Array.from(new Set(filtered.map(r => normalizeProgramCode(r.program)).filter(Boolean)));
    return programs.map(program => {
      const programRows = filtered.filter(r => normalizeProgramCode(r.program) === program);
      const total = programRows.length;
      const employed = programRows.filter(r => classifyEmployment(r.raw.employment_status) === 'Employed').length;
      return { program, department: PROGRAM_TO_DEPARTMENT[program] || '—', total, employedPct: total ? (employed / total) * 100 : 0 };
    }).sort((a, b) => a.department.localeCompare(b.department) || a.program.localeCompare(b.program));
  }, [filtered]);

  const trendByBatchYear = useMemo(() => {
    const years = Array.from(new Set(filtered.map(r => r.batchYear).filter((y): y is number => !!y))).sort((a, b) => a - b);
    return years.map(year => {
      const yearRows = filtered.filter(r => r.batchYear === year);
      const employed = yearRows.filter(r => classifyEmployment(r.raw.employment_status) === 'Employed').length;
      const satVals = yearRows.map(r => r.raw.job_satisfaction_rating).filter((v: any) => typeof v === 'number');
      const avgSat = satVals.length ? satVals.reduce((s: number, v: number) => s + v, 0) / satVals.length : null;
      return {
        year: String(year), respondents: yearRows.length,
        employmentRate: yearRows.length ? (employed / yearRows.length) * 100 : 0,
        avgSatisfaction: avgSat,
      };
    });
  }, [filtered]);

  const jobRelevance = useMemo(() => {
    const counts = aggregateBucket(filtered, 'job_related_to_degree', false);
    const total = filtered.length;
    return JOB_RELATED_OPTIONS.map(opt => ({ name: opt, value: counts[opt] || 0, pct: total ? ((counts[opt] || 0) / total) * 100 : 0 }));
  }, [filtered]);

  const timeToFirstJob = useMemo(() => {
    const counts = aggregateBucket(filtered, 'time_to_first_job', false);
    const total = filtered.length;
    return TIME_TO_FIRST_JOB_OPTIONS.map(opt => ({ name: opt, value: counts[opt] || 0, pct: total ? ((counts[opt] || 0) / total) * 100 : 0 }));
  }, [filtered]);

  const chartAxisColor = dark ? '#b8d4f0' : '#4b5563';
  const chartLineColor = dark ? '#334155' : '#d1d5db';
  const chartGridColor = dark ? '#334155' : '#e5e7eb';
  const chartTooltipStyle = { background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' };

  // Exports the currently filtered responses — not the full dataset — so
  // what downloads always matches what's on screen (matches AlumniManagementView's export UX).
  const exportResponses = (format: ExportFormat) => {
    setExportOpen(false);
    const exportRows: Record<(typeof EXPORT_COLUMNS)[number], string | number>[] = filtered.map(r => ({
      Name: r.name,
      Department: r.department,
      Program: r.program,
      'Batch Year': r.batchYear || '',
      'Employment Status': fmt(r.raw.employment_status),
      'Employment Classification': fmt(r.raw.employment_classification),
      'Company / Organization': fmt(r.raw.company_organization),
      'Industry / Sector': fmt(r.raw.industry_sector),
      'Job Related to Degree': fmt(r.raw.job_related_to_degree),
      'Time to First Job': fmt(r.raw.time_to_first_job),
      'Monthly Salary Range': fmt(r.raw.monthly_salary_range),
      'Work Location': fmt(r.raw.current_work_location),
      'Job Satisfaction (1-5)': r.raw.job_satisfaction_rating || '',
      'Would Recommend College': fmt(r.raw.would_recommend_college),
      Submitted: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '',
    }));
    const timestamp = new Date().toISOString().slice(0, 10);
    const generatedAt = `Generated ${new Date().toLocaleString()} • ${exportRows.length} response${exportRows.length === 1 ? '' : 's'}${department ? ` • ${department}` : ''}`;

    const download = (content: BlobPart, mimeType: string, extension: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tracer-responses-${department ? `${department}-` : ''}${timestamp}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    };

    switch (format) {
      case 'csv': {
        const sheet = XLSX.utils.json_to_sheet(exportRows, { header: [...EXPORT_COLUMNS] });
        download(XLSX.utils.sheet_to_csv(sheet), 'text/csv;charset=utf-8;', 'csv');
        break;
      }
      case 'xlsx': {
        const sheet = XLSX.utils.json_to_sheet(exportRows, { header: [...EXPORT_COLUMNS] });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Tracer Responses');
        const xlsxBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        download(xlsxBytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
        break;
      }
      case 'pdf': {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text('Graduate Tracer Study — Response Report', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(generatedAt, 14, 21);
        autoTable(doc, {
          startY: 26,
          head: [[...EXPORT_COLUMNS]],
          body: exportRows.map(r => EXPORT_COLUMNS.map(c => String(r[c] ?? ''))),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [27, 58, 107] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        });
        download(doc.output('blob'), 'application/pdf', 'pdf');
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1">Tracer Responses</h2>
          <p className="text-gray-600">
            {department
              ? <>Submitted Graduate Tracer Survey responses and analytics for <strong>{department}</strong></>
              : 'Submitted Graduate Tracer Survey responses and aggregate analytics'}
          </p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button onClick={() => setExportOpen(o => !o)} title="Exports the currently filtered responses"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-20">
              <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Download as</p>
              {EXPORT_FORMATS.map(({ id, label }) => (
                <button key={id} onClick={() => exportResponses(id)}
                  className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {department && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-amber-600">🔒</span>
          <p className="text-xs text-amber-700 font-medium">
            You can only view tracer responses and analytics for <strong>{department}</strong>. Other departments are out of reach — enforced by database policy, not just this screen.
          </p>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Submitted Responses</span>
              <ClipboardList className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl">{loading ? '…' : rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Response Rate</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl">{loading ? '…' : `${responseRate.toFixed(1)}%`}</p>
            <p className="text-xs text-gray-400 mt-1">vs. {approvedAlumniCount} approved alumni &amp; reps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Avg Job Satisfaction</span>
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl">{loading ? '…' : satisfactionVals.length ? `${avgSatisfaction.toFixed(1)} / 5` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">In Progress (Draft)</span>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl">{loading ? '…' : draftCount}</p>
            <p className="text-xs text-gray-400 mt-1">Started but not yet submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* View toggle */}
      <ToggleButtonGroup exclusive size="small" value={view} onChange={(_e, v) => { if (v) setView(v); }}>
        <ToggleButton value="all"><Eye className="w-4 h-4 mr-1.5" /> All Responses</ToggleButton>
        <ToggleButton value="breakdown"><ListChecks className="w-4 h-4 mr-1.5" /> Per-Question Breakdown</ToggleButton>
        <ToggleButton value="analytics"><BarChart3 className="w-4 h-4 mr-1.5" /> Analytics Report</ToggleButton>
      </ToggleButtonGroup>

      {/* Shared filters */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <TextField
              fullWidth size="small" placeholder="Search by alumni name..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" /> }}
            />
            <Button
              size="small" variant="outlined" startIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(f => !f)}
              sx={{ textTransform: 'none', fontWeight: 400, whiteSpace: 'nowrap' }}
            >
              Filters
            </Button>
            <Button
              size="small" variant="text" onClick={clearFilters}
              sx={{ textTransform: 'none', fontWeight: 400, whiteSpace: 'nowrap' }}
            >
              Clear filters
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {!department && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select label="Department" value={filterDept}
                    onChange={e => { setFilterDept(e.target.value); setFilterProgram('All'); }}>
                    {DEPARTMENT_OPTIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" fullWidth>
                <InputLabel>Program</InputLabel>
                <Select label="Program" value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  {(effectiveDeptForPrograms === 'All' ? ALL_PROGRAM_CODES : (PROGRAMS_BY_DEPT_CODES[effectiveDeptForPrograms] || [])).map(p => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Year Graduated</InputLabel>
                <Select label="Year Graduated" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  {BATCH_YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Employment Status</InputLabel>
                <Select label="Employment Status" value={filterEmployment} onChange={e => setFilterEmployment(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  {EMPLOYMENT_STATUS_OPTIONS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Work Location</InputLabel>
                <Select label="Work Location" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                  <MenuItem value="All">All</MenuItem>
                  {WORK_LOCATION_OPTIONS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            </div>
          )}
        </CardContent>
      </Card>

      {view === 'all' && (
        <Card>
          <CardContent className="!p-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                {loading ? 'Loading…' : `${filtered.length} response${filtered.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 560, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['Name', 'Department', 'Program', 'Year Graduated', 'Employment Status', 'Company', 'Work Location', 'Job Satisfaction', 'Submitted', ''].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!loading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={10} align="center" className="text-gray-400 py-8">No submitted responses match these filters.</TableCell></TableRow>
                  )}
                  {filtered.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.name}</TableCell>
                      <TableCell><Chip size="small" label={r.department} /></TableCell>
                      <TableCell>{r.program}</TableCell>
                      <TableCell>{r.batchYear || '—'}</TableCell>
                      <TableCell>{fmt(r.raw.employment_status)}</TableCell>
                      <TableCell>{fmt(r.raw.company_organization)}</TableCell>
                      <TableCell>{fmt(r.raw.current_work_location)}</TableCell>
                      <TableCell>{r.raw.job_satisfaction_rating ? `${r.raw.job_satisfaction_rating} / 5` : '—'}</TableCell>
                      <TableCell>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Button size="small" startIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewTarget(r)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {view === 'breakdown' && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="text-center py-8"><p className="text-gray-500">No submitted responses match these filters.</p></CardContent></Card>
          ) : (
            <>
              {TRACER_QUESTIONS.map(q => {
                if (q.type === 'text') {
                  const answers = filtered
                    .map(r => ({ name: r.name, text: (r.raw[q.key] || '').trim() }))
                    .filter(a => a.text.length > 0);
                  return (
                    <Card key={q.key}>
                      <CardContent>
                        <h3 className="font-bold text-gray-800 mb-3">{q.label}</h3>
                        {answers.length === 0 ? (
                          <p className="text-sm text-gray-400">No responses yet.</p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                            {answers.map((a, i) => (
                              <div key={i} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                                <p className="text-gray-700">{a.text}</p>
                                <p className="text-xs text-gray-400 mt-0.5">— {a.name}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                }
                if (q.type === 'rating') {
                  const { avg, dist, count } = aggregateRating(filtered, q.key);
                  return (
                    <Card key={q.key}>
                      <CardContent>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-gray-800">{q.label}</h3>
                          <span className="text-sm font-semibold text-blue-700">{count ? `Avg ${avg.toFixed(2)} / 5` : 'No data'}</span>
                        </div>
                        <div className="space-y-2">
                          {[5, 4, 3, 2, 1].map(n => {
                            const c = dist[n] || 0;
                            const pct = count ? (c / count) * 100 : 0;
                            return (
                              <div key={n} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-10">{n} star</span>
                                <LinearProgress variant="determinate" value={pct} className="flex-1 h-2 rounded" />
                                <span className="text-xs text-gray-500 w-20 text-right">{c} ({pct.toFixed(0)}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                // single or multi
                const counts = aggregateBucket(filtered, q.key, q.type === 'multi');
                const total = filtered.length;
                return (
                  <Card key={q.key}>
                    <CardContent>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800">{q.label}</h3>
                        {q.type === 'multi' && <span className="text-xs text-gray-400">% of respondents (multi-select)</span>}
                      </div>
                      <div className="space-y-2">
                        {(q.options || []).map(opt => {
                          const c = counts[opt] || 0;
                          const pct = total ? (c / total) * 100 : 0;
                          return (
                            <div key={opt} className="flex items-center gap-3">
                              <span className="text-xs text-gray-600 w-56 flex-shrink-0 truncate" title={opt}>{opt}</span>
                              <LinearProgress variant="determinate" value={Math.min(pct, 100)} className="flex-1 h-2 rounded" />
                              <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">{c} ({pct.toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Competency ratings — its own grid rather than forced into the single/multi shape above */}
              <Card>
                <CardContent>
                  <h3 className="font-bold text-gray-800 mb-3">Competency Ratings</h3>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Competency</TableCell>
                          {COMPETENCY_LEVELS.map(l => <TableCell key={l} align="center">{l}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {COMPETENCIES.map(c => {
                          const levelCounts = COMPETENCY_LEVELS.map(l =>
                            filtered.filter(r => r.raw.competency_ratings?.[c] === l).length
                          );
                          return (
                            <TableRow key={c}>
                              <TableCell>{c}</TableCell>
                              {levelCounts.map((n, i) => (
                                <TableCell key={i} align="center">{n}</TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {view === 'analytics' && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="text-center py-8"><p className="text-gray-500">No submitted responses match these filters.</p></CardContent></Card>
          ) : (
            <>
              {/* Quick outcome KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {employmentOverview.map(b => (
                  <Card key={b.name}>
                    <CardContent>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">{b.name}</span>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      </div>
                      <p className="text-2xl">{b.pct.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">{b.value} of {filtered.length}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardContent>
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
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h3 className="font-bold text-gray-800 mb-3">{department ? 'Employment Outcomes' : 'Employment Rate by Department'}</h3>
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
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent>
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
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardContent>
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
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
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
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent>
                  <h3 className="font-bold text-gray-800 mb-3">Employment Rate by Program</h3>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Program</TableCell>
                          <TableCell>Department</TableCell>
                          <TableCell align="right">Respondents</TableCell>
                          <TableCell align="right">Employment Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {employmentByProgram.map(p => (
                          <TableRow key={p.program}>
                            <TableCell>{p.program}</TableCell>
                            <TableCell><Chip size="small" label={p.department} /></TableCell>
                            <TableCell align="right">{p.total}</TableCell>
                            <TableCell align="right">{p.employedPct.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Full-response dialog, grouped by section */}
      <Dialog open={!!viewTarget} onClose={() => setViewTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle className="flex items-center justify-between">
          <span>{viewTarget?.name} — Tracer Response</span>
          <button onClick={() => setViewTarget(null)}><X className="w-5 h-5 text-gray-500" /></button>
        </DialogTitle>
        <DialogContent dividers>
          {viewTarget && (
            <div className="space-y-6">
              {ALL_SECTIONS.filter(s => s.key !== 'consent').map(section => (
                <div key={section.key}>
                  <h4 className="font-bold text-gray-800 mb-2 pb-1 border-b">{section.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {(DETAIL_FIELDS[section.key] || []).map(f => (
                      <div key={f.key} className="text-sm">
                        <p className="text-xs font-semibold text-gray-500">{f.label}</p>
                        <p className="text-gray-800">{fmt(viewTarget.raw[f.key])}</p>
                      </div>
                    ))}
                  </div>
                  {section.key === 'curriculum' && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Competency Ratings</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {COMPETENCIES.map(c => (
                          <div key={c} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                            <span className="text-gray-500">{c}: </span>
                            <span className="font-semibold text-gray-700">{viewTarget.raw.competency_ratings?.[c] || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
