import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Heart, Eye, X } from 'lucide-react';
import { useDonations, isCampaignLive } from '../shared/DonationContext';

// =====================================================================
// FUND TRANSPARENCY — its own page (not just a tab) so donors have a
// direct, shareable place to see what happened to their money: total
// raised, total allocated/spent, remaining balance, and an itemized
// breakdown per campaign. Reads the same campaigns/expenses data admin
// logs in Donation Management — nothing separate to wire up. Expense
// rows the admin attached a receipt to get a "View receipt" link,
// resolved to a short-lived signed URL on demand.
// =====================================================================
// `backTo` lets a role other than alumni (e.g. the batch representative,
// who gets this same page reused at /representative/donations/transparency)
// point the back link at its own Donation Center route instead of alumni's.
export default function FundTransparency({ backTo = '/alumni/donations' }: { backTo?: string }) {
  const navigate = useNavigate();
  const { campaigns, donations, expenses, getProofUrl } = useDonations();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const handleViewReceipt = async (id: string, path: string) => {
    setLoadingReceiptId(id);
    const url = await getProofUrl(path);
    setLoadingReceiptId(null);
    if (url) setReceiptUrl(url);
  };

  const totalRaised = campaigns.reduce((s, c) => s + c.current, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRemaining = totalRaised - totalSpent;
  const totalDonors = new Set(donations.filter(d => d.status === 'Verified').map(d => d.alumniEmail)).size;

  return (
    <div className="space-y-6 w-full">
      <div>
        <button onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Donation Center
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Fund Transparency</h2>
        <p className="text-sm text-gray-500">See exactly where every donated peso went — updated live from the alumni office's records.</p>
      </div>

      {/* Site-wide summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Funds Raised', value: `₱${totalRaised.toLocaleString()}`, sub: `From ${totalDonors} donor${totalDonors === 1 ? '' : 's'}`, color: '#059669' },
          { label: 'Total Allocated / Spent', value: `₱${totalSpent.toLocaleString()}`, sub: 'Across all campaigns', color: '#d97706' },
          { label: 'Remaining Balance', value: `₱${totalRemaining.toLocaleString()}`, sub: 'Not yet allocated', color: '#2B5BA8' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
            <span className="text-sm text-gray-500">{s.label}</span>
            <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        This page reflects every campaign's real numbers as logged by the alumni office — updated the moment funds are raised or spent.
      </p>

      {/* Per-campaign breakdown */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><Heart className="w-7 h-7 text-gray-300" /></div>
          <p className="font-semibold text-gray-500">No campaigns yet</p>
        </div>
      ) : (
        <>
          {/* Campaign summary table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Raised</th>
                  <th className="px-4 py-3 font-semibold text-right">Allocated</th>
                  <th className="px-4 py-3 font-semibold text-right">Remaining</th>
                  <th className="px-4 py-3 font-semibold w-32">Progress</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const spent = expenses.filter(e => e.campaignId === c.id).reduce((s, e) => s + e.amount, 0);
                  const remaining = c.current - spent;
                  const spentPct = c.current > 0 ? Math.min((spent / c.current) * 100, 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400 max-w-xs truncate">{c.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${isCampaignLive(c) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{isCampaignLive(c) ? 'Active' : 'Closed'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap">₱{c.current.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 whitespace-nowrap">₱{spent.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600 whitespace-nowrap">₱{remaining.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-amber-400" style={{ width: `${spentPct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Combined expense ledger — every expense across every campaign, one flat scannable table */}
          {(() => {
            const allExpenses = expenses
              .map(e => ({ ...e, campaignName: campaigns.find(c => c.id === e.campaignId)?.name ?? '—' }))
              .sort((a, b) => (a.spentAt < b.spentAt ? 1 : -1));
            return allExpenses.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No expenses logged yet — the full amount raised is still available.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                <p className="text-xs font-semibold text-gray-500 px-4 pt-4">Where the money went</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-3 font-semibold">Campaign</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Receipt</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allExpenses.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{e.campaignName}</td>
                        <td className="px-4 py-2.5 text-gray-700">{e.description}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{e.spentAt}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {e.receiptUrl ? (
                            <button onClick={() => handleViewReceipt(e.id, e.receiptUrl as string)}
                              disabled={loadingReceiptId === e.id}
                              className="flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50">
                              <Eye className="w-3 h-3" /> {loadingReceiptId === e.id ? 'Loading…' : 'View'}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-700 whitespace-nowrap">₱{e.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}

      {/* Receipt viewer */}
      {receiptUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setReceiptUrl(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setReceiptUrl(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={receiptUrl} alt="Expense receipt" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
