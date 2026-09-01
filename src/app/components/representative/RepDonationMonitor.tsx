import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { DollarSign, CheckCircle, Clock, AlertCircle, TrendingUp, Heart, Building2, Upload, Image, Copy, Check, Wallet, CreditCard, X, ChevronRight } from 'lucide-react';
import { useDonations, isCampaignLive, type Campaign } from '../shared/DonationContext';
import { useNotifications } from '../shared/NotificationContext';
import CurrencyAmountField from '../shared/CurrencyAmountField';
import DonorListModal from '../shared/DonorListModal';

// ================= [BATCH REPRESENTATIVE: REPDONATIONMONITOR] =================
// Batch reps get the same "make a donation" flow alumni get (they're alumni
// too), PLUS a read-only monitoring view of their whole batch's giving.

const statusConfig = {
  Pending:  { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending Verification' },
  Verified: { color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Confirmed' },
  Rejected: { color: 'bg-red-100 text-red-700 border-red-200',        icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Rejected' },
};

const referenceNo = (id: string) => `DON-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export default function RepDonationMonitor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { donations, campaigns, paymentDestinations, submitDonation, getProofUrl } = useDonations();
  const { trigger } = useNotifications();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ campaign: '', amount: '', description: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);
  const [copiedDestId, setCopiedDestId] = useState<string | null>(null);
  const [donorListCampaign, setDonorListCampaign] = useState<Campaign | null>(null);

  const activeDestinations = paymentDestinations.filter(d => d.isActive);
  const destTypeIcon = (type: string) => type === 'Bank' ? <Building2 className="w-4 h-4 text-gray-500" /> : type === 'E-Wallet' ? <Wallet className="w-4 h-4 text-gray-500" /> : <CreditCard className="w-4 h-4 text-gray-500" />;

  const copyAccountNumber = (id: string, accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber).then(() => {
      setCopiedDestId(id);
      setTimeout(() => setCopiedDestId(prev => (prev === id ? null : prev)), 2000);
    });
  };

  // My own donations (the rep giving personally)
  const myDonations = donations.filter(d => d.alumniEmail === user?.email || d.alumniName === user?.name);
  const myTotalVerified = myDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);
  const myPendingCount = myDonations.filter(d => d.status === 'Pending').length;

  // Whole-batch donations (monitoring — dept-scoped, read-only)
  const batchDonations = donations.filter(d => d.department === user?.assignedDepartment);
  const batchTotal = batchDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);
  const batchPending = batchDonations.filter(d => d.status === 'Pending').length;

  useEffect(() => {
    const missing = myDonations.filter(d => d.proofUrl && !proofUrls[d.id]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(missing.map(async d => [d.id, await getProofUrl(d.proofUrl as string)] as const));
      setProofUrls(prev => {
        const next = { ...prev };
        entries.forEach(([id, url]) => { if (url) next[id] = url; });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDonations]);

  const handleProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFileName(file.name);
    setProofFile(file);
  };

  const handleSubmit = async () => {
    if (!form.campaign || !form.amount || !proofFile) return;
    setSubmitting(true);
    await submitDonation({
      alumniName: user?.name || 'Batch Representative',
      alumniEmail: user?.email || '',
      department: user?.assignedDepartment || 'All',
      campaign: form.campaign || 'General Fund',
      amount: parseFloat(form.amount) || 0,
      type: 'Cash',
      description: form.description,
    }, proofFile);
    trigger({
      title: 'Donation Submitted',
      message: `A new donation from ${user?.name || 'a batch representative'} is pending verification.`,
      type: 'info',
      targetRole: 'admin',
    });
    trigger({
      title: 'Donation Submitted',
      message: `A new donation from ${user?.name || 'a batch representative'} is pending verification.`,
      type: 'info',
      targetRole: 'faculty',
      targetDept: user?.assignedDepartment,
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ campaign: '', amount: '', description: '' });
    setProofFile(null); setProofFileName('');
    setSelectedDestId(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Donation Center</h2>
          <p className="text-sm text-gray-500">Give to your alma mater, and monitor giving from <strong>Batch {user?.assignedBatchYear} {user?.assignedDepartment}</strong></p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
          <Heart className="w-4 h-4" /> Make a Donation
        </button>
      </div>

      {/* Link to the Fund Transparency page — same page alumni get */}
      <button onClick={() => navigate('/representative/donations/transparency')}
        className="w-full flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-left hover:border-blue-200 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-gray-800">Fund Transparency</p>
            <p className="text-xs text-gray-500">See exactly where every donated peso went, campaign by campaign.</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </button>

      {/* Submission success toast */}
      {submitted && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">Donation Submitted!</p>
            <p className="text-xs text-green-600">Your proof of payment is under review. You'll be notified once it's verified.</p>
          </div>
        </div>
      )}

      {/* My own donation stats */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">My Donations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Donated', value: `₱${myTotalVerified.toLocaleString()}`, sub: 'Confirmed contributions', icon: <DollarSign className="w-5 h-5" />, color: '#059669' },
            { label: 'Transactions', value: myDonations.length, sub: 'All time', icon: <TrendingUp className="w-5 h-5" />, color: '#2B5BA8' },
            { label: 'Pending', value: myPendingCount, sub: 'Awaiting verification', icon: <Clock className="w-5 h-5" />, color: '#d97706' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{s.label}</span>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {myDonations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Date','Amount','Status','Reference No','Proof'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myDonations.map(d => {
                  const cfg = statusConfig[d.status];
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-4 py-3 text-xs text-gray-500">{d.submittedAt}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">₱{d.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{d.campaign}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border w-fit ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{referenceNo(d.id)}</td>
                      <td className="px-4 py-3">
                        {d.proofUrl && proofUrls[d.id] ? (
                          <img src={proofUrls[d.id]} alt="proof" className="w-10 h-10 object-cover rounded-lg border border-gray-200" />
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch monitoring — read only */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">Batch {user?.assignedBatchYear} {user?.assignedDepartment} — All Donations</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-3">
          <span className="text-amber-600">👁️</span>
          <p className="text-xs text-amber-700 font-medium">You have <strong>monitoring access only</strong> over your batch's donations. Verification is handled by Admin and Faculty.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total Verified', value: `₱${batchTotal.toLocaleString()}`, color: '#059669', icon: <CheckCircle className="w-5 h-5" /> },
            { label: 'Pending Review', value: batchPending, color: '#d97706', icon: <Clock className="w-5 h-5" /> },
            { label: 'Total Donors', value: new Set(batchDonations.map(d => d.alumniEmail)).size, color: '#2B5BA8', icon: <TrendingUp className="w-5 h-5" /> },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
              <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500">{s.label}</span><span style={{ color: s.color }}>{s.icon}</span></div>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {batchDonations.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <DollarSign className="w-7 h-7 text-gray-300" />
              </div>
              <h3 className="font-semibold text-gray-500 mb-1">No Donations Yet</h3>
              <p className="text-sm text-gray-400 max-w-xs">No alumni from Batch {user?.assignedBatchYear} {user?.assignedDepartment} have submitted donations yet. Encourage your batch to contribute!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Donor','Campaign','Amount','Type','Date','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batchDonations.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{d.alumniName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{d.campaign}</td>
                      <td className="px-4 py-3 font-bold">₱{d.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{d.type}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{d.submittedAt}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          d.status === 'Verified' ? 'bg-green-100 text-green-700' :
                          d.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Active campaigns */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3">Active Campaigns</h3>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold text-right">Raised</th>
                <th className="px-4 py-3 font-semibold text-right">Goal</th>
                <th className="px-4 py-3 font-semibold w-32">Progress</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.filter(isCampaignLive).map(c => {
                const pct = Math.min((c.current / c.target) * 100, 100);
                return (
                  <tr key={c.id} onClick={() => setDonorListCampaign(c)} className="border-b border-gray-50 last:border-0 align-top hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-800 hover:text-blue-600 hover:underline">{c.name}</p>
                      <p className="text-xs text-gray-500 max-w-xs truncate">{c.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">₱{c.current.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">₱{c.target.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-1">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1B3A6B,#2B5BA8)' }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600">{pct.toFixed(0)}% funded</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setForm(f => ({...f, campaign: c.name})); setShowForm(true); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap">
                        Donate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Donor list for a campaign — opened by clicking the campaign name/row, same as admin's Campaigns table */}
      {donorListCampaign && (
        <DonorListModal campaign={donorListCampaign} onClose={() => setDonorListCampaign(null)} />
      )}

      {/* Donation form modal — identical flow to the alumni portal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h3 className="font-bold text-gray-800">Make a Donation</h3>
              <button onClick={() => { setShowForm(false); setProofFile(null); setProofFileName(''); setSelectedDestId(null); }}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Campaign</label>
                <select value={form.campaign} onChange={e => setForm(f => ({...f, campaign: e.target.value}))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400">
                  <option value="">Select a campaign</option>
                  {campaigns.filter(isCampaignLive).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="General Fund">General Fund</option>
                </select>
              </div>

              <CurrencyAmountField
                label="Amount"
                currencySymbol="₱"
                required
                value={form.amount}
                onChange={amount => setForm(f => ({ ...f, amount }))}
              />

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Pay To</label>
                {activeDestinations.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-3">No payment destinations are configured yet. Please contact the alumni office.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDestinations.map(d => (
                      <div key={d.id} role="button" tabIndex={0} onClick={() => setSelectedDestId(d.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedDestId(d.id); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left cursor-pointer transition-colors ${selectedDestId === d.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        {d.qrCodeUrl ? (
                          <img src={d.qrCodeUrl} alt={`${d.providerName} QR`} className="w-11 h-11 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">{destTypeIcon(d.type)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-800 truncate">{d.providerName}</p>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{d.type}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{d.accountName}</p>
                          <p className="text-xs font-mono text-gray-700">{d.accountNumber}</p>
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); copyAccountNumber(d.id, d.accountNumber); }}
                          className={`flex items-center gap-1 flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${copiedDestId === d.id ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                          {copiedDestId === d.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-orange-600 font-semibold mt-2">⚠️ Upload your receipt/screenshot below after payment.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Proof of Payment <span className="text-red-500">*</span></label>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  {proofFile ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Image className="w-5 h-5" />
                      <span className="text-sm font-semibold">{proofFileName}</span>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-gray-400" />
                      <span className="text-sm text-gray-500">Click to upload receipt/screenshot</span>
                      <span className="text-xs text-gray-400">JPG, PNG supported</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleProof} />
                </label>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0">
              <button onClick={() => { setShowForm(false); setProofFile(null); setProofFileName(''); setSelectedDestId(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit}
                disabled={submitting || !form.campaign || !form.amount || !proofFile}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                {submitting ? 'Submitting…' : 'Submit Donation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
