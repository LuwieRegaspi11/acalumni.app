import { useState, useEffect } from 'react';
import { UserCheck, Search, Eye, CheckCircle, XCircle, ShieldCheck, UploadCloud } from 'lucide-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Avatar, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { supabase } from '../../../lib/supabaseClient';
import { useNotifications } from '../shared/NotificationContext';
import { rowToAnswers, renderProfileSummary, renderEmploymentStatusSummary, renderEmploymentInfoSummary, renderCurriculumSummary, renderLicensureSummary, renderFeedbackSummary } from '../alumni/tracerSurveySections';
import TracerCredentialsReveal from '../alumni/TracerCredentialsReveal';
import BulkImportResponses from './BulkImportResponses';

// =====================================================================
// PENDING REGISTRATIONS — reviews Alumni Tracer Survey submissions the
// `tracer-intake` Edge Function couldn't resolve on its own (see
// supabase/alumni_tracer_intake.sql, alumni/PublicTracerSurveyPage.tsx).
// A brand-new submission whose Name + Department + Program match a row
// in the Alumni Roster auto-approves immediately (matched_roster_id
// records which row) and never lands here needing a decision — it shows
// up already resolved, for the audit trail only. A submitted email that
// already had an account is likewise resolved automatically (its
// password is reset immediately, no admin involved — whether the
// submitted Name/Department/Program matched what was on file is only
// ever recorded as an audit note, not a gate). Only a submission that
// genuinely couldn't be resolved automatically needs an admin: either a
// brand-new account with no roster match (lands here 'pending'), or the
// rare "possible duplicate" case where an existing account's automatic
// password reset itself technically failed (see below). ('matched'
// below is a legacy status value from an earlier design; no longer
// produced by new submissions, kept only so historical rows still
// display sensibly.) An admin looks at the full submitted survey (the
// same fields the alumnus answered — see the read-only render below) to
// identify the person, then Approves or Rejects.
//
// Important: a "Pending" submission here USUALLY already has a real
// account that can sign in — every ordinary submission gets one
// immediately (see tracer-intake's header comment) — it just lands on
// the pending-approval status page instead of the dashboard. So the
// common case for Approve is just lifting that gate
// (registration_status -> 'approved'); there's no password left to
// relay, the alumnus already got their own the moment they submitted.
//
// Two exceptions still show a one-time credentials screen on Approve:
// the rare fallback where account creation itself failed back at
// submission time (this is the first time it's created); and a
// "possible duplicate" — the submitted email already matched an
// existing account, but the automatic password reset call itself
// technically failed (see tracer-intake's handleSubmit), so NO password
// was actually reset at submission time. Approving here just retries
// that password reset and shows new sign-in details to relay. See the
// Edge Function's "approve" action for all three branches.
// =====================================================================

interface Submission {
  id: string;
  name: string;
  email: string;
  department: string;
  program: string;
  batchYear: number;
  submittedAt: string;
  status: 'matched' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  raw: any; // full row — fed to tracerSurveySections' read-only renderers
}

function mapRowToSubmission(row: any): Submission {
  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || '(no name)',
    email: row.email || '',
    department: row.college_department || '',
    program: row.program_graduated || '',
    batchYear: row.year_graduated || 0,
    submittedAt: row.created_at,
    status: row.status,
    rejectionReason: row.rejection_reason || undefined,
    raw: row,
  };
}

const STATUS_LABEL: Record<Submission['status'], string> = {
  matched: 'Auto-Matched', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
};
const STATUS_COLOR: Record<Submission['status'], 'success' | 'warning' | 'error' | 'info'> = {
  matched: 'info', pending: 'warning', approved: 'success', rejected: 'error',
};

export default function PendingRegistrations() {
  const { trigger } = useNotifications();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchYearFilter, setBatchYearFilter] = useState('All');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reveal, setReveal] = useState<{ name: string; email: string; password: string; wasReset?: boolean } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [approveNotice, setApproveNotice] = useState<string | null>(null);

  const loadSubmissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('alumni_tracer_intake')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSubmissions(data.map(mapRowToSubmission));
    setLoading(false);
  };

  useEffect(() => { loadSubmissions(); }, []);

  const batchYears = Array.from(new Set(submissions.map(s => s.batchYear).filter(Boolean))).sort((a, b) => b - a);

  const filtered = submissions
    .filter(s =>
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       s.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (batchYearFilter === 'All' || s.batchYear === Number(batchYearFilter))
    )
    // Pending submissions always float to the top — the ones that still
    // need review shouldn't be buried under already-decided ones.
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  const handleView = (s: Submission) => {
    setSelected(s);
    setActionError('');
    setRejectReason('');
    setViewDialogOpen(true);
  };

  const handleApprove = async (submission: Submission) => {
    setActionLoading(true);
    setActionError('');
    const { data, error } = await supabase.functions.invoke('tracer-intake', {
      body: { action: 'approve', intakeId: submission.id },
    });
    setActionLoading(false);
    if (error || !data || data.error) {
      let message = 'Could not approve this submission. Please try again.';
      try { const body = await error?.context?.json?.(); if (body?.error) message = body.error; } catch { /* keep generic */ }
      setActionError(message);
      return;
    }
    setViewDialogOpen(false);
    // A password to relay means either the rare fallback (account never
    // existed, just created) or a "possible duplicate" the admin just
    // confirmed (existing account, password reset) — both need the
    // one-time reveal. No password at all is the common case: the
    // account already had its own credentials from submission time, so
    // approving here just lifts the pending gate.
    if (data.password) {
      if (data.userId) {
        trigger({
          title: data.wasReset ? 'Password Reset' : 'Welcome to the Alumni Portal',
          message: data.wasReset
            ? 'Your identity was confirmed and your password has been reset — check with the Alumni Office for your new sign-in details.'
            : 'Your Alumni Tracer Survey submission has been verified and your account is ready.',
          type: 'success',
          targetUserId: data.userId,
        });
      }
      setReveal({ name: data.name, email: data.email, password: data.password, wasReset: !!data.wasReset });
      loadSubmissions();
      return;
    }
    // Common case: this account already exists — it was created the
    // moment the survey was submitted (see tracer-intake's header
    // comment) — so there's no new password to relay, just the
    // pending gate to lift.
    const existingUserId = submission.raw?.linked_profile_id;
    if (existingUserId) {
      trigger({
        title: 'Account Verified',
        message: 'Your Alumni Tracer Survey submission has been verified — sign in to access your dashboard.',
        type: 'success',
        targetUserId: existingUserId,
      });
    }
    setApproveNotice(`Approved — ${submission.name} already has their sign-in details from when they submitted the survey and can now reach their dashboard.`);
    loadSubmissions();
  };

  const handleReject = async (submission: Submission) => {
    setRejecting(true);
    setActionError('');
    const { error } = await supabase.functions.invoke('tracer-intake', {
      body: { action: 'reject', intakeId: submission.id, reason: rejectReason || undefined },
    });
    setRejecting(false);
    if (error) {
      setActionError('Could not reject this submission. Please try again.');
      return;
    }
    setViewDialogOpen(false);
    // Mirrors handleApprove's trigger() call below. Most rejected accounts
    // can never actually see this — AuthContext.tsx's login() signs a
    // rejected account straight back out, so the notifications bell is
    // unreachable for them afterward (AuthPage.tsx's status screen is what
    // they see instead, now including this same reason — see
    // check_registration_status_rejection_reason.sql). Still worth sending:
    // a still-'pending' account can already sign in and have a live session
    // open (see AuthContext.tsx's login()), so this can arrive in real time
    // right up until that session's next status check signs them out.
    const existingUserId = submission.raw?.linked_profile_id;
    if (existingUserId) {
      trigger({
        title: 'Registration Rejected',
        message: rejectReason
          ? `Your Alumni Tracer Survey submission was not approved: ${rejectReason}`
          : 'Your Alumni Tracer Survey submission was not approved. Contact the Alumni Office for details.',
        type: 'error',
        targetUserId: existingUserId,
      });
    }
    loadSubmissions();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-2">
            Pending Registrations
          </h2>
          <p className="text-gray-600">Review Alumni Tracer Survey submissions that couldn't be automatically matched to the Alumni Roster</p>
        </div>
        <div className="flex items-center gap-3">
          <Chip
            onClick={() => setBulkImportOpen(true)}
            label="Import"
            icon={<UploadCloud className="w-4 h-4" />}
            variant="outlined"
            className="shadow-sm cursor-pointer"
            sx={{ fontSize: '1rem', padding: '1.5rem 0.5rem' }}
          />
          <Chip
            label={`${pendingCount} Pending`}
            color={pendingCount > 0 ? 'warning' : 'default'}
            icon={<UserCheck className="w-4 h-4" />}
            className="shadow-md"
            sx={{
              animation: pendingCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
              fontSize: '1rem',
              padding: '1.5rem 0.5rem'
            }}
          />
        </div>
      </div>

      {approveNotice && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
          <span>{approveNotice}</span>
          <button onClick={() => setApproveNotice(null)} className="text-green-500 hover:text-green-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" />
              }}
            />
            <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
              <InputLabel id="batch-year-filter-label">Batch Year</InputLabel>
              <Select
                labelId="batch-year-filter-label"
                label="Batch Year"
                value={batchYearFilter}
                onChange={(e) => setBatchYearFilter(e.target.value)}
              >
                <MenuItem value="All">All Batch Years</MenuItem>
                {batchYears.map(year => (
                  <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-orange-500 animate-slide-up">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Pending Review</span>
              <div className="bg-orange-100 p-2 rounded-lg"><UserCheck className="w-5 h-5 text-orange-500" /></div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-blue-500 animate-slide-up">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Auto-Matched</span>
              <div className="bg-blue-100 p-2 rounded-lg"><ShieldCheck className="w-5 h-5 text-blue-500" /></div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{submissions.filter(s => s.status === 'matched').length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-green-500 animate-slide-up delay-100">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Approved</span>
              <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="w-5 h-5 text-green-500" /></div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{submissions.filter(s => s.status === 'approved').length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-red-500 animate-slide-up delay-200">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Rejected</span>
              <div className="bg-red-100 p-2 rounded-lg"><XCircle className="w-5 h-5 text-red-500" /></div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{submissions.filter(s => s.status === 'rejected').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <TableContainer component={Paper} className="shadow-sm">
        <Table>
          <TableHead>
            <TableRow className="bg-gray-50">
              <TableCell>Submitter</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Batch Year</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><p className="text-gray-500">Loading submissions...</p></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><p className="text-gray-500">No submissions found</p></TableCell></TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>{s.name.charAt(0).toUpperCase()}</Avatar>
                      <div>
                        <p className="text-sm">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{s.department}</TableCell>
                  <TableCell>{s.batchYear || '-'}</TableCell>
                  <TableCell>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <Chip label={STATUS_LABEL[s.status]} size="small" color={STATUS_COLOR[s.status]} />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleView(s)} startIcon={<Eye className="w-3 h-3" />}>Review</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* View / Review Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tracer Survey Submission</DialogTitle>
        <DialogContent>
          {selected && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar sx={{ width: 64, height: 64 }}>{selected.name.charAt(0).toUpperCase()}</Avatar>
                <div>
                  <h3 className="text-xl">{selected.name}</h3>
                  <p className="text-gray-600">{selected.email}</p>
                  <Chip label={STATUS_LABEL[selected.status]} size="small" color={STATUS_COLOR[selected.status]} className="mt-2" />
                </div>
              </div>

              {selected.status === 'pending' && (
                <div className={`px-3 py-2 rounded-md text-sm ${selected.raw?.possible_duplicate_profile_id ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                  {selected.raw?.possible_duplicate_profile_id
                    ? "This email already has an account, but we couldn't automatically confirm this submission is the same person (name, department, or program didn't fully match what's on file). Check the survey below carefully — approving will reset that account's password and show new sign-in details to relay, so only do this if you're confident it's really them. Rejecting leaves the existing account untouched."
                    : selected.raw?.linked_profile_id
                      ? 'This person already has an account and their own sign-in details from when they submitted — signing in currently shows them a pending-approval status page. Approving lifts that; nothing new is created or relayed.'
                      : "This submission's account couldn't be created automatically — approving will create it now and show a one-time password to relay."}
                </div>
              )}
              {selected.status === 'rejected' && selected.rejectionReason && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                  <strong>Rejection reason:</strong> {selected.rejectionReason}
                </div>
              )}
              {actionError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{actionError}</div>
              )}

              {/* Full submitted survey, read-only — a compact label/value
                  summary of the same answers, not the interactive form
                  controls themselves (those are sized for tapping while
                  filling the survey out, not for scanning it afterward). */}
              {(() => {
                const answers = rowToAnswers(selected.raw);
                const sections: [string, () => React.ReactNode][] = [
                  ['Graduate Profile', () => renderProfileSummary(answers)],
                  ['Employment Status', () => renderEmploymentStatusSummary(answers)],
                  ['Employment Information', () => renderEmploymentInfoSummary(answers)],
                  ['Curriculum & Outcomes', () => renderCurriculumSummary(answers)],
                  ['Licensure & Development', () => renderLicensureSummary(answers)],
                  ['Feedback', () => renderFeedbackSummary(answers)],
                ];
                return (
                  <div className="space-y-4">
                    {sections.map(([title, render]) => (
                      <div key={title} className="border border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-1">{title}</h4>
                        {render()}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {selected.status === 'pending' && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Rejection reason (optional — shown to the alumnus on their status screen if provided)</p>
                  <TextField fullWidth size="small" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Could not verify identity" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selected?.status === 'pending' && (
            <>
              <Button color="error" startIcon={<XCircle className="w-4 h-4" />} disabled={actionLoading || rejecting}
                onClick={() => selected && handleReject(selected)}>
                {rejecting ? 'Rejecting…' : 'Reject'}
              </Button>
              <Button variant="contained" color="success" startIcon={<CheckCircle className="w-4 h-4" />} disabled={actionLoading || rejecting}
                onClick={() => selected && handleApprove(selected)}>
                {actionLoading ? 'Approving…' : selected?.raw?.possible_duplicate_profile_id ? 'Confirm & Reset Password' : 'Approve'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* One-time credentials reveal, right after Approve succeeds */}
      <Dialog open={!!reveal} onClose={() => setReveal(null)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          {reveal && (
            <TracerCredentialsReveal
              name={reveal.name} email={reveal.email} password={reveal.password}
              audience="admin" reset={reveal.wasReset}
              onContinue={() => setReveal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <BulkImportResponses
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onImported={loadSubmissions}
      />
    </div>
  );
}
