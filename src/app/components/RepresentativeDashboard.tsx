// =====================================================================
// REPRESENTATIVE DASHBOARD — top-level page for the "representative"
// (batch rep) role. Renders DashboardLayout (the header + sidebar)
// and routes between all the representative/* sub-pages below.
// =====================================================================

// -- 1. React & routing ----------------------------------------------
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router';

// -- 2. App-wide context/state ----------------------------------------
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabaseClient';

// -- 3. Icons (lucide-react) -------------------------------------------
import { BarChart3, Users, DollarSign, ClipboardList, Calendar, Megaphone, BriefcaseBusiness, Shield, CheckCircle, Search, Send } from 'lucide-react';

// -- 4. Third-party UI library (Material UI) --------------------------
import { Avatar, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';

// -- 5. Shared components (reused across roles) -----------------------
import DashboardLayout from './shared/DashboardLayout'; // <- the header + sidebar frame
import ProfilePage from './shared/ProfilePage';
import EventCalendar from './shared/EventCalendar';
import AnnouncementBoard from './shared/AnnouncementBoard';
import JobBoard from './shared/JobBoard';
import { RepDashboardHome } from './shared/RoleDashboardHome';

// -- 6. Alumni-side pages a rep gets too, since a rep is an alumnus first --
// (they keep their own department/batch/program fields, so these render
// exactly as they would under /alumni/*).
import TracerSurveyAlumni from './alumni/TracerSurveyAlumni';
import FundTransparency from './alumni/FundTransparency';
import GraduateTracerForm from './alumni/GraduateTracerForm';

// -- 7. Representative-only sub-pages (routed below) -------------------
import RepDonationMonitor from './representative/RepDonationMonitor';

// Sidebar nav links shown for this role (label, icon, and URL path)
const NAV_ITEMS = [
  { label: 'Dashboard',         icon: <BarChart3 className="w-4 h-4" />,        path: '' },
  { label: 'Alumni Directory',  icon: <Users className="w-4 h-4" />,             path: 'verification' },
  { label: 'Donation Center',   icon: <DollarSign className="w-4 h-4" />,        path: 'donations' },
  { label: 'Tracer Survey',     icon: <ClipboardList className="w-4 h-4" />,     path: 'surveys' },
  { label: 'Events / Calendar', icon: <Calendar className="w-4 h-4" />,          path: 'events' },
  { label: 'Announcements',     icon: <Megaphone className="w-4 h-4" />,         path: 'announcements' },
  { label: 'Job Board',         icon: <BriefcaseBusiness className="w-4 h-4" />, path: 'jobs' },
  { label: 'Activity Log',      icon: <Shield className="w-4 h-4" />,            path: 'activity' },
];

export default function RepresentativeDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      title="Representative Portal"
      subtitle={`Batch ${user?.assignedBatchYear} · ${user?.assignedDepartment} Rep`}
      basePath="representative"
      navItems={NAV_ITEMS}
      // HEADER / SIDEBAR COLOR FOR THE REPRESENTATIVE ROLE — edit
      // these two lines to change the accent color shown only when
      // logged in as a rep. (Global site colors live in src/styles/theme.css.)
      accentColor="#2B5BA8"
      accentGradient="linear-gradient(135deg, #1B3A6B 0%, #2B5BA8 55%, #5B9BD5 100%)"
    >
      <Routes>
        <Route index              element={<RepDashboardHome />} />
        <Route path="profile"       element={<ProfilePage />} />
        <Route path="verification"  element={<BatchVerificationView batchYear={user?.assignedBatchYear || 2021} department={user?.assignedDepartment || 'CSE'} program={user?.assignedProgram || 'BSIT'} />} />
        <Route path="donations"     element={<RepDonationMonitor />} />
        <Route path="donations/transparency" element={<FundTransparency backTo="/representative/donations" />} />
        <Route path="surveys"       element={<TracerSurveyAlumni />} />
        {/* Gate route only — no sidebar nav item points here. App.tsx's
            ProtectedRoute <Navigate>s here until the mandatory Graduate
            Tracer Survey is submitted (reps are gated the same as alumni —
            see TRACER_GATED_ROLES in App.tsx); once submitted,
            GraduateTracerForm.tsx still renders its read-only "review
            mode" if this route is ever reached directly. */}
        <Route path="tracer-form"   element={<GraduateTracerForm />} />
        <Route path="events"        element={<EventCalendar department={user?.assignedDepartment} />} />
        <Route path="announcements" element={<AnnouncementBoard role="representative" department={user?.assignedDepartment} />} />
        <Route path="jobs"          element={<JobBoard role="representative" department={user?.assignedDepartment} userName={user?.name} />} />
        <Route path="activity"      element={<ActivityLogView />} />
      </Routes>
    </DashboardLayout>
  );
}

/* -- Batch Verification (Alumni Directory for Rep) -- */
interface BatchAlumni {
  id: string; name: string; email: string; studentId: string;
  department: string; program: string; isBatchVerified: boolean;
  isAdminApproved: boolean; surveyCompleted: boolean; profileImage?: string;
}

function BatchVerificationView({ batchYear, department, program }: { batchYear: number; department: string; program: string }) {
  const { user } = useAuth();
  const [alumni, setAlumni] = useState<BatchAlumni[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BatchAlumni | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // -- Send Reminder (batch-scoped) --
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('Tracer Survey Reminder');
  const [reminderMessage, setReminderMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

  const templates: Record<string, { title: string; message: string }> = {
    survey: { title: 'Tracer Survey Reminder', message: `Hi batch mates! Please take a few minutes to complete the Tracer Survey if you haven't yet — it helps the college track our batch's progress.` },
    donation: { title: 'Batch Donation Drive', message: `Hi Batch ${batchYear} ${department} ${program}! Consider supporting our current donation campaigns through the Donation Center. Every contribution helps.` },
    general: { title: 'Batch Update', message: '' },
  };
  const applyTemplate = (key: keyof typeof templates) => {
    setReminderTitle(templates[key].title);
    setReminderMessage(templates[key].message);
  };

  const handleSendReminder = async () => {
    if (!reminderTitle.trim() || !reminderMessage.trim()) return;
    setSending(true);
    setSendResult(null);
    const { data, error } = await supabase.rpc('notify_my_batch', {
      p_title: reminderTitle.trim(), p_message: reminderMessage.trim(), p_type: 'info',
    });
    setSending(false);
    if (error) {
      setSendResult({ ok: false, text: error.message || 'Failed to send reminder.' });
    } else {
      setSendResult({ ok: true, text: `Sent to ${data} batch mate${data === 1 ? '' : 's'}.` });
      setReminderMessage('');
    }
  };

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, student_id, department, program, batch_verified, registration_status, profile_image')
      .eq('role', 'alumni')
      .eq('department', department)
      .eq('program', program)
      .eq('batch_year', batchYear);
    if (!data) return;
    const { data: responses } = await supabase.from('tracer_survey_responses').select('respondent_id');
    const completed = new Set((responses || []).map((r: any) => r.respondent_id));
    setAlumni(data.map((a: any) => ({
      id: a.id, name: a.name, email: a.email, studentId: a.student_id || '—',
      department: a.department, program: a.program,
      isBatchVerified: a.batch_verified, isAdminApproved: a.registration_status === 'approved',
      surveyCompleted: completed.has(a.id), profileImage: a.profile_image || undefined,
    })));
  };

  useEffect(() => { load(); }, [batchYear, department, program]);

  const handleVerify = async (a: BatchAlumni) => {
    if (!user) return;
    await supabase.from('profiles').update({
      batch_verified: true, batch_verified_by: user.id, batch_verified_at: new Date().toISOString(),
    }).eq('id', a.id);
    await supabase.rpc('log_audit', {
      p_action: `Verified batch mate: ${a.name}`,
      p_module: 'Alumni Database',
      p_details: `Batch ${batchYear} · ${department} · ${program}`,
      p_severity: 'Medium',
    });
    setDialogOpen(false);
    await load();
  };

  const filtered = alumni.filter(a =>
    a.department === department && a.program === program &&
    (a.name.toLowerCase().includes(search.toLowerCase()) || a.email.includes(search) || a.studentId.includes(search))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Alumni Directory</h2>
          <p className="text-sm text-gray-500">Verify Batch {batchYear} {department} {program} members</p>
        </div>
        <Button
          variant="contained"
          startIcon={<Send className="w-4 h-4" />}
          onClick={() => { setReminderOpen(true); setSendResult(null); applyTemplate('survey'); }}
          className="bg-gradient-to-r from-blue-600 to-blue-800"
        >
          Send Reminder to Batch
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Verification Scope</p>
          <p className="text-xs text-blue-600 mt-0.5">You can only verify alumni from <strong>Batch {batchYear} {department} {program}</strong>. All actions are audit-logged per RA 10175.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or student ID..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-500 mb-1">No Batch Members Found</h3>
            <p className="text-sm text-gray-400 max-w-xs">No alumni from Batch {batchYear} {department} {program} have registered yet. Once they register, they will appear here for your verification.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Alumni','Student ID','Program','Batch Verified','Admin Approved','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={a.profileImage} alt={a.name} sx={{ width: 32, height: 32 }} />
                        <div>
                          <p className="font-semibold text-gray-800">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.studentId}</td>
                    <td className="px-4 py-3 text-gray-600">{a.program}</td>
                    <td className="px-4 py-3"><Chip label={a.isBatchVerified ? 'Verified' : 'Pending'} size="small" color={a.isBatchVerified ? 'info' : 'warning'} /></td>
                    <td className="px-4 py-3"><Chip label={a.isAdminApproved ? 'Approved' : 'Pending'} size="small" color={a.isAdminApproved ? 'success' : 'default'} /></td>
                    <td className="px-4 py-3">
                      <Button size="small" onClick={() => { setSelected(a); setDialogOpen(true); }}>Review</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Verify Batch Member</DialogTitle>
        <DialogContent>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <Avatar src={selected.profileImage} alt={selected.name} sx={{ width: 64, height: 64 }} />
                <div>
                  <h3 className="text-lg font-bold">{selected.name}</h3>
                  <p className="text-gray-500 text-sm">{selected.email}</p>
                  <p className="text-xs text-gray-400">Student ID: {selected.studentId}</p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-800"><strong>⚠️ Verification Responsibility:</strong> By verifying, you confirm this person is a genuine member of Batch {batchYear} {department} {program}. This is logged in the audit trail.</p>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {selected && !selected.isBatchVerified && (
            <Button variant="contained" color="success" startIcon={<CheckCircle className="w-4 h-4" />} onClick={() => handleVerify(selected)}>
              Verify Batch Mate
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={reminderOpen} onClose={() => setReminderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Reminder — Batch {batchYear} {department} {program}</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-500">This goes only to alumni in your assigned batch. Pick a quick template or write your own.</p>
            <div className="flex gap-2 flex-wrap">
              {(['survey', 'donation', 'general'] as const).map(key => (
                <button key={key} onClick={() => applyTemplate(key)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 capitalize transition-colors">
                  {key === 'survey' ? 'Tracer Survey' : key === 'donation' ? 'Donation Drive' : 'General'}
                </button>
              ))}
            </div>
            <TextField fullWidth label="Title" value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} />
            <TextField fullWidth multiline minRows={4} label="Message" value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} />
            {sendResult && <Alert severity={sendResult.ok ? 'success' : 'error'}>{sendResult.text}</Alert>}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleSendReminder} disabled={sending || !reminderTitle.trim() || !reminderMessage.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

/* -- Activity Log -- */
interface ActivityLogEntry { id: string; timestamp: string; action: string; module: string; details: string; severity: string; }

function ActivityLogView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('audit_logs')
      .select('id, occurred_at, action, module, details, severity')
      .eq('actor_id', user.id)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => setLogs((data || []).map((r: any) => ({
        id: r.id, timestamp: r.occurred_at, action: r.action, module: r.module, details: r.details || '', severity: r.severity,
      }))));
  }, [user]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Activity Log</h2>
        <p className="text-sm text-gray-500">RA 10175 compliant audit trail of all your actions</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">Per RA 10175 (Cybercrime Prevention Act), all verification actions are timestamped, logged, and cannot be deleted. These logs are accessible to administrators.</p>
      </div>
      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Shield className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-500 mb-1">No Activity Yet</h3>
            <p className="text-sm text-gray-400 max-w-xs">Your verification actions will appear here. Start by reviewing your assigned batch members in the Alumni Directory.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {logs.map(log => (
            <div key={log.id} className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{log.action}</p>
                <p className="text-xs text-gray-500">{log.details}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
