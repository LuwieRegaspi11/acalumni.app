import { useState, useEffect } from 'react';
import { Search, CheckCircle, Power, RefreshCw, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

// ================= [ADMIN: USER ACCOUNT MANAGEMENT — connected to Supabase] =================

type Role = 'alumni' | 'faculty' | 'representative' | 'admin';

interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  department: string;
  status: 'Active' | 'Pending' | 'Deactivated';
  joinDate: string;
  lastLogin: string;
}

const roleColors: Record<Role, string> = {
  admin: 'bg-red-100 text-red-700',
  alumni: 'bg-blue-100 text-blue-700',
  faculty: 'bg-green-100 text-green-700',
  representative: 'bg-purple-100 text-purple-700',
};

const statusColors = {
  Active: 'bg-green-100 text-green-700',
  Pending: 'bg-orange-100 text-orange-700',
  Deactivated: 'bg-gray-100 text-gray-500',
};

function mapRow(r: any): UserAccount {
  // Pending approval only applies to alumni registrations — faculty and
  // representative accounts are auto-approved on signup (see
  // handle_new_user() in registration_simplification.sql), so a
  // non-alumni row should never surface as "Pending" here even if its
  // registration_status happens to be stale/pending.
  let status: UserAccount['status'] = 'Active';
  if (r.role === 'alumni' && r.registration_status === 'pending') status = 'Pending';
  else if (r.active === false) status = 'Deactivated';
  return {
    id: r.id,
    name: r.name,
    username: r.username || '',
    email: r.email,
    role: r.role,
    department: r.department || 'All',
    status,
    joinDate: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    lastLogin: r.last_sign_in_at
      ? new Date(r.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Never',
  };
}

export default function UserAccountManagement() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');

  const loadUsers = async () => {
    const { data, error } = await supabase.rpc('admin_list_accounts');
    if (!error) setUsers((data || []).map(mapRow));
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.includes(q);
    const matchRole = filterRole === 'All' || u.role === filterRole;
    const matchStatus = filterStatus === 'All' || u.status === filterStatus;
    return matchQ && matchRole && matchStatus;
  });

  const approve = async (id: string) => {
    await supabase.from('profiles').update({ registration_status: 'approved' }).eq('id', id);
    loadUsers();
  };

  const deactivate = async (id: string, currentStatus: UserAccount['status']) => {
    await supabase.from('profiles').update({ active: currentStatus !== 'Deactivated' ? false : true }).eq('id', id);
    loadUsers();
  };

  const startEditUsername = (u: UserAccount) => { setEditingId(u.id); setEditUsername(u.username); };

  const saveUsername = async (id: string) => {
    await supabase.from('profiles').update({ username: editUsername.trim() || null }).eq('id', id);
    setEditingId(null);
    loadUsers();
  };

  const pending = users.filter(u => u.status === 'Pending').length;
  const active = users.filter(u => u.status === 'Active').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Account Management</h2>
          <p className="text-sm text-gray-500">Approve registrations and manage user accounts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: '#2B5BA8' },
          { label: 'Active', value: active, color: '#059669' },
          { label: 'Pending Approval', value: pending, color: '#d97706' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{loading ? '\u2026' : s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
        </div>
        {[
          { label: 'Role', value: filterRole, set: setFilterRole, opts: ['All', 'admin', 'alumni', 'faculty', 'representative'] },
          { label: 'Status', value: filterStatus, set: setFilterStatus, opts: ['All', 'Active', 'Pending', 'Deactivated'] },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User', 'Username', 'Role', 'Department', 'Status', 'Joined', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No accounts found.</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={editUsername} onChange={e => setEditUsername(e.target.value)}
                          className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400" />
                        <button onClick={() => saveUsername(u.id)} title="Save" className="p-1 rounded hover:bg-green-50 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} title="Cancel" className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-xs text-gray-600">{u.username || '—'}</span>
                        <button onClick={() => startEditUsername(u)} title="Edit username" className="p-1 rounded hover:bg-blue-50 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${roleColors[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.department}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[u.status]}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.joinDate}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.lastLogin}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {u.status === 'Pending' && (
                        <button onClick={() => approve(u.id)} title="Approve" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button disabled title="Reset Password (coming soon)" className="p-1.5 rounded-lg text-blue-600 opacity-40 cursor-not-allowed">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      {u.role !== 'admin' && (
                        <button onClick={() => deactivate(u.id, u.status)} title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition-colors ${u.status === 'Active' ? 'hover:bg-orange-50 text-orange-600' : 'hover:bg-green-50 text-green-600'}`}>
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
