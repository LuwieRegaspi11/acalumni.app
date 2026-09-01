import { useState } from 'react';
import { Briefcase, Plus, MapPin, Clock, X, Edit } from 'lucide-react';
import { useJobBoard, Job } from './JobBoardContext';

type ViewerRole = 'admin' | 'faculty' | 'representative' | 'alumni';

interface Props {
  role: ViewerRole;
  department?: string;
  userName?: string;
}

const TYPE_COLORS: Record<string, string> = {
  'Full-time': 'bg-green-100 text-green-700',
  'Part-time': 'bg-blue-100 text-blue-700',
  'Remote': 'bg-purple-100 text-purple-700',
  'Contract': 'bg-orange-100 text-orange-700',
  'Internship': 'bg-yellow-100 text-yellow-700',
};

const BLANK_FORM = { title: '', company: '', location: '', type: 'Full-time' as Job['type'], department: 'All', description: '', requirements: '', applyLink: '', status: 'Active' as Job['status'] };

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <Briefcase className="w-8 h-8 text-gray-300" />
    </div>
    <h3 className="font-semibold text-gray-500 mb-1">No Job Listings Yet</h3>
    <p className="text-sm text-gray-400 max-w-xs">{message}</p>
  </div>
);

export default function JobBoard({ role, department, userName = 'User' }: Props) {
  const { jobs, addJob, updateJob, closeJob } = useJobBoard();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Job | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM, department: department || 'All' });
  const [filterDept, setFilterDept] = useState('All');
  const [filterType, setFilterType] = useState('All');

  const canPost = role === 'admin' || role === 'faculty';
  // Faculty can only manage postings in their own assigned department;
  // admin manages everything. Alumni/representatives are view-only.
  const canManageJob = (j: Job) => role === 'admin' || (role === 'faculty' && j.department === department);

  const visible = jobs.filter(j => {
    if (role === 'admin') return true; // admin sees every job, any department, any status
    if (role === 'faculty') return j.department === department || j.department === 'All';
    // alumni & representative: view only, scoped to their own department (or 'All')
    return j.status === 'Active' && (j.department === department || j.department === 'All');
  }).filter(j => {
    const matchDept = filterDept === 'All' || j.department === filterDept || j.department === 'All';
    const matchType = filterType === 'All' || j.type === filterType;
    return matchDept && matchType;
  });

  const handleSave = () => {
    const jobData = {
      ...form,
      department: department || form.department,
      postedBy: userName,
      postedByRole: role,
      status: 'Active' as const,
    };
    if (editTarget) {
      updateJob(editTarget.id, form);
    } else {
      addJob(jobData);
    }
    setForm({ ...BLANK_FORM, department: department || 'All' });
    setShowForm(false); setEditTarget(null);
  };

  const openEdit = (j: Job) => { setEditTarget(j); setForm({ title: j.title, company: j.company, location: j.location, type: j.type, department: j.department, description: j.description, requirements: j.requirements, applyLink: j.applyLink || '', status: j.status }); setShowForm(true); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Job Board</h2>
          <p className="text-sm text-gray-500">
            {role === 'alumni' ? `Browse job opportunities for the ${department || 'your'} department` :
             role === 'representative' ? `View job opportunities for the ${department || 'your'} department` :
             role === 'faculty' ? `Manage job postings for ${department} department` :
             'Manage all job listings across departments'}
          </p>
        </div>
        {canPost && (
          <button onClick={() => { setEditTarget(null); setForm({ ...BLANK_FORM, department: department || 'All' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            <Plus className="w-4 h-4" />
            Post a Job
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {role === 'admin' && (
          <>
            {['All', 'CSE', 'CTHM', 'BAA'].map(d => (
              <button key={d} onClick={() => setFilterDept(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterDept === d ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={filterDept === d ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
                {d === 'All' ? 'All Departments' : d}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
          </>
        )}
        {['All', 'Full-time', 'Part-time', 'Remote', 'Contract', 'Internship'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterType === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Job listings */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <EmptyState message={(role === 'alumni' || role === 'representative') ? 'No job listings available for your department yet. Check back soon!' : 'No job postings match your filters.'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(j => (
            <div key={j.id} className={`bg-white rounded-xl border shadow-sm p-5 ${j.status === 'Closed' ? 'opacity-60' : 'border-gray-100 hover:shadow-md'} transition-all`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{j.title}</h3>
                  <p className="text-sm text-gray-500">{j.company}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[j.type]}`}>{j.type}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700">{j.department}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{j.postedAt}</span>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{j.description}</p>
              <div className="text-xs text-gray-500 mb-4 bg-gray-50 rounded-lg p-2">
                <span className="font-semibold text-gray-600">Requirements: </span>{j.requirements}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(role === 'alumni' || role === 'representative') && (
                  <a href={j.applyLink || `mailto:careers@asiancollege.edu?subject=Application: ${j.title}`}
                    target={j.applyLink ? '_blank' : undefined} rel={j.applyLink ? 'noopener noreferrer' : undefined}
                    className="flex-1 text-center py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                    Apply Now
                  </a>
                )}
                {canManageJob(j) && (
                  <>
                    <button onClick={() => openEdit(j)} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    {j.status === 'Active' && (
                      <button onClick={() => closeJob(j.id)} className="px-3 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50">
                        Close
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 sm:my-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-bold text-gray-800">{editTarget ? 'Edit Job' : 'Post a Job'}</h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {[
                { label: 'Job Title', key: 'title', placeholder: 'e.g. Software Engineer' },
                { label: 'Company', key: 'company', placeholder: 'e.g. TechCorp Philippines' },
                { label: 'Location', key: 'location', placeholder: 'e.g. Dumaguete City / Remote' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                    placeholder={f.placeholder} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                </div>
              ))}
              <div className={`grid grid-cols-1 gap-3 ${role === 'faculty' && department ? '' : 'sm:grid-cols-2'}`}>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Job Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value as Job['type']}))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                    {['Full-time','Part-time','Remote','Contract','Internship'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                {!(role === 'faculty' && department) && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Department</label>
                    {department ? (
                      <input value={department} readOnly className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-500" />
                    ) : (
                      <select value={form.department} onChange={e => setForm(p => ({...p, department: e.target.value}))}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                        {['All','CSE','CTHM','BAA'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Requirements</label>
                <textarea value={form.requirements} onChange={e => setForm(p => ({...p, requirements: e.target.value}))} rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none" placeholder="Degree required, years of experience, skills..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Company / Application Link <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="url" value={form.applyLink} onChange={e => setForm(p => ({...p, applyLink: e.target.value}))}
                  placeholder="https://company.com/careers/apply" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                <p className="text-xs text-gray-400 mt-1">If provided, "Apply Now" will send applicants straight to this link instead of email.</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-4 border-t flex-shrink-0">
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                {editTarget ? 'Save Changes' : 'Post Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
