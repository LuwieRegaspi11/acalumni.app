import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Upload, Download, Trash2, AlertTriangle, ListChecks, Users } from 'lucide-react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';
import { supabase } from '../../../lib/supabaseClient';
import { DEPARTMENTS, PROGRAMS_BY_DEPT, type DepartmentCode } from '../../../lib/academicPrograms';
import { MIN_BATCH_YEAR } from '../../../lib/batchYears';

// =====================================================================
// ALUMNI ROSTER — Admin -> Alumni Tracer -> "Alumni Roster" tab. Lets an
// admin import a CSV of known graduates from the registrar (First Name,
// Last Name, Department, Program, Batch Year) as a pure MATCH SOURCE.
//
// Importing here NEVER creates an account, a profile, or a
// graduate_tracer_responses row by itself — a name only "enters the
// system" as a real alumnus once that person fills out the public
// Alumni Tracer Survey themselves. What this data does instead: every
// survey submission is checked against it (see the `tracer-intake` Edge
// Function's handleSubmit) — a submission whose First Name + Last Name
// + Department + Program match a row here gets its new account created
// straight at registration_status='approved' and bypasses the pending-
// approval page entirely; no match still creates the account and login
// immediately, just starting 'pending' until an admin clears it in
// Pending Registrations. So a roster row is nothing but a shortcut past
// that manual review for someone who's genuinely already a known
// graduate — see DATABASE-SETUP.md's "Bulk-importing alumni" section.
//
// Writes go straight to `alumni_roster` via the Supabase client SDK, no
// Edge Function involved — its own RLS policy already restricts every
// write to an authenticated admin (alumni_roster_write_admin, see
// supabase/alumni_tracer_intake.sql / alumni_roster_match_by_name.sql),
// the same way AlumniManagementView.tsx reads `profiles` directly.
// =====================================================================

interface RosterRow {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  program: string;
  batch_year: number | null;
  created_at: string;
}

// A row parsed from an uploaded CSV, after normalizing department/program
// casing to whatever `academicPrograms.ts` uses canonically — so two CSVs
// that spell the same program differently ("bscpe" vs "BSCpE") still land
// on one consistent stored value (this matters for the dedupe key below,
// and for `tracer-intake`'s own `.ilike()` match staying predictable).
interface ParsedRow {
  rowNum: number;
  first_name: string;
  last_name: string;
  department: DepartmentCode;
  program: string;
  batch_year: number | null;
  status: 'ready' | 'duplicate-file' | 'duplicate-existing';
}
interface InvalidRow {
  rowNum: number;
  first_name: string;
  last_name: string;
  reasons: string[];
}

const CSV_HEADERS = ['first_name', 'last_name', 'department', 'program', 'batch_year'];

// Same minimal CSV parser used by scripts/import-alumni.mjs and
// admin/BulkImportResponses.tsx — quoted fields, CRLF/LF, leading BOM.
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

function rosterKey(firstName: string, lastName: string, department: string, program: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${department.toLowerCase()}|${program.toLowerCase()}`;
}

function download(content: BlobPart, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AlumniRoster() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RosterRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import wizard state.
  const [importOpen, setImportOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: rosterData }, { data: intakeData }] = await Promise.all([
      supabase.from('alumni_roster').select('*').order('last_name', { ascending: true }),
      supabase.from('alumni_tracer_intake').select('matched_roster_id').not('matched_roster_id', 'is', null),
    ]);
    setRows(rosterData || []);
    setMatchedIds(new Set((intakeData || []).map((r: any) => r.matched_roster_id).filter(Boolean)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.program.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const downloadTemplate = () => {
    const csv = [
      CSV_HEADERS.join(','),
      'Juan,Dela Cruz,CSE,BSIT,2023',
      'Maria,Santos,BAA,BSA,2022',
    ].join('\n');
    download(csv, 'text/csv;charset=utf-8;', 'alumni-roster-template.csv');
  };

  const resetImport = () => {
    setStep('upload'); setParsedRows([]); setInvalidRows([]); setImportError(''); setImportedCount(0);
  };
  const closeImport = () => { if (step !== 'importing') { setImportOpen(false); resetImport(); } };
  const openImport = () => { resetImport(); setImportOpen(true); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) { setImportError('That file has no data rows.'); return; }
      const header = table[0].map(h => h.trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const idx = {
        first_name: col('first_name'), last_name: col('last_name'),
        department: col('department'), program: col('program'), batch_year: col('batch_year'),
      };
      if (idx.first_name < 0 || idx.last_name < 0 || idx.department < 0 || idx.program < 0) {
        setImportError(`This file is missing required column(s). Expected a header row with: ${CSV_HEADERS.join(', ')}.`);
        return;
      }

      // Duplicate check #1 source: every roster row already in the system.
      const existingKeys = new Set(rows.map(r => rosterKey(r.first_name, r.last_name, r.department, r.program)));
      // Duplicate check #2: earlier rows in this same file.
      const seenInFile = new Map<string, number>();

      const valid: ParsedRow[] = [];
      const invalid: InvalidRow[] = [];
      const currentYear = new Date().getFullYear();

      table.slice(1).forEach((cols, i) => {
        const rowNum = i + 2; // +1 for 0-index, +1 for the header row
        const firstName = (cols[idx.first_name] || '').trim();
        const lastName = (cols[idx.last_name] || '').trim();
        const departmentRaw = (cols[idx.department] || '').trim();
        const programRaw = (cols[idx.program] || '').trim();
        const batchYearRaw = idx.batch_year >= 0 ? (cols[idx.batch_year] || '').trim() : '';
        const reasons: string[] = [];

        if (!firstName) reasons.push('missing first_name');
        if (!lastName) reasons.push('missing last_name');

        const department = departmentRaw.toUpperCase() as DepartmentCode;
        if (!departmentRaw) reasons.push('missing department');
        else if (!DEPARTMENTS.includes(department)) reasons.push(`unknown department "${departmentRaw}" (expected one of ${DEPARTMENTS.join(', ')})`);

        // Normalize the program's casing to whatever academicPrograms.ts
        // uses canonically (e.g. "bscpe" -> "BSCpE") so the dedupe key
        // and the stored value stay consistent regardless of how the
        // CSV typed it — tracer-intake's own match is case-insensitive
        // either way, this is purely for a clean, predictable roster list.
        let program = programRaw;
        if (!programRaw) reasons.push('missing program');
        else if (DEPARTMENTS.includes(department)) {
          const canonical = PROGRAMS_BY_DEPT[department].find(p => p.code.toLowerCase() === programRaw.toLowerCase());
          if (canonical) program = canonical.code;
          else reasons.push(`program "${programRaw}" is not offered under department "${department}" (expected one of ${PROGRAMS_BY_DEPT[department].map(p => p.code).join(', ')})`);
        }

        let batchYear: number | null = null;
        if (batchYearRaw) {
          const parsed = Number.parseInt(batchYearRaw, 10);
          if (!Number.isInteger(parsed) || parsed < MIN_BATCH_YEAR || parsed > currentYear + 1) {
            reasons.push(`implausible batch_year "${batchYearRaw}"`);
          } else {
            batchYear = parsed;
          }
        }

        if (reasons.length > 0) {
          invalid.push({ rowNum, first_name: firstName, last_name: lastName, reasons });
          return;
        }

        const key = rosterKey(firstName, lastName, department, program);
        let status: ParsedRow['status'] = 'ready';
        if (seenInFile.has(key)) status = 'duplicate-file';
        else if (existingKeys.has(key)) status = 'duplicate-existing';
        seenInFile.set(key, rowNum);

        valid.push({ rowNum, first_name: firstName, last_name: lastName, department, program, batch_year: batchYear, status });
      });

      setParsedRows(valid);
      setInvalidRows(invalid);
      setStep('preview');
    } catch (err) {
      setImportError(`Could not read that file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readyRows = useMemo(() => parsedRows.filter(r => r.status === 'ready'), [parsedRows]);

  const runImport = async () => {
    if (readyRows.length === 0) return;
    setStep('importing');
    setImportError('');
    // Chunked so one CSV of a few thousand names doesn't ride in a
    // single oversized request.
    const CHUNK = 500;
    try {
      for (let i = 0; i < readyRows.length; i += CHUNK) {
        const chunk = readyRows.slice(i, i + CHUNK).map(r => ({
          first_name: r.first_name, last_name: r.last_name,
          department: r.department, program: r.program, batch_year: r.batch_year,
        }));
        const { error } = await supabase.from('alumni_roster').insert(chunk);
        if (error) throw error;
      }
      setImportedCount(readyRows.length);
      setStep('results');
      load();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
      setStep('preview');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('alumni_roster').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
        A private match list only — never shown to alumni, and importing a name here does <strong>not</strong> create an
        account. It just means that when this person later fills out the Alumni Tracer Survey with a matching
        First Name, Last Name, Department, and Program, their account is created and approved immediately instead of
        waiting for manual review in Pending Registrations.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4 text-gray-400" />
          {loading ? 'Loading…' : `${rows.length} record${rows.length === 1 ? '' : 's'} in the roster`}
          {!loading && rows.length > 0 && (
            <span className="text-gray-400">· {matchedIds.size} already matched to an account</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Download Template
          </button>
          <button onClick={openImport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, department, or program..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-600">{loading ? 'Loading…' : `${filtered.length} shown`}</span>
        </div>
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Name</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Department</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Program</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Batch Year</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Status</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left bg-gray-50 border-b border-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  {rows.length === 0 ? 'No roster records yet — import a CSV to get started.' : 'No records match your search.'}
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{r.last_name}, {r.first_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.department}</td>
                  <td className="px-4 py-3 text-gray-600">{r.program}</td>
                  <td className="px-4 py-3 text-gray-600">{r.batch_year || '—'}</td>
                  <td className="px-4 py-3">
                    {matchedIds.has(r.id)
                      ? <Chip size="small" label="Matched" color="success" variant="outlined" />
                      : <Chip size="small" label="Unmatched" variant="outlined" />}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDeleteTarget(r)} title="Remove from roster"
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 whitespace-nowrap">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleFile} />

      {/* Remove-from-roster confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove from Roster?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-gray-600">
            {deleteTarget && <>Remove <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> ({deleteTarget.department}/{deleteTarget.program}) from the roster?</>}
            {' '}This only removes the match record — it does not affect any existing account.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Remove'}</Button>
        </DialogActions>
      </Dialog>

      {/* Import wizard */}
      <Dialog open={importOpen} onClose={closeImport} maxWidth="md" fullWidth>
        <DialogTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5" /> Import Alumni Roster</DialogTitle>
        <DialogContent className="space-y-4 !pt-2">
          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload a CSV with a header row and these columns (any order): <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{CSV_HEADERS.join(', ')}</code>.
                Use "Download Template" on the previous screen if you're not sure of the format.
              </p>
              {importError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{importError}</span>
                </div>
              )}
              <Button variant="outlined" startIcon={<Upload className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()}>
                Choose CSV File
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              {importError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{importError}</div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Chip size="small" color="success" label={`${readyRows.length} ready to import`} />
                <Chip size="small" label={`${parsedRows.length - readyRows.length} duplicate (will be skipped)`} />
                <Chip size="small" color="error" label={`${invalidRows.length} need fixing (will be skipped)`} />
              </div>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell><TableCell>Name</TableCell><TableCell>Department</TableCell>
                      <TableCell>Program</TableCell><TableCell>Batch Year</TableCell><TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedRows.map(r => (
                      <TableRow key={r.rowNum}>
                        <TableCell>{r.rowNum}</TableCell>
                        <TableCell>{r.first_name} {r.last_name}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell>{r.program}</TableCell>
                        <TableCell>{r.batch_year || '—'}</TableCell>
                        <TableCell>
                          {r.status === 'ready' && <Chip size="small" color="success" label="Ready" />}
                          {r.status === 'duplicate-file' && <Chip size="small" label="Duplicate in file" />}
                          {r.status === 'duplicate-existing' && <Chip size="small" label="Already in roster" />}
                        </TableCell>
                      </TableRow>
                    ))}
                    {invalidRows.map(r => (
                      <TableRow key={`invalid-${r.rowNum}`}>
                        <TableCell>{r.rowNum}</TableCell>
                        <TableCell>{r.first_name || '—'} {r.last_name || ''}</TableCell>
                        <TableCell colSpan={3} className="text-red-600 text-xs">{r.reasons.join('; ')}</TableCell>
                        <TableCell><Chip size="small" color="error" label="Invalid" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          )}

          {step === 'importing' && <p className="text-sm text-gray-500 py-6 text-center">Importing…</p>}

          {step === 'results' && (
            <div className="text-center py-4 space-y-2">
              <p className="text-lg font-bold text-gray-800">{importedCount} record{importedCount === 1 ? '' : 's'} added to the roster</p>
              <p className="text-sm text-gray-500">No accounts were created — these are match records only.</p>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          {step === 'preview' && <Button onClick={() => setStep('upload')}>Back</Button>}
          <Button onClick={closeImport}>{step === 'results' ? 'Done' : 'Cancel'}</Button>
          {step === 'preview' && (
            <Button variant="contained" onClick={runImport} disabled={readyRows.length === 0}>
              Import {readyRows.length} Record{readyRows.length === 1 ? '' : 's'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
