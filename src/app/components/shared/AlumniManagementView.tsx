import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Download, Edit, CheckCircle, X, Eye, DollarSign, Clock, ChevronDown, ClipboardList } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../../lib/supabaseClient';
import { isValidStudentId, STUDENT_ID_PLACEHOLDER, STUDENT_ID_HINT } from '../../../lib/validators';
import { getBatchYearOptions } from '../../../lib/batchYears';
import {
  DEPARTMENTS as ACADEMIC_DEPARTMENTS,
  ALL_PROGRAM_CODES,
  PROGRAMS_BY_DEPT,
  normalizeProgramCode,
} from '../../../lib/academicPrograms';
import { useDonations } from './DonationContext';

// ================= [SHARED: ALUMNIMANAGEMENTVIEW] =================
// The full Alumni Management screen (search/filter, edit, verify, the
// Alumni Monitoring profile+donations+tracer modal, export), shared
// verbatim between the admin page (admin/AlumniManagement.tsx) and the
// faculty page (faculty/FacultyAlumniManagement.tsx) — one
// implementation so a feature added here reaches both roles instead of
// two copies silently drifting apart. Mirrors the split already used
// for Donation Management — see shared/DonationManagementView.tsx's
// header comment for the same rationale.
//
// `department` is the ONLY behavioral difference between the two:
//   - omitted (admin): sees/manages every department's alumni, unrestricted.
//   - set (faculty): every list, stat, and filter below is scoped to
//     just that department, the Department filter/column is hidden
//     (nothing to switch between), and the edit form's Department field
//     is locked instead of a picker. This is a UI convenience only —
//     the real boundary is enforced at the database via RLS (writes:
//     see supabase/faculty_alumni_tracer_scope.sql; reads: the
//     pre-existing "Faculty can view alumni in their department"
//     policy), so a faculty account can't reach another department's
//     alumni even by bypassing this screen.

// Graduate Tracer Survey summary shown in the Alumni Monitoring modal
// (Eye icon) — only this exact, explicitly-requested field list, nothing
// else from the survey (no rest of Employment Information, no Curriculum &
// Outcomes, no Licensure & Development, no Feedback).
const TRACER_DISPLAY_SECTIONS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: 'Graduate Profile',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'mobile_number', label: 'Mobile Number' },
      { key: 'social_network_id', label: 'Social Network ID (Facebook, Twitter link)' },
      { key: 'current_address', label: 'Current Address' },
      { key: 'permanent_address', label: 'Permanent Address' },
      { key: 'sex', label: 'Sex' },
      { key: 'civil_status', label: 'Civil Status' },
      { key: 'year_graduated', label: 'Year Graduated' },
      { key: 'college_department', label: 'College Department' },
      { key: 'program_graduated', label: 'Program Graduated' },
    ],
  },
  {
    title: 'Employment Status',
    fields: [
      { key: 'employment_status', label: 'Current Employment Status' },
      { key: 'company_organization', label: 'Company / Organization' },
      { key: 'industry_sector', label: 'Industry / Sector' },
      { key: 'job_classification', label: 'Job Classification' },
    ],
  },
];

function fmtTracerValue(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

const STATUS_LABELS: Record<string, string> = { Pending: 'Pending', Verified: 'Confirmed', Rejected: 'Rejected' };
const STATUS_COLOR: Record<string, string> = {
  Pending: 'bg-orange-100 text-orange-700', Verified: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
};

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
const EXPORT_COLUMNS = ['Alumni ID', 'Name', 'Email', 'Department', 'Program', 'Batch Year', 'Status', 'Record State'] as const;

// Department/program options now come from the shared catalog (see
// src/lib/academicPrograms.ts) so this filter/editor can't drift out of
// sync with the signup form or any other picker in the app.
const DEPARTMENTS = ['All', ...ACADEMIC_DEPARTMENTS];

const ALL_PROGRAMS = ALL_PROGRAM_CODES;

const normalizeProgram = normalizeProgramCode;

const BATCH_YEARS = getBatchYearOptions().map(String);

interface AlumniRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  department: string;
  program: string;
  batchYear: number;
  verified: boolean;
  active: boolean;
}

function formatDisplayName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (parts.length === 1) return capitalize(parts[0]);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${capitalize(first)} ${capitalize(last)}`;
}

function mapRow(p: any): AlumniRow {
  return {
    id: p.id,
    studentId: p.student_id || '—',
    name: p.name,
    email: p.email,
    department: p.department || '—',
    program: p.program || '—',
    batchYear: p.batch_year || 0,
    verified: !!p.batch_verified,
    active: p.active !== false,
  };
}

interface Props {
  // Faculty pass their own department here to lock the whole screen to
  // it; admin renders this with no department at all.
  department?: string;
}

export default function AlumniManagementView({ department }: Props) {
  const { donations } = useDonations();
  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [editTarget, setEditTarget] = useState<AlumniRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<AlumniRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Graduate Tracer Survey answers for whoever is currently being
  // monitored — undefined while loading, null once loaded if they haven't
  // submitted a response yet. Refetched every time a different alumnus is
  // opened.
  const [tracerResponse, setTracerResponse] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    if (!monitorTarget) { setTracerResponse(undefined); return; }
    let active = true;
    setTracerResponse(undefined);
    supabase
      .from('graduate_tracer_responses')
      .select('*')
      .eq('respondent_id', monitorTarget.id)
      .eq('status', 'submitted')
      .maybeSingle()
      .then(({ data }) => { if (active) setTracerResponse(data || null); });
    return () => { active = false; };
  }, [monitorTarget]);

  const loadAlumni = async () => {
    let query = supabase.from('profiles').select('*').eq('role', 'alumni');
    if (department) query = query.eq('department', department);
    const { data } = await query.order('created_at', { ascending: false });
    setAlumni((data || []).map(mapRow));
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

  // Which department's program list the Program filter/editor should
  // offer — faculty always see just their own department's programs;
  // admin sees whatever department is currently picked in the filter
  // (or every program, until one is).
  const effectiveDeptForPrograms = department || filterDept;

  const filtered = alumni.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.studentId.toLowerCase().includes(q) || a.email.includes(q);
    const matchDept = department ? true : (filterDept === 'All' || a.department === filterDept);
    const matchProgram = filterProgram === 'All' || normalizeProgram(a.program) === filterProgram;
    const matchYear = filterYear === 'All' || a.batchYear.toString() === filterYear;
    return matchSearch && matchDept && matchProgram && matchYear;
  });

  const verifyAlumni = async (id: string) => {
    await supabase.from('profiles').update({ batch_verified: true }).eq('id', id);
    loadAlumni();
  };

  const [editForm, setEditForm] = useState({ name: '', email: '', studentId: '', program: '', department: '', batchYear: '' });
  const [editError, setEditError] = useState('');

  const openEdit = (a: AlumniRow) => {
    setEditTarget(a);
    setEditError('');
    setEditForm({ name: a.name, email: a.email, studentId: a.studentId === '—' ? '' : a.studentId, program: normalizeProgram(a.program), department: a.department, batchYear: String(a.batchYear) });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (editForm.studentId && !isValidStudentId(editForm.studentId)) {
      setEditError(`Student ID must be in the format YYYY-NNNNNNN (${STUDENT_ID_PLACEHOLDER}).`);
      return;
    }
    setEditError('');
    await supabase.from('profiles').update({
      name: editForm.name,
      student_id: editForm.studentId || null,
      program: editForm.program,
      // Locked to the faculty's own department when scoped — even though
      // the edit form hides the picker in that case, this guarantees the
      // written value can never drift from `department` (the DB's own
      // WITH CHECK enforces the same thing independently).
      department: department || editForm.department,
      batch_year: parseInt(editForm.batchYear) || null,
    }).eq('id', editTarget.id);
    setEditTarget(null);
    loadAlumni();
  };

  const exportAlumni = (format: ExportFormat) => {
    setExportOpen(false);
    const rows: Record<(typeof EXPORT_COLUMNS)[number], string | number>[] = filtered.map(a => ({
      'Alumni ID': a.studentId,
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
      link.download = `alumni-management-${department ? `${department}-` : ''}${timestamp}.${extension}`;
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
        doc.text('Alumni Management Report', 14, 15);
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
          <h2 className="text-2xl font-bold text-gray-800">Alumni Management</h2>
          <p className="text-sm text-gray-500">
            {department
              ? <>Manage <strong>{department}</strong> department alumni records</>
              : 'Manage all registered alumni records'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
        </div>
      </div>

      {department && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-amber-600">🔒</span>
          <p className="text-xs text-amber-700 font-medium">
            You can only view, edit, and verify alumni for <strong>{department}</strong>. Other departments are out of reach — enforced by database policy, not just this screen.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, alumni ID, or email..."
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name','Dept','Program','Batch','Status','Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No alumni registered yet.
                </td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{formatDisplayName(a.name)}</div>
                    <div className="text-xs text-gray-400">{a.email}</div>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">{a.department}</span></td>
                  <td className="px-4 py-3 text-gray-600">{a.program}</td>
                  <td className="px-4 py-3 text-gray-600">{a.batchYear || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${a.verified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {a.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setMonitorTarget(a)} title="View profile & donations"
                        className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"><Eye className="w-5 h-5" /></button>
                      <button onClick={() => openEdit(a)} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><Edit className="w-5 h-5 " /></button>
                      {!a.verified && (
                        <button onClick={() => verifyAlumni(a.id)} title="Verify" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"><CheckCircle className="w5 h-5.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800">Edit Alumni Profile</h3>
              <button onClick={() => setEditTarget(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Alumni ID</label>
                <input value={editForm.studentId} onChange={e => setEditForm(f => ({ ...f, studentId: e.target.value }))}
                  placeholder={STUDENT_ID_PLACEHOLDER}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                <p className="text-xs text-gray-400 mt-1">{STUDENT_ID_HINT}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Department</label>
                {department ? (
                  <div className="w-full text-sm border border-gray-100 bg-gray-50 text-gray-500 rounded-xl px-3 py-2.5">{department}</div>
                ) : (
                  <select value={editForm.department}
                    onChange={e => {
                      const dept = e.target.value;
                      setEditForm(f => ({
                        ...f,
                        department: dept,
                        program: (PROGRAMS_BY_DEPT[dept as keyof typeof PROGRAMS_BY_DEPT] || []).map(p => p.code).includes(f.program) ? f.program : '',
                      }));
                    }}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                    <option value="">Select department…</option>
                    {(!editForm.department || DEPARTMENTS.includes(editForm.department) ? DEPARTMENTS.filter(d => d !== 'All') : [editForm.department, ...DEPARTMENTS.filter(d => d !== 'All')])
                      .map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Program</label>
                <select value={editForm.program} onChange={e => setEditForm(f => ({ ...f, program: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                  <option value="">Select program…</option>
                  {(() => {
                    const deptForOpts = department || editForm.department;
                    const opts = deptForOpts && PROGRAMS_BY_DEPT[deptForOpts as keyof typeof PROGRAMS_BY_DEPT]
                      ? PROGRAMS_BY_DEPT[deptForOpts as keyof typeof PROGRAMS_BY_DEPT].map(p => p.code)
                      : ALL_PROGRAMS;
                    const withCurrent = editForm.program && !opts.includes(editForm.program) ? [editForm.program, ...opts] : opts;
                    return withCurrent.map(p => <option key={p} value={p}>{p}</option>);
                  })()}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Batch Year</label>
                <input value={editForm.batchYear} onChange={e => setEditForm(f => ({ ...f, batchYear: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            {editError && <p className="text-xs text-red-500 px-6 -mt-2 pb-2">{editError}</p>}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Alumni Monitoring — profile + donation activity together */}
      {monitorTarget && (() => {
        const donorDonations = donations.filter(d => d.alumniEmail === monitorTarget.email);
        const confirmedTotal = donorDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);
        const pendingCount = donorDonations.filter(d => d.status === 'Pending').length;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                <h3 className="font-bold text-gray-800">Alumni Monitoring</h3>
                <button onClick={() => setMonitorTarget(null)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                {/* Profile summary */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                    {monitorTarget.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">{monitorTarget.name}</p>
                    <p className="text-xs text-gray-400">{monitorTarget.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 font-mono">{monitorTarget.studentId}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">{monitorTarget.department}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{monitorTarget.program}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">Batch {monitorTarget.batchYear || '—'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${monitorTarget.verified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {monitorTarget.verified ? '✓ Verified' : 'Unverified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Graduate Tracer Survey — from the alumnus's own submitted
                    response. Only TRACER_DISPLAY_SECTIONS' exact field list
                    is shown, nothing else from the survey. */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Graduate Tracer Survey</p>
                  {tracerResponse === undefined ? (
                    <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">Loading survey response…</p>
                  ) : tracerResponse === null ? (
                    <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">This alumnus hasn't submitted a Graduate Tracer Survey response yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {TRACER_DISPLAY_SECTIONS.map(section => (
                        <div key={section.title} className="border border-gray-100 rounded-xl p-4">
                          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2.5">{section.title}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            {section.fields.map(f => (
                              <div key={f.key} className="text-sm">
                                <p className="text-xs font-semibold text-gray-500">{f.label}</p>
                                <p className="text-gray-800">{fmtTracerValue(tracerResponse[f.key])}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Donation activity summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold mb-1"><DollarSign className="w-3.5 h-3.5" /> Confirmed Donated</div>
                    <p className="text-lg font-bold text-green-700">₱{confirmedTotal.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-orange-700 text-xs font-semibold mb-1"><Clock className="w-3.5 h-3.5" /> Pending Donations</div>
                    <p className="text-lg font-bold text-orange-700">{pendingCount}</p>
                  </div>
                </div>

                {/* Donation history table */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Donation Activity</p>
                  {donorDonations.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">No donations recorded for this alumnus yet.</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>{['Date','Campaign','Amount','Type','Status'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {donorDonations.map(d => (
                            <tr key={d.id}>
                              <td className="px-3 py-2 text-xs text-gray-500">{d.submittedAt}</td>
                              <td className="px-3 py-2 text-gray-700">{d.campaign}</td>
                              <td className="px-3 py-2 font-semibold text-gray-800">₱{d.amount.toLocaleString()}</td>
                              <td className="px-3 py-2 text-xs text-gray-500">{d.type}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLOR[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0">
                <button onClick={() => setMonitorTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
