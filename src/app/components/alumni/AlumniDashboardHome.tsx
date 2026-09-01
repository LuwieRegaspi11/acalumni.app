import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { DollarSign, Calendar, Megaphone, FileText, Briefcase, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useDonations } from '../shared/DonationContext';
import { useEvents } from '../shared/EventsContext';

// ================= [ALUMNI: ALUMNIDASHBOARDHOME] =================

export default function AlumniDashboardHome() {
  const { user } = useAuth();
  const { donations } = useDonations();
  const { events } = useEvents();
  const navigate = useNavigate();

  const myDonations = donations.filter(d => d.alumniName === user?.name);
  const totalDonated = myDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);
  const pendingDonations = myDonations.filter(d => d.status === 'Pending').length;
  const upcomingEvents = events.filter(e => e.status === 'Upcoming').slice(0, 3);

  const quickLinks = [
    { label: 'Tracer Survey', desc: 'Complete your employment survey', icon: <FileText className="w-5 h-5" />, path: 'surveys', color: '#2B5BA8' },
    { label: 'Make a Donation', desc: 'Support your alma mater', icon: <DollarSign className="w-5 h-5" />, path: 'donations', color: '#059669' },
    { label: 'View Events', desc: 'Browse upcoming alumni events', icon: <Calendar className="w-5 h-5" />, path: 'events', color: '#7c3aed' },
    { label: 'Job Board', desc: 'Find or suggest job opportunities', icon: <Briefcase className="w-5 h-5" />, path: 'jobs', color: '#d97706' },
    { label: 'Announcements', desc: 'Read the latest updates', icon: <Megaphone className="w-5 h-5" />, path: 'announcements', color: '#0891b2' },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Welcome banner */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2B5BA8 55%, #5B9BD5 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm mb-1">Welcome back,</p>
            <h2 className="text-2xl font-bold mb-1">{user?.name}</h2>
            <p className="text-white/60 text-sm">{user?.program} · Batch {user?.batchYear} · {user?.department}</p>
            <div className="flex items-center gap-2 mt-3">
              {user?.registrationStatus === 'pending' ? (
                <span className="bg-amber-400/20 text-amber-200 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-300 rounded-full" /> Pending Approval
                </span>
              ) : (
                <span className="bg-green-400/20 text-green-300 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Verified Alumni
                </span>
              )}
            </div>
          </div>
          {user?.registrationStatus !== 'pending' && (
            <button
              onClick={() => navigate('donations')}
              className="donate-cta-glow flex-shrink-0 flex items-center justify-center gap-2 bg-white text-[#1B3A6B] font-bold text-2xl px-10 py-5 rounded-xl shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all w-full sm:w-auto"
            >
              <DollarSign className="w-6 h-6" /> Make a Donation
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Donated', value: `₱${totalDonated.toLocaleString()}`, sub: 'Verified', color: '#059669', icon: <DollarSign className="w-5 h-5" /> },
          { label: 'Pending Donations', value: pendingDonations, sub: 'Awaiting review', color: '#d97706', icon: <Clock className="w-5 h-5" /> },
          { label: 'Upcoming Events', value: upcomingEvents.length, sub: 'This month', color: '#2B5BA8', icon: <Calendar className="w-5 h-5" /> },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {quickLinks.map((q, i) => (
            <button key={i} onClick={() => navigate(q.path)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: q.color }}>
                {q.icon}
              </div>
              <p className="font-bold text-gray-800 text-sm">{q.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{q.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Donation status */}
      {myDonations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">My Recent Donations</h3>
            <button onClick={() => navigate('donations')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {myDonations.slice(0, 3).map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{d.campaign}</p>
                  <p className="text-xs text-gray-400">{d.submittedAt} · ₱{d.amount.toLocaleString()}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${
                  d.status === 'Verified' ? 'bg-green-100 text-green-700 border-green-200' :
                  d.status === 'Pending' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  'bg-red-100 text-red-700 border-red-200'}`}>
                  {d.status === 'Verified' ? <CheckCircle className="w-3 h-3" /> : d.status === 'Pending' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Upcoming Events</h3>
            <button onClick={() => navigate('events')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{e.title}</p>
                  <p className="text-xs text-gray-400">{e.date} · {e.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
