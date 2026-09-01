import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../AuthContext';

import { Users, TrendingUp, DollarSign, X, Eye, Trash2, CheckCircle, Plus, XCircle, Clock, Zap, Archive, Pencil } from 'lucide-react';
import { useNotifications } from './NotificationContext';
import { useDonations, getCampaignPhase, CampaignPhase, Campaign } from './DonationContext';
import CampaignFormModal, { NewCampaignInput } from './CampaignFormModal';
import DonorListModal from './DonorListModal';

// ================= [SHARED: DONATIONMANAGEMENTVIEW] =================
// The full Donation Management screen (Campaigns/Transactions tabs,
// progress bars, donor lists, expense logging, the works), shared
// verbatim between the admin page (admin/DonationManagement.tsx) and
// the faculty page (faculty/FacultyDonationMonitor.tsx) — one
// implementation so a feature added here reaches both roles instead of
// two copies silently drifting apart.
//
// `department` is the ONLY behavioral difference between the two:
//   - omitted (admin): sees/manages every department's campaigns and
//     donations, unrestricted — same as before this was split out.
//   - set (faculty): every list, stat, and filter below is scoped to
//     just that department, campaigns are always created/edited locked
//     to it (via CampaignFormModal's lockDepartment), and the
//     cross-department filter chips are hidden since there's nothing
//     for them to filter. This is a UI convenience only — the real
//     boundary is enforced at the database via RLS (writes: see
//     supabase/faculty_campaign_department_scope.sql; reads, plus the
//     same department scoping for alumni/representative viewers on the
//     donor-facing screens: supabase/donation_campaigns_scoped_rls.sql),
//     so a faculty account can't reach another department's data even
//     by bypassing this screen.
//
// Tabs: Campaigns (default) → Transactions. Scheduled campaigns live
// inside the Campaigns tab as the "Scheduled" sub-filter (see
// CAMPAIGN_SUB_FILTERS below) rather than as their own top-level tab.
// Tab selection is mirrored into the `?tab=` query param so old
// sidebar links can still land on a specific tab.

const CAMPAIGN_SUB_FILTERS: CampaignPhase[] = ['Active', 'Scheduled', 'History'];

// Progress bar fill color: blue while there's still a way to go, yellow once
// it's nearly funded, green once the goal is fully met (or exceeded).
function getProgressColor(raised: number, goal: number): string {
  if (!goal || goal <= 0) return 'bg-blue-500';
  const pct = (raised / goal) * 100;
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 75) return 'bg-yellow-500';
  return 'bg-blue-500';
}

const statusConfig = {
  Pending:  { color: 'bg-orange-100 text-orange-700', icon: <Clock className="w-3.5 h-3.5" /> },
  Verified: { color: 'bg-green-100 text-green-700',   icon: <CheckCircle className="w-3.5 h-3.5" /> },
  Rejected: { color: 'bg-red-100 text-red-700',       icon: <XCircle className="w-3.5 h-3.5" /> },
};

// DB/type value stays 'Verified' for backward compatibility — only the
// text shown to admins/donors changes to "Confirmed".
const STATUS_LABELS: Record<string, string> = { All: 'All', Pending: 'Pending', Verified: 'Confirmed', Rejected: 'Rejected' };

const TAB_TO_PARAM: Record<'campaigns' | 'transactions', string> = {
  campaigns: 'campaigns', transactions: 'transactions',
};
const PARAM_TO_TAB: Record<string, 'campaigns' | 'transactions'> = {
  campaigns: 'campaigns', transactions: 'transactions',
};

interface Props {
  // Faculty pass their own department here to lock the whole screen to
  // it; admin renders this with no department at all.
  department?: string;
}

export default function DonationManagementView({ department }: Props) {
  const { user } = useAuth();
  const { donations, campaigns, expenses, verifyDonation, rejectDonation, addCampaign, updateCampaign, releaseCampaignNow, endCampaign, deleteCampaign, deleteDonation, getProofUrl } = useDonations();
  const { trigger } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = PARAM_TO_TAB[searchParams.get('tab') || ''] || 'campaigns';
  const setTab = (t: 'campaigns' | 'transactions') => {
    setSearchParams(t === 'campaigns' ? {} : { tab: TAB_TO_PARAM[t] }, { replace: false });
  };
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [campaignPhaseFilter, setCampaignPhaseFilter] = useState<CampaignPhase>('Active');
  const [viewProof, setViewProof] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; donorId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editCampaignTarget, setEditCampaignTarget] = useState<Campaign | null>(null);
  const [releaseNowTarget, setReleaseNowTarget] = useState<{ id: string; name: string } | null>(null);
  const [endCampaignTarget, setEndCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteDonationTarget, setDeleteDonationTarget] = useState<string | null>(null);
  const [viewDonationsCampaign, setViewDonationsCampaign] = useState<Campaign | null>(null);
  const [donorListCampaign, setDonorListCampaign] = useState<Campaign | null>(null);

  const actorFallback = department ? 'Faculty' : 'Admin';

  // The one place department-scoping actually happens — everything below
  // reads from these instead of the raw context arrays, so a faculty
  // account never even sees another department's row to begin with.
  // Campaigns additionally include department: 'All' (college-wide)
  // ones — those are visible to every department's faculty by design,
  // so a strict equality-only filter would hide every college-wide
  // campaign (which is most of them) from every faculty account.
  const scopedCampaigns = department ? campaigns.filter(c => c.department === department || c.department === 'All') : campaigns;
  const scopedDonations = department ? donations.filter(d => d.department === department) : donations;

  const filtered = scopedDonations.filter(d => {
    const matchStatus = filterStatus === 'All' || d.status === filterStatus;
    const matchDept = filterDept === 'All' || d.department === filterDept;
    return matchStatus && matchDept;
  });

  const filteredCampaigns = scopedCampaigns.filter(c => getCampaignPhase(c) === campaignPhaseFilter);

  const pending = scopedDonations.filter(d => d.status === 'Pending').length;
  const totalVerified = scopedDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);

  const handleVerify = (donation: (typeof donations)[number]) => {
    verifyDonation(donation.id, user?.name || actorFallback);
    trigger({
      title: 'Donation Verified',
      message: `Your donation of ₱${donation.amount.toLocaleString()} to ${donation.campaign} has been verified. Thank you for your support!`,
      type: 'success',
      targetUserId: donation.donorId,
    });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectDonation(rejectTarget.id, rejectReason, user?.name || actorFallback);
    trigger({
      title: 'Donation Update',
      message: rejectReason
        ? `Your donation submission was not approved: ${rejectReason}`
        : 'Your donation submission needs attention. Please check your donation history.',
      type: 'warning',
      targetUserId: rejectTarget.donorId,
    });
    setRejectTarget(null); setRejectReason('');
  };

  const handleViewProof = async (path: string | null) => {
    if (!path) return;
    const url = await getProofUrl(path);
    if (url) setViewProof(url);
  };

  const handleAddCampaign = (input: NewCampaignInput) => {
    addCampaign(input);
    setShowCampaignForm(false);
  };

  const handleEditCampaign = (input: NewCampaignInput) => {
    if (!editCampaignTarget) return;
    updateCampaign(editCampaignTarget.id, input);
    setEditCampaignTarget(null);
  };

  const handleReleaseNow = () => {
    if (!releaseNowTarget) return;
    releaseCampaignNow(releaseNowTarget.id);
    setReleaseNowTarget(null);
  };

  const handleEndCampaign = () => {
    if (!endCampaignTarget) return;
    endCampaign(endCampaignTarget.id);
    setEndCampaignTarget(null);
  };

  const handleDeleteCampaign = () => {
    if (!deleteCampaignTarget) return;
    deleteCampaign(deleteCampaignTarget.id);
    setDeleteCampaignTarget(null);
  };

  const handleDeleteDonation = () => {
    if (!deleteDonationTarget) return;
    deleteDonation(deleteDonationTarget);
    setDeleteDonationTarget(null);
  };

  const transactionHeaders = department
    ? ['Donor', 'Campaign', 'Amount', 'Type', 'Submitted', 'Status', 'Proof', 'Actions']
    : ['Donor', 'Dept', 'Campaign', 'Amount', 'Type', 'Submitted', 'Status', 'Proof', 'Actions'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{department ? 'Donation Center' : 'Donation Management'}</h2>
          <p className="text-sm text-gray-500">
            {department
              ? <>Manage campaigns and verify transactions for the <strong>{department}</strong> department</>
              : 'Manage campaigns, verify transactions, and generate reports'}
          </p>
        </div>
        {tab === 'campaigns' && (
          <button onClick={() => setShowCampaignForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      {department && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-amber-600">🔒</span>
          <p className="text-xs text-amber-700 font-medium">
            You can only view/verify donations and create/manage campaigns for <strong>{department}</strong>. Other departments and admin payment settings are out of reach — enforced by database policy, not just this screen.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Received', value: `₱${totalVerified.toLocaleString()}`, color: '#059669', icon: <DollarSign className="w-5 h-5" /> },
          { label: 'Pending Verification', value: pending, color: '#d97706', icon: <Clock className="w-5 h-5" /> },
          { label: 'Active Campaigns', value: scopedCampaigns.filter(c => getCampaignPhase(c) === 'Active').length, color: '#2B5BA8', icon: <TrendingUp className="w-5 h-5" /> },
          { label: 'Total Donors', value: new Set(scopedDonations.map(d => d.alumniEmail)).size, color: '#7c3aed', icon: <Users className="w-5 h-5" /> },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'campaigns' as const, label: 'Campaigns' },
          { key: 'transactions' as const, label: 'Transactions' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <div className="space-y-4">
          {pending > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-orange-800">{pending} donation{pending > 1 ? 's' : ''} pending verification — review proof of payment below.</p>
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            {['All','Pending','Verified','Rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterStatus === s ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={filterStatus === s ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            {!department && (
              <>
                <div className="w-px bg-gray-200 mx-1" />
                {['All','CSE','CTHM','BAA'].map(d => (
                  <button key={d} onClick={() => setFilterDept(d)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterDept === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><DollarSign className="w-7 h-7 text-gray-300" /></div>
                <p className="font-semibold text-gray-500">No transactions found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{transactionHeaders.map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{d.alumniName}</p>
                          <p className="text-xs text-gray-400">{d.alumniEmail}</p>
                        </td>
                        {!department && (
                          <td className="px-4 py-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{d.department}</span></td>
                        )}
                        <td className="px-4 py-3 text-gray-600 text-xs">{d.campaign}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">₱{d.amount.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{d.type}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{d.submittedAt}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold w-fit ${statusConfig[d.status].color}`}>
                            {statusConfig[d.status].icon} {STATUS_LABELS[d.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {d.proofUrl ? (
                            <button onClick={() => handleViewProof(d.proofUrl)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          ) : <span className="text-xs text-gray-400">N/A</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {d.status === 'Pending' && (
                              <>
                                <button onClick={() => handleVerify(d)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => setRejectTarget({ id: d.id, donorId: d.donorId })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><XCircle className="w-4 h-4" /></button>
                              </>
                            )}
                            <button onClick={() => setDeleteDonationTarget(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {CAMPAIGN_SUB_FILTERS.map(f => (
                <button key={f} onClick={() => setCampaignPhaseFilter(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${campaignPhaseFilter === f ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><TrendingUp className="w-7 h-7 text-gray-300" /></div>
              <p className="font-semibold text-gray-500">{scopedCampaigns.length === 0 ? 'No campaigns yet' : `No ${campaignPhaseFilter.toLowerCase()} campaigns`}</p>
              <p className="text-sm text-gray-400 mt-1">{scopedCampaigns.length === 0 ? 'Create your first fundraising campaign.' : 'Try a different filter or date range.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Campaign','Raised','Goal','Progress','Event Start','Posted','Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCampaigns.map(c => {
                    const phase = getCampaignPhase(c);
                    const pct = Math.min((c.current / c.target) * 100, 100);
                    const campaignExpenses = expenses.filter(e => e.campaignId === c.id);
                    const spent = campaignExpenses.reduce((s, e) => s + e.amount, 0);
                    const remaining = c.current - spent;
                    return (
                      <tr key={c.id} onClick={() => setDonorListCampaign(c)} className={`hover:bg-gray-50 transition-colors cursor-pointer ${phase !== 'Active' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 hover:text-blue-600 hover:underline">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">₱{c.current.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-600">₱{c.target.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">Spent ₱{spent.toLocaleString()} · Left ₱{remaining.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3 min-w-[120px]">
                          <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                            <div className={`h-2 rounded-full ${getProgressColor(c.current, c.target)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600">{pct.toFixed(0)}% funded</span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {c.eventStartDate ? (() => {
                            const days = Math.ceil((new Date(`${c.eventStartDate}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                            return (
                              <>
                                <p className="text-gray-500">{new Date(`${c.eventStartDate}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })}</p>
                                <p className={`font-semibold ${days > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''}
                                </p>
                              </>
                            );
                          })() : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(c.postedDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {phase === 'Scheduled' && (
                              <button
                                onClick={() => setReleaseNowTarget({ id: c.id, name: c.name })}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors text-xs font-semibold"
                                title="Release now"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {phase !== 'History' && (
                              <button
                                onClick={() => setEditCampaignTarget(c)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-colors text-xs font-semibold"
                                title="Edit campaign"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {phase === 'Active' && (
                              <button
                                onClick={() => setEndCampaignTarget({ id: c.id, name: c.name })}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-colors text-xs font-semibold"
                                title="End campaign"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {phase === 'History' && (
                              <button
                                onClick={() => setDonorListCampaign(c)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-colors text-xs font-semibold"
                                title="View campaign"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {phase === 'History' && (
                              <button
                                onClick={() => setDeleteCampaignTarget({ id: c.id, name: c.name })}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-xs font-semibold"
                                title="Delete campaign"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Proof viewer — capped to the viewport (max-h-[80vh]) with
          object-contain so a tall/large uploaded proof scales down to fit
          instead of overflowing past the screen edges. */}
      {viewProof && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewProof(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewProof(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={viewProof} alt="Proof" className="max-w-full max-h-[80vh] w-auto h-auto mx-auto block rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Reject Donation</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason (optional)..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete campaign confirm */}
      {deleteCampaignTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Delete Campaign</h3>
            <p className="text-sm text-gray-500">
              Delete <span className="font-semibold text-gray-700">"{deleteCampaignTarget.name}"</span>? It moves to History and stops accepting new donations, but its records, donations, and expenses are kept. This can't be undone from the UI.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteCampaignTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleDeleteCampaign} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Release now confirm */}
      {releaseNowTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Release Campaign Now</h3>
            <p className="text-sm text-gray-500">
              Publish <span className="font-semibold text-gray-700">"{releaseNowTarget.name}"</span> immediately? It will become visible to alumni right away, ahead of its scheduled release time.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setReleaseNowTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleReleaseNow} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>Release Now</button>
            </div>
          </div>
        </div>
      )}

      {/* End campaign confirm */}
      {endCampaignTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">End Campaign</h3>
            <p className="text-sm text-gray-500">
              End <span className="font-semibold text-gray-700">"{endCampaignTarget.name}"</span>? It moves to History and stops accepting new donations, but its records, donations, and expenses are kept. This can't be undone from the UI.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setEndCampaignTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleEndCampaign} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gray-600 hover:bg-gray-700">End Campaign</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete donation confirm */}
      {deleteDonationTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Delete Transaction</h3>
            <p className="text-sm text-gray-500">This will permanently remove this donation record. This can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDonationTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleDeleteDonation} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* View donations for a campaign — currently unreachable (no button
          triggers it since DonorListModal replaced it as the click target
          for a campaign row); left in place rather than deleted in case a
          future entry point wants a lighter-weight "all donations, any
          status" view alongside the verified-only DonorListModal. */}
      {viewDonationsCampaign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">Campaign Donations</h3>
                  <p className="text-xs text-gray-400">{viewDonationsCampaign.name}</p>
                </div>
                <button onClick={() => setViewDonationsCampaign(null)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                <span><span className="font-semibold text-gray-500">Event Start:</span>{' '}
                  <span className="text-gray-600">{viewDonationsCampaign.eventStartDate || '—'}</span>
                </span>
                <span><span className="font-semibold text-gray-500">Posted:</span>{' '}
                  <span className="text-gray-600">{new Date(viewDonationsCampaign.postedDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
                <span><span className="font-semibold text-gray-500">Releases On:</span>{' '}
                  <span className="text-gray-600">{viewDonationsCampaign.releaseDate ? new Date(viewDonationsCampaign.releaseDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                </span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {(() => {
                const campaignDonations = scopedDonations.filter(d => d.campaign === viewDonationsCampaign.name);
                if (campaignDonations.length === 0) {
                  return (
                    <div className="flex flex-col items-center py-14 text-center">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><DollarSign className="w-7 h-7 text-gray-300" /></div>
                      <p className="font-semibold text-gray-500">No donations for this campaign yet</p>
                    </div>
                  );
                }
                return (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr>{['Donor','Amount','Type','Submitted','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {campaignDonations.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-800">{d.alumniName}</p>
                            <p className="text-xs text-gray-400">{d.alumniEmail}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-800">₱{d.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{d.type}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{d.submittedAt}</td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold w-fit ${statusConfig[d.status].color}`}>
                              {statusConfig[d.status].icon} {STATUS_LABELS[d.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0">
              <button onClick={() => setViewDonationsCampaign(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Donor list for a campaign — opened by clicking the campaign name/row */}
      {donorListCampaign && (
        <DonorListModal campaign={donorListCampaign} onClose={() => setDonorListCampaign(null)} />
      )}

      {/* New campaign form — locked to `department` for faculty; admin
          campaigns stay college-wide ("All") when department is unset. */}
      {showCampaignForm && (
        <CampaignFormModal onClose={() => setShowCampaignForm(false)} onSubmit={handleAddCampaign} lockDepartment={department} />
      )}

      {/* Edit campaign form — department stays whatever it already was (no picker to change it) */}
      {editCampaignTarget && (
        <CampaignFormModal onClose={() => setEditCampaignTarget(null)} onSubmit={handleEditCampaign} initial={editCampaignTarget} lockDepartment={department} />
      )}
    </div>
  );
}
