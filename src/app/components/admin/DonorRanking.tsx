import { useEffect, useMemo, useState } from 'react';
import { Trophy, Download, Printer, ShieldCheck, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabaseClient';
import { useDonations } from '../shared/DonationContext';
import { StatuePodium, PodiumPanel } from '../shared/DonorTransparency';
import { SkeletonTableRows } from '../shared/Skeleton';

// =====================================================================
// ADMIN: DONOR RANKING — who has given the most, counting ONLY donations
// the admin has verified. Meant for the Alumni Head to thank donors in
// person at events:
//   * the table shows real names and emails (admin only);
//   * each donor is marked "Can announce" or "Keep anonymous" according to
//     their Show my name / Anonymous choice — so nobody is named out loud
//     against their wishes;
//   * "Print recognition list" produces a sheet safe to read out at an
//     event (anonymous donors appear as "Anonymous");
//   * "Download full list" exports everything, with identities, as Excel.
// Backed by public.admin_donor_ranking() in supabase/donor_ranking.sql.
// =====================================================================

interface RankRow {
  rank: number;
  donorId: string;
  name: string;
  email: string;
  batchYear: number | null;
  program: string | null;
  total: number;
  count: number;
  anonymousCount: number;
  lastDonated: string | null;
  canAnnounce: boolean;
}

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function DonorRanking() {
  const { campaigns } = useDonations();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<string>('all');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    supabase.rpc('admin_donor_ranking', {
      p_year: year === 'all' ? null : Number(year),
      p_campaign_id: campaignId === 'all' ? null : campaignId,
    }).then(({ data, error: err }) => {
      if (!active) return;
      if (err) { setError(err.message); setRows([]); }
      else setRows((data || []).map((r: any) => ({
        rank: Number(r.rank), donorId: r.donor_id, name: r.name, email: r.email || '',
        batchYear: r.batch_year ?? null, program: r.program ?? null,
        total: Number(r.total_amount), count: Number(r.donation_count), anonymousCount: Number(r.anonymous_count),
        lastDonated: r.last_donated || null, canAnnounce: !!r.can_announce,
      })));
      setLoading(false);
    });
    return () => { active = false; };
  }, [year, campaignId]);

  const totalRaised = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
  const scopeLabel = [
    year === 'all' ? 'All time' : year,
    campaignId === 'all' ? 'All campaigns' : (campaigns.find(c => c.id === campaignId)?.name || 'Campaign'),
  ].join(' · ');

  const downloadFull = () => {
    const sheet = XLSX.utils.json_to_sheet(rows.map(r => ({
      Rank: r.rank, Name: r.name, Email: r.email, Program: r.program || '', 'Batch Year': r.batchYear || '',
      'Total Donated (PHP)': r.total, Gifts: r.count,
      'Last Donation': r.lastDonated ? new Date(r.lastDonated).toLocaleDateString() : '',
      'Name Display Choice': r.canAnnounce ? 'Show my name' : 'Anonymous (keep private)',
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Donor Ranking');
    XLSX.writeFile(book, `donor-ranking-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // A clean sheet for reading out at an event: anonymous donors are never named.
  const printRecognition = () => {
    const body = rows.map(r => `<tr><td>${r.rank}</td><td>${r.canAnnounce ? escapeHtml(r.name) : '<i>Anonymous</i>'}</td>
      <td>${r.canAnnounce ? escapeHtml([r.program, r.batchYear ? `Batch ${r.batchYear}` : ''].filter(Boolean).join(' · ')) : ''}</td>
      <td style="text-align:right">${peso(r.total)}</td></tr>`).join('');
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { setError('Allow pop-ups for this site to print the list.'); return; }
    w.document.write(`<!doctype html><html><head><title>Donor Recognition</title><style>
      body{font-family:Arial,sans-serif;margin:40px;color:#111} h1{margin:0 0 4px;color:#1B3A6B} p{margin:0 0 20px;color:#555}
      table{width:100%;border-collapse:collapse} th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left;font-size:14px}
      th{background:#f3f4f6}</style></head><body>
      <h1>Asian College Alumni — Donor Recognition</h1><p>${escapeHtml(scopeLabel)} · verified donations only · thank you for your generosity!</p>
      <table><thead><tr><th>#</th><th>Donor</th><th>Batch</th><th style="text-align:right">Total</th></tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" aria-hidden="true" /> Donor Ranking</h2>
          <p className="text-sm text-gray-500">Top givers by <strong>verified</strong> donations — use it to thank donors at events.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={printRecognition} disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            <Printer className="w-4 h-4" /> Print recognition list
          </button>
          <button onClick={downloadFull} disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download className="w-4 h-4" /> Download full list
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="rank-year" className="text-xs font-semibold text-gray-500 mb-1 block">Period</label>
          <select id="rank-year" value={year} onChange={e => setYear(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400">
            <option value="all">All time</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rank-campaign" className="text-xs font-semibold text-gray-500 mb-1 block">Campaign</label>
          <select id="rank-campaign" value={campaignId} onChange={e => setCampaignId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 max-w-[260px]">
            <option value="all">All campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">{rows.length} donors</p>
          <p className="text-lg font-bold text-emerald-700">{peso(totalRaised)}</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>Only donations you have <strong>verified</strong> are counted. Donors marked <strong>Keep anonymous</strong> chose not to be named — thank them privately, and don't read their name out at events. The printed recognition list already shows them as “Anonymous”.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">{error}</div>}

      {/* The champions: gold, silver and bronze statues on the podium. Donors who
          chose to stay anonymous are shown as "Anonymous" here so this can be
          displayed at an event; their real name is in the table below. */}
      {!loading && rows.length > 0 && (
        <PodiumPanel title="Our Top Donors" subtitle={`${scopeLabel} · thank you for your generosity`}>
          <StatuePodium items={rows.slice(0, 3).map(r => ({
            place: (r.rank <= 3 ? r.rank : 3) as 1 | 2 | 3,
            title: r.canAnnounce ? r.name : 'Anonymous',
            subtitle: r.canAnnounce ? ([r.program, r.batchYear ? `Batch ${r.batchYear}` : null].filter(Boolean).join(' · ')) : 'Anonymous donor',
            amount: r.total,
            note: r.canAnnounce ? undefined : 'Thank privately',
          }))} />
        </PodiumPanel>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['#', 'Donor', 'Batch / Program', 'Total donated', 'Gifts', 'Last gift', 'At events'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <SkeletonTableRows cols={7} rows={5} />}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No verified donations for this selection yet.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.donorId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-bold text-gray-500">{r.rank}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{[r.program, r.batchYear ? `Batch ${r.batchYear}` : null].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">{peso(r.total)}</td>
                <td className="px-4 py-3 text-gray-600">{r.count}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.lastDonated ? new Date(r.lastDonated).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  {r.canAnnounce
                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><ShieldCheck className="w-3 h-3" aria-hidden="true" /> Can announce</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"><EyeOff className="w-3 h-3" aria-hidden="true" /> Keep anonymous</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
