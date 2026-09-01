import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { FileText, Search, Eye, Send, BarChart3, Link as LinkIcon, ExternalLink, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Card, CardContent, TextField, Button, Chip, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, ToggleButton, ToggleButtonGroup, Alert, IconButton, Checkbox, FormControlLabel } from '@mui/material';

// ================= [SHARED: TRACERSURVEYSVIEW] =================
// Backed by Supabase (tracer_surveys / tracer_survey_responses tables).
// A survey is either 'standard' (the built-in question set below,
// answered in-app) or 'external' (a link to an outside form, e.g.
// Google Forms — alumni just get sent there in a new tab). Response
// counts are inherently untrackable for external surveys, so they're
// excluded from response-rate stats instead of being force-fit into them.
//
// Shared verbatim between admin/TracerSurveys.tsx and
// faculty/FacultyTracerSurveys.tsx — one implementation so a feature
// added here reaches both roles instead of two copies silently
// drifting apart. Same split as shared/DonationManagementView.tsx.
//
// `department` is the ONLY behavioral difference between the two:
//   - omitted (admin): sees every survey, creates/deploys/closes
//     college-wide ('All') or department-targeted surveys freely.
//   - set (faculty): the survey list is narrowed to surveys targeted at
//     this department plus college-wide ('All') ones (visible so
//     faculty can see how their own alumni are responding to those
//     too), every survey this faculty account creates is always
//     targeted at their own department, and Deploy/Close only render
//     for surveys they can actually act on (their own department's —
//     'All' surveys stay admin-only to manage). This is a UI
//     convenience only — the real boundary is enforced at the database
//     via RLS (see supabase/faculty_alumni_tracer_scope.sql's
//     tracer_surveys_write_faculty_own_dept policy), so a faculty
//     account can't deploy/close another department's (or a
//     college-wide) survey even by bypassing this screen.

interface Survey {
  id: string; title: string; description: string; targetDept: string; targetYear: string;
  totalSent: number; totalResponses: number; status: 'Draft' | 'Active' | 'Closed'; createdDate: string;
  surveyType: 'standard' | 'external'; surveyLink: string | null;
}

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// ================= [BUILDER: Google Forms–style question builder] =================
// Powers the "Standard Question Set" branch of the Create Survey dialog.
// Admins/faculty compose their own sections/questions instead of using the
// fixed TEMPLATE_QUESTIONS below (that template is now only used by "Quick
// Deploy Template"). Flattened + saved into tracer_surveys.questions (jsonb)
// in the same {id, section, question, type, options?, ...} shape
// TracerSurveyAlumni.tsx already reads — 'radio' | 'text' | 'textarea' keep
// working unchanged for any already-deployed survey; the types below are
// additive.
type QuestionType = 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes' | 'dropdown' | 'linear_scale';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_answer: 'Short answer',
  paragraph: 'Paragraph',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  linear_scale: 'Linear scale (1–5)',
};
const CHOICE_TYPES: QuestionType[] = ['multiple_choice', 'checkboxes', 'dropdown'];

interface BuilderQuestion {
  id: string; question: string; type: QuestionType; options: string[]; required: boolean;
  placeholder?: string; scaleLowLabel?: string; scaleHighLabel?: string;
}
interface BuilderSection { id: string; title: string; questions: BuilderQuestion[]; }
interface SurveyQuestion {
  id: string; section: string; question: string; type: QuestionType; required?: boolean;
  options?: string[]; placeholder?: string; scaleLowLabel?: string; scaleHighLabel?: string;
}

let builderIdSeq = 0;
const newBuilderId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(builderIdSeq++).toString(36)}`;
const emptyQuestion = (): BuilderQuestion => ({ id: newBuilderId('q'), question: '', type: 'short_answer', options: [], required: false });
const emptySection = (n: number): BuilderSection => ({ id: newBuilderId('s'), title: `Section ${n}`, questions: [emptyQuestion()] });

// Drops blank questions, trims text, and only keeps `options` for choice types.
const flattenBuilderQuestions = (sections: BuilderSection[]): SurveyQuestion[] =>
  sections.flatMap(s => s.questions
    .filter(q => q.question.trim().length > 0)
    .map((q): SurveyQuestion => ({
      id: q.id,
      section: s.title.trim() || 'Section',
      question: q.question.trim(),
      type: q.type,
      required: q.required,
      ...(CHOICE_TYPES.includes(q.type) ? { options: q.options.map(o => o.trim()).filter(Boolean) } : {}),
      ...(q.placeholder?.trim() ? { placeholder: q.placeholder.trim() } : {}),
      ...(q.type === 'linear_scale' && q.scaleLowLabel?.trim() ? { scaleLowLabel: q.scaleLowLabel.trim() } : {}),
      ...(q.type === 'linear_scale' && q.scaleHighLabel?.trim() ? { scaleHighLabel: q.scaleHighLabel.trim() } : {}),
    })));

const isBuilderValid = (sections: BuilderSection[]) => {
  const flat = flattenBuilderQuestions(sections);
  if (flat.length === 0) return false;
  return flat.every(q => !CHOICE_TYPES.includes(q.type) || (q.options && q.options.length >= 2));
};

const TEMPLATE_QUESTIONS = [
  { id: 'q2', section: 'Employment Details', question: 'How long did it take you to find your first job after graduation?', type: 'radio', options: ['Less than 1 month', '1-3 months', '4-6 months', '7-12 months', 'More than 1 year', 'Not applicable'] },
  { id: 'q3', section: 'Employment Details', question: 'Is your current job related to your course/program?', type: 'radio', options: ['Very related', 'Somewhat related', 'Not related', 'Not applicable'] },
  { id: 'q4', section: 'Employment Details', question: 'What industry are you currently working in?', type: 'radio', options: ['Information Technology', 'Business / Finance', 'Tourism / Hospitality', 'Education', 'Healthcare', 'Government', 'Other'] },
  { id: 'q5', section: 'Employment Details', question: 'What is your current job title / position?', type: 'text', placeholder: 'e.g. Software Engineer, Front Desk Officer' },
  { id: 'q6', section: 'Employment Details', question: 'What is your employer name and location?', type: 'text', placeholder: 'e.g. TechCorp, Cebu City' },
  { id: 'q7', section: 'Further Studies', question: 'Are you currently pursuing or planning to pursue further studies?', type: 'radio', options: ['Yes, currently enrolled', 'Yes, planning to enroll', 'No'] },
  { id: 'q8', section: 'Feedback', question: 'How would you rate the quality of education you received from Asian College?', type: 'radio', options: ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'] },
  { id: 'q9', section: 'Feedback', question: 'Which skills from your program have been most useful in your career?', type: 'textarea', placeholder: 'Share the skills, subjects, or experiences that helped you most...' },
  { id: 'q10', section: 'Feedback', question: 'Do you have any suggestions to improve the curriculum or alumni services?', type: 'textarea', placeholder: 'Your honest feedback helps us improve...' },
];

interface Props {
  // Faculty pass their own department here to lock the whole screen to
  // it; admin renders this with no department at all.
  department?: string;
}

export default function TracerSurveysView({ department }: Props) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSurveyType, setNewSurveyType] = useState<'standard' | 'external'>('standard');
  const [newSurveyLink, setNewSurveyLink] = useState('');
  const [builderSections, setBuilderSections] = useState<BuilderSection[]>([emptySection(1)]);
  const [viewSurvey, setViewSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<any[]>([]);

  // -- Question builder mutations (Google Forms–style: sections -> questions) --
  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) =>
    setBuilderSections(secs => secs.map(s => s.id === sectionId ? { ...s, ...patch } : s));
  const addSection = () => setBuilderSections(secs => [...secs, emptySection(secs.length + 1)]);
  const removeSection = (sectionId: string) =>
    setBuilderSections(secs => secs.length > 1 ? secs.filter(s => s.id !== sectionId) : secs);

  const updateQuestion = (sectionId: string, qId: string, patch: Partial<BuilderQuestion>) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map(q => q.id === qId ? { ...q, ...patch } : q),
    }));
  const setQuestionType = (sectionId: string, qId: string, type: QuestionType) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map(q => q.id !== qId ? q : {
        ...q, type, options: CHOICE_TYPES.includes(type) ? (q.options.length ? q.options : ['Option 1']) : q.options,
      }),
    }));
  const addQuestion = (sectionId: string) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : { ...s, questions: [...s.questions, emptyQuestion()] }));
  const removeQuestion = (sectionId: string, qId: string) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.length > 1 ? s.questions.filter(q => q.id !== qId) : s.questions,
    }));
  const moveQuestion = (sectionId: string, qId: string, dir: -1 | 1) =>
    setBuilderSections(secs => secs.map(s => {
      if (s.id !== sectionId) return s;
      const idx = s.questions.findIndex(q => q.id === qId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= s.questions.length) return s;
      const qs = [...s.questions];
      [qs[idx], qs[target]] = [qs[target], qs[idx]];
      return { ...s, questions: qs };
    }));

  const addOption = (sectionId: string, qId: string) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map(q => q.id !== qId ? q : { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }),
    }));
  const updateOption = (sectionId: string, qId: string, idx: number, value: string) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map(q => q.id !== qId ? q : { ...q, options: q.options.map((o, i) => i === idx ? value : o) }),
    }));
  const removeOption = (sectionId: string, qId: string, idx: number) =>
    setBuilderSections(secs => secs.map(s => s.id !== sectionId ? s : {
      ...s, questions: s.questions.map(q => (q.id !== qId || q.options.length <= 1) ? q : { ...q, options: q.options.filter((_, i) => i !== idx) }),
    }));

  const load = async () => {
    const { data } = await supabase.from('tracer_surveys').select('*').order('created_at', { ascending: false });
    if (!data) return;

    let alumniQuery = supabase.from('profiles').select('department').eq('role', 'alumni');
    if (department) alumniQuery = alumniQuery.eq('department', department);
    const { data: alumniRows } = await alumniQuery;
    const deptCounts: Record<string, number> = {};
    (alumniRows || []).forEach((a: any) => { deptCounts[a.department] = (deptCounts[a.department] || 0) + 1; });
    const totalAlumni = (alumniRows || []).length;

    const { data: responseRows } = await supabase.from('tracer_survey_responses').select('survey_id');
    const responseCounts: Record<string, number> = {};
    (responseRows || []).forEach((r: any) => { responseCounts[r.survey_id] = (responseCounts[r.survey_id] || 0) + 1; });

    // tracer_surveys is readable in full by everyone (see
    // tracer_surveys_select_all), so a faculty session's plain select
    // above already comes back with every department's surveys — narrow
    // it down here to "this department, or college-wide" the same way
    // DonationManagementView's scopedCampaigns does for campaigns.
    const visible = department ? data.filter((s: any) => s.target_dept === department || s.target_dept === 'All') : data;

    setSurveys(visible.map((s: any) => ({
      id: s.id, title: s.title, description: s.description || '',
      targetDept: s.target_dept, targetYear: s.target_year, status: s.status,
      createdDate: s.created_at,
      totalSent: s.target_dept === 'All' ? totalAlumni : (deptCounts[s.target_dept] || 0),
      totalResponses: responseCounts[s.id] || 0,
      surveyType: s.survey_type === 'external' ? 'external' : 'standard',
      surveyLink: s.survey_link || null,
    })));
  };

  useEffect(() => { load(); }, [department]);

  const filteredSurveys = surveys.filter(survey =>
    survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    survey.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    survey.targetDept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // A survey can only be Deployed/Closed by whoever owns its target
  // department — admin owns everything; faculty only their own
  // department's surveys (never a college-wide 'All' one). RLS enforces
  // this independently (tracer_surveys_write_faculty_own_dept); this just
  // keeps the buttons from appearing where the write would be rejected.
  const canManage = (survey: Survey) => !department || survey.targetDept === department;

  // targetDept/targetYear are optional and only used by the "Quick Deploy
  // Template" shortcut below — the Create New Survey modal no longer collects
  // either, so handleCreate's call omits them entirely and the insert leaves
  // those keys out of the payload, falling back to their DB column defaults
  // ('All' for both, per supabase/schema.sql) rather than the modal sending
  // an explicit value. A scoped (faculty) view always passes its own
  // `department` through instead, so a faculty account can never create a
  // college-wide survey.
  const createSurvey = async (
    status: 'Draft' | 'Active', title: string, description: string,
    surveyType: 'standard' | 'external' = 'standard', surveyLink: string = '', customQuestions?: SurveyQuestion[],
    targetDept?: string, targetYear?: string
  ) => {
    if (!user) return;
    await supabase.from('tracer_surveys').insert({
      title, description, status,
      ...(targetDept !== undefined ? { target_dept: targetDept } : {}),
      ...(targetYear !== undefined ? { target_year: targetYear } : {}),
      questions: surveyType === 'standard' ? (customQuestions?.length ? customQuestions : TEMPLATE_QUESTIONS) : [],
      survey_type: surveyType,
      survey_link: surveyType === 'external' ? surveyLink.trim() : null,
      created_by: user.id,
    });
    await supabase.rpc('log_audit', {
      p_action: status === 'Active' ? `Deployed survey: ${title}` : `Created survey: ${title}`,
      p_module: 'Tracer Surveys',
      p_details: targetDept ? `Target: ${targetDept} · ${targetYear}` : null,
      p_severity: 'Low',
    });
    await load();
  };

  const openCreateDialog = () => {
    setNewTitle(''); setNewDescription('');
    setNewSurveyType('standard'); setNewSurveyLink(''); setBuilderSections([emptySection(1)]);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newTitle) return;
    if (newSurveyType === 'external' && !isValidUrl(newSurveyLink)) return;
    if (newSurveyType === 'standard' && !isBuilderValid(builderSections)) return;
    const customQuestions = newSurveyType === 'standard' ? flattenBuilderQuestions(builderSections) : undefined;
    // Faculty always target their own department; admin leaves it unset
    // (falls back to the 'All' DB default), same as before this was split out.
    await createSurvey('Draft', newTitle, newDescription, newSurveyType, newSurveyLink, customQuestions, department, department ? 'All' : undefined);
    setCreateOpen(false);
    setNewTitle(''); setNewDescription('');
    setNewSurveyType('standard'); setNewSurveyLink(''); setBuilderSections([emptySection(1)]);
  };

  const handleDeployTemplate = () => createSurvey(
    'Active', 'Employment Tracer Survey',
    department
      ? `Standard employment tracer questions deployed to ${department} alumni.`
      : 'Standard employment tracer questions deployed to all alumni.',
    'standard', '', undefined, department || 'All', 'All'
  );

  const handleClose = async (survey: Survey) => {
    await supabase.from('tracer_surveys').update({ status: 'Closed' }).eq('id', survey.id);
    await supabase.rpc('log_audit', { p_action: `Closed survey: ${survey.title}`, p_module: 'Tracer Surveys', p_details: null, p_severity: 'Low' });
    await load();
  };

  // Promotes a Draft (built via the Create Survey dialog) to Active so it
  // starts showing up on the alumni side — TracerSurveyAlumni.tsx only
  // queries status='Active'. Without this, a custom-built survey had no way
  // to leave Draft short of the unrelated "Quick Deploy Template" shortcut.
  const handleActivate = async (survey: Survey) => {
    await supabase.from('tracer_surveys').update({ status: 'Active' }).eq('id', survey.id);
    await supabase.rpc('log_audit', { p_action: `Deployed survey: ${survey.title}`, p_module: 'Tracer Surveys', p_details: null, p_severity: 'Low' });
    await load();
  };

  const openView = async (survey: Survey) => {
    setViewSurvey(survey);
    if (survey.surveyType === 'external') { setResponses([]); return; } // untrackable — nothing to fetch
    const { data } = await supabase
      .from('tracer_survey_responses')
      .select('id, submitted_at, respondent:profiles(name, department, program)')
      .eq('survey_id', survey.id)
      .order('submitted_at', { ascending: false });
    setResponses(data || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1">Tracer Surveys</h2>
          <p className="text-gray-600">
            {department ? <>Deploy and monitor tracer surveys for <strong>{department}</strong></> : 'Deploy and monitor alumni tracer surveys'}
          </p>
        </div>
        <Button variant="contained" startIcon={<FileText className="w-4 h-4" />} className="bg-blue-600" onClick={openCreateDialog}>
          Create New Survey
        </Button>
      </div>

      {department && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-amber-600">🔒</span>
          <p className="text-xs text-amber-700 font-medium">
            You can create, deploy, and close surveys for <strong>{department}</strong> only. College-wide surveys are shown for visibility but stay admin-managed.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <Card>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search surveys by title, description, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" /> }}
          />
        </CardContent>
      </Card>

      {/* Survey Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Surveys</span>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl">{surveys.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active Surveys</span>
              <Send className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl">{surveys.filter(s => s.status === 'Active').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Avg Response Rate</span>
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl">
              {(() => {
                const trackable = surveys.filter(s => s.surveyType !== 'external');
                if (trackable.length === 0) return '0%';
                return `${(trackable.reduce((sum, s) => sum + (s.totalSent ? s.totalResponses / s.totalSent : 0), 0) / trackable.length * 100).toFixed(1)}%`;
              })()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Excludes external-link surveys (untrackable)</p>
          </CardContent>
        </Card>
      </div>

      {/* Survey List */}
      <div className="space-y-4">
        {filteredSurveys.length === 0 ? (
          <Card><CardContent className="text-center py-8"><p className="text-gray-500">No surveys found matching your search</p></CardContent></Card>
        ) : (
          filteredSurveys.map((survey) => {
            const responseRate = survey.totalSent ? (survey.totalResponses / survey.totalSent) * 100 : 0;
            return (
              <Card key={survey.id}>
                <CardContent>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg">{survey.title}</h3>
                        <Chip label={survey.status} size="small" color={survey.status === 'Active' ? 'success' : survey.status === 'Draft' ? 'default' : 'error'} />
                        {survey.surveyType === 'external' && (
                          <Chip icon={<LinkIcon className="w-3.5 h-3.5" />} label="External Link" size="small" variant="outlined" color="info" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{survey.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Target: {survey.targetDept} • {survey.targetYear}</span>
                        <span>Created: {new Date(survey.createdDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outlined" size="small" startIcon={<Eye className="w-4 h-4" />} onClick={() => openView(survey)}>View</Button>
                      {canManage(survey) && survey.status === 'Draft' && (
                        <Button variant="contained" size="small" className="bg-blue-600" startIcon={<Send className="w-4 h-4" />} onClick={() => handleActivate(survey)}>Deploy</Button>
                      )}
                      {canManage(survey) && survey.status !== 'Closed' && (
                        <Button variant="outlined" size="small" color="error" onClick={() => handleClose(survey)}>Close</Button>
                      )}
                    </div>
                  </div>
                  {survey.surveyType === 'external' ? (
                    <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <span className="text-blue-700 flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5" /> External link — response rate isn't tracked</span>
                      <a href={survey.surveyLink || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                        Open Link <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Response Rate</span>
                        <span>{survey.totalResponses} / {survey.totalSent} ({responseRate.toFixed(1)}%)</span>
                      </div>
                      <LinearProgress variant="determinate" value={responseRate} className="h-2 rounded" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Survey Template Preview */}
      <Card>
        <CardContent>
          <h3 className="text-lg mb-4">Quick Deploy Template</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <p className="text-sm">Standard Employment Tracer Questions:</p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• Company name and position</li>
              <li>• Job alignment with degree program</li>
              <li>• Monthly income range</li>
              <li>• Skills utilized in current work</li>
              <li>• Recommendations for curriculum improvement</li>
            </ul>
            <Button variant="contained" size="small" className="bg-blue-600" onClick={handleDeployTemplate}>
              {department ? `Deploy to ${department} Alumni` : 'Deploy to All Alumni'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Survey</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <TextField fullWidth label="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <TextField fullWidth label="Description" multiline rows={2} value={newDescription} onChange={e => setNewDescription(e.target.value)} />

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Survey Type</p>
              <ToggleButtonGroup
                fullWidth
                exclusive
                size="small"
                value={newSurveyType}
                onChange={(_e, val) => { if (val) setNewSurveyType(val); }}
              >
                <ToggleButton value="standard">Standard Question Set</ToggleButton>
                <ToggleButton value="external">External Survey Link</ToggleButton>
              </ToggleButtonGroup>
            </div>

            {newSurveyType === 'standard' ? (
              <div className="space-y-4">
                <Alert severity="info" className="text-xs">
                  Build your own question set, Google Forms–style — add sections and questions, and pick each
                  question's answer type. The survey is created as a Draft — click "Deploy" on it afterward to make it visible to alumni.
                </Alert>

                {builderSections.map((section, sIdx) => (
                  <Card key={section.id} variant="outlined" className="!border-blue-100 !bg-blue-50/20">
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <TextField
                          fullWidth size="small" label={`Section ${sIdx + 1} title`}
                          value={section.title} onChange={e => updateSection(section.id, { title: e.target.value })}
                        />
                        {builderSections.length > 1 && (
                          <IconButton size="small" color="error" onClick={() => removeSection(section.id)} title="Remove section">
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        )}
                      </div>

                      {section.questions.map((q, qIdx) => (
                        <div key={q.id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
                          <div className="flex items-start gap-2">
                            <TextField
                              fullWidth size="small" label={`Question ${qIdx + 1}`}
                              value={q.question} onChange={e => updateQuestion(section.id, q.id, { question: e.target.value })}
                            />
                            <FormControl size="small" style={{ minWidth: 190, flexShrink: 0 }}>
                              <InputLabel>Type</InputLabel>
                              <Select
                                label="Type" value={q.type}
                                onChange={e => setQuestionType(section.id, q.id, e.target.value as QuestionType)}
                              >
                                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                                  <MenuItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <div className="flex items-center flex-shrink-0 pt-0.5">
                              <IconButton size="small" disabled={qIdx === 0} onClick={() => moveQuestion(section.id, q.id, -1)} title="Move up">
                                <ChevronUp className="w-4 h-4" />
                              </IconButton>
                              <IconButton size="small" disabled={qIdx === section.questions.length - 1} onClick={() => moveQuestion(section.id, q.id, 1)} title="Move down">
                                <ChevronDown className="w-4 h-4" />
                              </IconButton>
                              <IconButton size="small" color="error" disabled={section.questions.length === 1} onClick={() => removeQuestion(section.id, q.id)} title="Delete question">
                                <Trash2 className="w-4 h-4" />
                              </IconButton>
                            </div>
                          </div>

                          {CHOICE_TYPES.includes(q.type) && (
                            <div className="space-y-1.5 pl-1">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 w-4 flex-shrink-0 text-center">
                                    {q.type === 'checkboxes' ? '☐' : q.type === 'dropdown' ? `${oIdx + 1}.` : '○'}
                                  </span>
                                  <TextField
                                    fullWidth size="small" placeholder={`Option ${oIdx + 1}`}
                                    value={opt} onChange={e => updateOption(section.id, q.id, oIdx, e.target.value)}
                                  />
                                  <IconButton size="small" disabled={q.options.length <= 1} onClick={() => removeOption(section.id, q.id, oIdx)} title="Remove option">
                                    <X className="w-3.5 h-3.5" />
                                  </IconButton>
                                </div>
                              ))}
                              <Button size="small" startIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => addOption(section.id, q.id)}>
                                Add option
                              </Button>
                            </div>
                          )}

                          {q.type === 'linear_scale' && (
                            <div className="grid grid-cols-2 gap-3 pl-1">
                              <TextField
                                size="small" label="Label for 1 (optional)" value={q.scaleLowLabel || ''}
                                onChange={e => updateQuestion(section.id, q.id, { scaleLowLabel: e.target.value })}
                              />
                              <TextField
                                size="small" label="Label for 5 (optional)" value={q.scaleHighLabel || ''}
                                onChange={e => updateQuestion(section.id, q.id, { scaleHighLabel: e.target.value })}
                              />
                            </div>
                          )}

                          {(q.type === 'short_answer' || q.type === 'paragraph') && (
                            <TextField
                              fullWidth size="small" label="Placeholder text (optional)"
                              value={q.placeholder || ''} onChange={e => updateQuestion(section.id, q.id, { placeholder: e.target.value })}
                            />
                          )}

                          <FormControlLabel
                            control={<Checkbox size="small" checked={q.required} onChange={e => updateQuestion(section.id, q.id, { required: e.target.checked })} />}
                            label={<span className="text-xs text-gray-600">Required</span>}
                          />
                        </div>
                      ))}

                      <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => addQuestion(section.id)}>
                        Add question
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outlined" size="small" startIcon={<Plus className="w-4 h-4" />} onClick={addSection}>
                  Add section
                </Button>

                {!isBuilderValid(builderSections) && (
                  <p className="text-xs text-red-500">
                    Add at least one question, and give every multiple choice / checkboxes / dropdown question at least 2 options.
                  </p>
                )}
              </div>
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Survey URL"
                  placeholder="https://forms.google.com/..."
                  value={newSurveyLink}
                  onChange={e => setNewSurveyLink(e.target.value)}
                  error={newSurveyLink.trim().length > 0 && !isValidUrl(newSurveyLink)}
                  helperText={
                    newSurveyLink.trim().length > 0 && !isValidUrl(newSurveyLink)
                      ? 'Enter a valid http(s) URL.'
                      : 'Alumni will open this link in a new tab instead of the built-in form.'
                  }
                />
                <Alert severity="info" className="text-xs">
                  Response counts can't be tracked automatically for external surveys — they're excluded from response-rate stats.
                </Alert>
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            className="bg-blue-600"
            disabled={!newTitle || (newSurveyType === 'external' && !isValidUrl(newSurveyLink)) || (newSurveyType === 'standard' && !isBuilderValid(builderSections))}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Responses Dialog */}
      <Dialog open={!!viewSurvey} onClose={() => setViewSurvey(null)} maxWidth="md" fullWidth>
        <DialogTitle>{viewSurvey?.title} — Responses</DialogTitle>
        <DialogContent>
          {viewSurvey?.surveyType === 'external' ? (
            <div className="text-sm text-gray-500 py-6 text-center space-y-2">
              <p>Responses aren't tracked for external surveys — they're collected on the outside form itself.</p>
              {viewSurvey.surveyLink && (
                <a href={viewSurvey.surveyLink} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1">
                  Open survey link <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No responses yet.</p>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Alumni</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Program</TableCell>
                    <TableCell>Submitted</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {responses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.respondent?.name || 'Unknown'}</TableCell>
                      <TableCell>{r.respondent?.department || '—'}</TableCell>
                      <TableCell>{r.respondent?.program || '—'}</TableCell>
                      <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewSurvey(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
