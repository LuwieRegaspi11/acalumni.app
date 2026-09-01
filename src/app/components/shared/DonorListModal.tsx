// =====================================================================
// DONOR LIST MODAL — "who gave to this campaign", opened by clicking a
// campaign row (or its name) in the admin Campaigns table. Deliberately
// runs its own Supabase query scoped to campaign_id + status=verified
// rather than reusing the app-wide `donations` list already sitting in
// DonationContext — this modal's numbers must always mean "money that
// actually counted toward this campaign's raised total", independent
// of whatever else happens to be loaded, and refetching per campaign
// click is what gives us a real loading state to show.
// =====================================================================
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { X, DollarSign, ArrowUp, ArrowDown, Eye, Plus, Upload, Image, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { useDonations, type Campaign } from './DonationContext';

interface DonorRow {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO timestamp
}

type SortKey = 'name' | 'amount' | 'date';

interface Props {
  campaign: Campaign;
  onClose: () => void;
}

const money = (n: number) => (n < 0 ? `-₱${Math.abs(n).toLocaleString()}` : `₱${n.toLocaleString()}`);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: 'medium' });

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Donor Name' },
  { key: 'amount', label: 'Amount Donated', align: 'right' },
  { key: 'date', label: 'Date Donated', align: 'right' },
];

export default function DonorListModal({ campaign, onClose }: Props) {
  const { user } = useAuth();
  const { expenses, getProofUrl, addExpense, deleteExpense } = useDonations();
  // Alumni, faculty, and batch representatives all get this same modal
  // for transparency (see the campaign click-through in
  // DonationPortal/RepDonationMonitor/DonationManagementView) — but
  // expense logging (add/delete) is admin-only from the UI now, so
  // everyone else gets a read-only donor list + expense ledger.
  const canManageExpenses = user?.role === 'admin';
  const [rows, setRows] = useState<DonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  // Where the raised money actually went — same expenses already logged
  // from the Campaigns table's old "Log expense" action, now logged
  // directly from this section instead (see the + button below).
  const campaignExpenses = useMemo(() => expenses.filter(e => e.campaignId === campaign.id), [expenses, campaign.id]);
  const spent = campaignExpenses.reduce((s, e) => s + e.amount, 0);
  const remaining = campaign.current - spent;

  const handleViewReceipt = async (path: string | null) => {
    if (!path) return;
    const url = await getProofUrl(path);
    if (url) setViewReceipt(url);
  };

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);
  const [expenseReceiptFileName, setExpenseReceiptFileName] = useState('');
  const [loggingExpense, setLoggingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const resetExpenseForm = () => {
    setExpenseForm({ description: '', amount: '' });
    setExpenseReceiptFile(null);
    setExpenseReceiptFileName('');
    setExpenseError('');
  };

  const handleExpenseReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExpenseReceiptFileName(file.name);
    setExpenseReceiptFile(file);
  };

  // Raised money is the hard ceiling on what can be logged as spent — an
  // expense can never push total spending past what the campaign has
  // actually raised, so this is checked live as the amount is typed, not
  // just at submit time.
  const handleExpenseAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExpenseForm(f => ({ ...f, amount: val }));
    const amt = parseFloat(val);
    if (val !== '' && !isNaN(amt) && amt > remaining) {
      setExpenseError(`Amount exceeds the ${money(remaining)} still raised for this campaign.`);
    } else {
      setExpenseError('');
    }
  };

  const handleLogExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) return;
    const amt = parseFloat(expenseForm.amount) || 0;
    if (amt > remaining) {
      setExpenseError(`Amount exceeds the ${money(remaining)} still raised for this campaign.`);
      return;
    }
    setLoggingExpense(true);
    await addExpense(campaign.id, expenseForm.description, amt, user?.name || (user?.role === 'faculty' ? 'Faculty' : 'Admin'), expenseReceiptFile);
    setLoggingExpense(false);
    resetExpenseForm();
    setShowExpenseForm(false);
  };

  // Reset and refetch whenever a different campaign is clicked, so the
  // previous campaign's rows never flash while the new ones load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setSortKey('date');
    setSortDir('desc');
    setShowExpenseForm(false);
    resetExpenseForm();

    (async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('id, amount, created_at, donor:profiles!donations_donor_id_fkey(name)')
        .eq('campaign_id', campaign.id)
        .eq('status', 'verified')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[DonorListModal] failed to load donors', error);
      } else {
        setRows((data || []).map((d: any) => ({
          id: d.id,
          // There's no donor-facing "hide my name" opt-out yet — this
          // fallback only covers a donor row whose profile can't be
          // resolved (e.g. a deleted account), so it never renders blank.
          name: d.donor?.name || 'Anonymous',
          amount: Number(d.amount),
          date: d.created_at,
        })));
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [campaign.id]);

  // Escape closes the receipt lightbox first if one's open, otherwise the
  // whole modal — same convention as the other admin modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setViewReceipt(current => {
        if (current) return null;
        onClose();
        return current;
      });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'amount') return a.amount - b.amount;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [rows, sortKey, sortDir]);

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-800">Donors — {campaign.name}</h3>
            <p className="text-xs text-gray-400 truncate max-w-md">{campaign.description || 'Verified donations only'}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Expenses</p>
            {canManageExpenses && (
              <button
                onClick={() => setShowExpenseForm(v => !v)}
                title="Log an expense"
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${showExpenseForm ? 'bg-gray-200 text-gray-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                <Plus className={`w-3.5 h-3.5 transition-transform ${showExpenseForm ? 'rotate-45' : ''}`} />
              </button>
            )}
          </div>

          {campaignExpenses.length > 0 && (
            <div className="mb-3 border border-gray-100 rounded-lg overflow-hidden">
              <p className="px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">Budget Summary</p>
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-400">Expenses</p>
                  <p className="font-bold text-gray-800">{money(spent)}</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-400">Balance</p>
                  <p className={`font-bold ${remaining < 0 ? 'text-red-500' : 'text-gray-800'}`}>{money(remaining)}</p>
                </div>
              </div>
            </div>
          )}

          {canManageExpenses && showExpenseForm && (
            <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Title <span className="text-red-500">*</span></label>
                <input
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What was it spent on?"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number" min="0" step="0.01" max={remaining > 0 ? remaining : 0}
                  value={expenseForm.amount}
                  onChange={handleExpenseAmountChange}
                  placeholder="Amount (₱)"
                  className={`flex-1 text-xs border rounded-lg px-2.5 py-2 focus:outline-none ${expenseError ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
                />
                <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 flex-shrink-0">
                  {expenseReceiptFile ? (
                    <>
                      <Image className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-600 font-semibold truncate max-w-[80px]">{expenseReceiptFileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" /> Receipt
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleExpenseReceiptChange} />
                </label>
              </div>
              {expenseError && <p className="text-xs text-red-500 font-semibold">{expenseError}</p>}
              <p className="text-xs text-gray-400">{money(Math.max(remaining, 0))} available to spend.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowExpenseForm(false); resetExpenseForm(); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogExpense}
                  disabled={loggingExpense || !expenseForm.description || !expenseForm.amount || !!expenseError}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}
                >
                  {loggingExpense ? 'Adding…' : 'Add Expense'}
                </button>
              </div>
            </div>
          )}

          {campaignExpenses.length === 0 ? (
            <p className="text-xs text-gray-400">No expenses logged yet.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    {canManageExpenses && <th className="px-3 py-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaignExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 min-w-0">
                        <p className="text-gray-700 truncate max-w-[220px]">{e.description}</p>
                        {e.receiptUrl && (
                          <button onClick={() => handleViewReceipt(e.receiptUrl)} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5">
                            <Eye className="w-3 h-3" /> View receipt
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">{money(e.amount)}</td>
                      {canManageExpenses && (
                        <td className="px-3 py-2 text-right w-8">
                          <button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 mb-3 animate-spin" style={{ borderTopColor: '#2B5BA8' }} />
              <p className="text-sm text-gray-400">Loading donors…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"><DollarSign className="w-7 h-7 text-gray-300" /></div>
              <p className="font-semibold text-gray-500">No donations yet for this campaign</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                          {col.label}
                          {sortKey === col.key && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedRows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{money(r.amount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 whitespace-nowrap">{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{money(totalAmount)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="px-6 py-3 border-t flex-shrink-0 text-xs font-semibold text-gray-500 rounded-b-2xl">
            {rows.length} donor{rows.length !== 1 ? 's' : ''} total
          </div>
        )}
      </div>

      {/* Capped to the viewport (max-h-[80vh]) with object-contain so a
          tall/large receipt scales down to fit instead of overflowing
          past the screen edges. */}
      {viewReceipt && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setViewReceipt(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewReceipt(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={viewReceipt} alt="Receipt" className="max-w-full max-h-[80vh] w-auto h-auto mx-auto block rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
