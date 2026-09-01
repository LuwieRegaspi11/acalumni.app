import { useState } from 'react';
import { Megaphone, Pin, Plus, Edit, Trash2, X } from 'lucide-react';
import { useAnnouncements, Announcement } from './AnnouncementContext';

// ================= [SHARED: ANNOUNCEMENT BOARD — connected to Supabase] =================

const CATEGORIES = ['General', 'Event Reminder', 'Donation Drive', 'Survey Deadline', 'University Update'];
const DEPARTMENTS = ['All Alumni', 'CSE', 'CTHM', 'BAA'];

const categoryColors: Record<string, string> = {
  'General': 'bg-gray-100 text-gray-700',
  'Event Reminder': 'bg-blue-100 text-blue-700',
  'Donation Drive': 'bg-green-100 text-green-700',
  'Survey Deadline': 'bg-orange-100 text-orange-700',
  'University Update': 'bg-purple-100 text-purple-700',
};

type ViewerRole = 'admin' | 'faculty' | 'representative' | 'alumni';

interface Props {
  role: ViewerRole;
  department?: string;
}

export default function AnnouncementBoard({ role, department }: Props) {
  const { announcements, addAnnouncement, updateAnnouncement, togglePin, deleteAnnouncement } = useAnnouncements();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'General', targetDept: department || 'All Alumni' });
  const [filterDept, setFilterDept] = useState('All Alumni');

  const canPost = role === 'admin' || role === 'faculty';
  const canManage = (a: Announcement) => role === 'admin' || (role === 'faculty' && a.authorRole === 'faculty' && a.targetDept === department);

  const visible = announcements.filter(a => {
    const matchAudience = a.targetDept === 'All Alumni' || !department || a.targetDept === department;
    const matchFilter = filterDept === 'All Alumni' || a.targetDept === 'All Alumni' || a.targetDept === filterDept;
    return matchAudience && matchFilter;
  });

  const pinned = visible.filter(a => a.pinned);
  const rest = visible.filter(a => !a.pinned);

  const handleSave = async () => {
    const targetDept = role === 'faculty' && department ? department : form.targetDept;
    if (editTarget) {
      await updateAnnouncement(editTarget.id, { ...form, targetDept });
    } else {
      await addAnnouncement({ ...form, targetDept });
    }
    setShowForm(false); setEditTarget(null);
    setForm({ title: '', content: '', category: 'General', targetDept: department || 'All Alumni' });
  };

  const openEdit = (a: Announcement) => { setEditTarget(a); setForm({ title: a.title, content: a.content, category: a.category, targetDept: a.targetDept }); setShowForm(true); };

  const Card = ({ a }: { a: Announcement }) => (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${a.pinned ? 'border-blue-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {a.pinned && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><Pin className="w-2.5 h-2.5" />Pinned</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${categoryColors[a.category] || 'bg-gray-100 text-gray-700'}`}>{a.category}</span>
            {a.targetDept !== 'All Alumni' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{a.targetDept}</span>}
          </div>
          <h4 className="font-bold text-gray-800 mb-1">{a.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-3">{a.content}</p>
          <p className="text-xs text-gray-400 mt-2">{a.date} \u00b7 Posted by {a.author}</p>
        </div>
        {canManage(a) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => togglePin(a.id, a.pinned)} className={`p-1.5 rounded-lg transition-colors ${a.pinned ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}><Pin className="w-4 h-4" /></button>
            <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"><Edit className="w-4 h-4" /></button>
            <button onClick={() => deleteAnnouncement(a.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Announcement Board</h2>
          <p className="text-sm text-gray-500">
            {canPost ? (role === 'faculty' ? `Post announcements for ${department} department` : 'Manage announcements for all alumni') : 'Stay updated with the latest news and announcements'}
          </p>
        </div>
        {canPost && (
          <button onClick={() => { setEditTarget(null); setForm({ title: '', content: '', category: 'General', targetDept: department || 'All Alumni' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            <Plus className="w-4 h-4" /> Post Announcement
          </button>
        )}
      </div>

      {role !== 'faculty' && (
        <div className="flex gap-2 flex-wrap">
          {DEPARTMENTS.map(d => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterDept === d ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={filterDept === d ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
              {d}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-500 mb-1">No Announcements Yet</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            {canPost ? 'Post the first announcement to keep your community informed.' : 'Check back later for updates from the alumni office.'}
          </p>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Pin className="w-3 h-3" />Pinned</h3>
              {pinned.map(a => <Card key={a.id} a={a} />)}
            </div>
          )}
          <div className="space-y-3">
            {rest.length > 0 && <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Megaphone className="w-3 h-3" />All Announcements</h3>}
            {rest.map(a => <Card key={a.id} a={a} />)}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800">{editTarget ? 'Edit Announcement' : 'Post Announcement'}</h3>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" placeholder="Announcement title" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Content</label>
                <textarea value={form.content} onChange={e => setForm(f => ({...f, content: e.target.value}))} rows={4}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none" placeholder="Write your announcement..." />
              </div>
              <div className={`grid grid-cols-1 gap-3 ${role === 'faculty' && department ? '' : 'sm:grid-cols-2'}`}>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {!(role === 'faculty' && department) && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Target Department</label>
                    <select value={form.targetDept} onChange={e => setForm(f => ({...f, targetDept: e.target.value}))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={!form.title || !form.content}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                {editTarget ? 'Save Changes' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
