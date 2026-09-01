import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Calendar, X, Building2, Edit, Trash2, CheckCircle, Plus, XCircle, Upload, Globe, CreditCard, Mail, Save, Phone, AtSign, Link, ChevronUp, ChevronDown, Wallet, QrCode, AlertCircle } from 'lucide-react';
import { useDarkMode } from '../shared/DarkModeContext';
import { Tab } from '@mui/material';
import { useDonations, PaymentDestination } from '../shared/DonationContext';

// ================= [ADMIN: SYSTEMSETTINGS] =================

type Tab = 'university' | 'donation';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'university',  label: 'School Info',        icon: <Building2 className="w-4 h-4" /> },
  { id: 'donation',    label: 'Payment Config',     icon: <CreditCard className="w-4 h-4" /> },
];

export default function SystemSettings() {
  const { dark } = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>('university');
  const [saved, setSaved] = useState(false);

  const [uni, setUni] = useState({
    name: 'Asian College', tagline: 'Developing Leaders in I.T. and Management',
    address: 'Dr. V. Locsin Street, Taclobo, Dumaguete City 6200, Negros Oriental, Philippines',
    phone: '(035) 523-5373', email: 'admin@asiancollege.edu.ph',
    website: 'www.asiancollege.edu.ph', foundedYear: '1972',
  });

  const [donation, setDonation] = useState({
    instructions: 'After transferring, upload your receipt/screenshot in the Donation Center. Your donation will be verified within 1–3 business days.',
  });

  const { paymentDestinations, addPaymentDestination, updatePaymentDestination, deletePaymentDestination, movePaymentDestination } = useDonations();
  const [destModal, setDestModal] = useState<{ open: boolean; editing: PaymentDestination | null }>({ open: false, editing: null });
  const [destForm, setDestForm] = useState({ type: 'E-Wallet' as PaymentDestination['type'], providerName: '', accountName: '', accountNumber: '', isActive: true });
  const [destQrFile, setDestQrFile] = useState<File | null>(null);
  const [destErrors, setDestErrors] = useState<Record<string, string>>({});
  const [destSaving, setDestSaving] = useState(false);
  const [destDeleteId, setDestDeleteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('system_settings').select('*').eq('id', true).single().then(({ data }) => {
      if (!data) return;
      setUni({
        name: data.university_name, tagline: data.tagline || '', address: data.address || '',
        phone: data.phone || '', email: data.email || '', website: data.website || '', foundedYear: data.founded_year || '',
      });
      setDonation({ instructions: data.donation_instructions || '' });
    });
  }, []);

  const handleSave = async () => {
    await supabase.from('system_settings').update({
      university_name: uni.name, tagline: uni.tagline, address: uni.address,
      phone: uni.phone, email: uni.email, website: uni.website, founded_year: uni.foundedYear,
      donation_instructions: donation.instructions,
    }).eq('id', true);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Accepts 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes allowed anywhere).
  const isValidPhMobile = (v: string) => /^(?:\+63|0)9\d{9}$/.test(v.replace(/[\s-]/g, ''));

  const openAddDest = () => {
    setDestForm({ type: 'E-Wallet', providerName: '', accountName: '', accountNumber: '', isActive: true });
    setDestQrFile(null);
    setDestErrors({});
    setDestModal({ open: true, editing: null });
  };

  const openEditDest = (p: PaymentDestination) => {
    setDestForm({ type: p.type, providerName: p.providerName, accountName: p.accountName, accountNumber: p.accountNumber, isActive: p.isActive });
    setDestQrFile(null);
    setDestErrors({});
    setDestModal({ open: true, editing: p });
  };

  const validateDestForm = () => {
    const errs: Record<string, string> = {};
    if (!destForm.providerName.trim()) errs.providerName = 'Provider name is required.';
    if (!destForm.accountName.trim()) errs.accountName = 'Account name is required.';
    if (!destForm.accountNumber.trim()) errs.accountNumber = 'Account number is required.';
    else if (destForm.type === 'E-Wallet' && !isValidPhMobile(destForm.accountNumber)) {
      errs.accountNumber = 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';
    }
    setDestErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveDest = async () => {
    if (!validateDestForm()) return;
    setDestSaving(true);
    if (destModal.editing) {
      await updatePaymentDestination(destModal.editing.id, destForm, destQrFile);
    } else {
      await addPaymentDestination(destForm, destQrFile);
    }
    setDestSaving(false);
    setDestModal({ open: false, editing: null });
  };

  const handleDeleteDest = async (id: string) => {
    await deletePaymentDestination(id);
    setDestDeleteId(null);
  };

  const destTypeIcon = (type: PaymentDestination['type']) =>
    type === 'Bank' ? <Building2 className="w-4 h-4" /> : type === 'E-Wallet' ? <Wallet className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />;

  const card = `rounded-2xl border p-6 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`;
  const fieldBg = dark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400';
  const labelCls = `text-xs font-semibold mb-1.5 block ${dark ? 'text-gray-400' : 'text-gray-500'}`;

  const Field = ({ label, value, onChange, type = 'text', icon, rows, placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; icon?: React.ReactNode; rows?: number; placeholder?: string;
  }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        {rows ? (
          <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
            className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none transition-colors ${fieldBg}`} />
        ) : (
          <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className={`w-full text-sm border rounded-xl py-2.5 focus:outline-none focus:border-blue-400 transition-colors ${fieldBg} ${icon ? 'pl-9 pr-4' : 'px-3'}`} />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>System Settings</h2>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Configure school information and system preferences</p>
        </div>
        <button onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${saved ? 'bg-green-500' : ''}`}
          style={!saved ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Tab bar */}
      <div className={`flex gap-1 p-1 rounded-2xl w-full ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === t.id
                ? 'bg-white text-gray-800 shadow-sm'
                : dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === t.id && dark ? { backgroundColor: '#1e293b', color: '#f1f5f9' } : {}}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── School Info ── */}
      {activeTab === 'university' && (
        <div className="space-y-5">
          {/* Name row */}
          <div className={card}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
              <Globe className="w-4 h-4 text-blue-500" /> School Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Field label="School Name" value={uni.name} onChange={v => setUni(u => ({...u, name: v}))} icon={<Building2 className="w-3.5 h-3.5" />} />
              <Field label="Tagline" value={uni.tagline} onChange={v => setUni(u => ({...u, tagline: v}))} />
              <Field label="Founded Year" value={uni.foundedYear} onChange={v => setUni(u => ({...u, foundedYear: v}))} icon={<Calendar className="w-3.5 h-3.5" />} />
              <Field label="Website" value={uni.website} onChange={v => setUni(u => ({...u, website: v}))} icon={<Link className="w-3.5 h-3.5" />} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Address" value={uni.address} onChange={v => setUni(u => ({...u, address: v}))} />
              </div>
              <Field label="Phone" value={uni.phone} onChange={v => setUni(u => ({...u, phone: v}))} icon={<Phone className="w-3.5 h-3.5" />} />
              <Field label="Email" value={uni.email} onChange={v => setUni(u => ({...u, email: v}))} icon={<AtSign className="w-3.5 h-3.5" />} />
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Config ── */}
      {activeTab === 'donation' && (
        <div className="space-y-5">
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
                <CreditCard className="w-4 h-4 text-green-500" /> Payment Destinations
              </h3>
              <button onClick={openAddDest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                <Plus className="w-3.5 h-3.5" /> Add Destination
              </button>
            </div>
            <p className={`text-xs mb-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              These are the accounts alumni can send donations to. Only <strong>active</strong> entries appear on the Donation Center, in the order shown below.
            </p>

            {paymentDestinations.length === 0 ? (
              <div className={`flex flex-col items-center py-10 text-center rounded-xl border-2 border-dashed ${dark ? 'border-gray-600' : 'border-gray-200'}`}>
                <Wallet className={`w-8 h-8 mb-2 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-sm font-semibold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No payment destinations yet</p>
                <p className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Add a bank, e-wallet, or other channel donors can pay into.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...paymentDestinations].sort((a, b) => a.sortOrder - b.sortOrder).map((p, i, arr) => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => movePaymentDestination(p.id, 'up')} disabled={i === 0}
                        className={`p-0.5 rounded ${i === 0 ? 'opacity-25 cursor-not-allowed' : dark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-500'}`}>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => movePaymentDestination(p.id, 'down')} disabled={i === arr.length - 1}
                        className={`p-0.5 rounded ${i === arr.length - 1 ? 'opacity-25 cursor-not-allowed' : dark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-500'}`}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {p.qrCodeUrl ? (
                      <img src={p.qrCodeUrl} alt="QR" className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${dark ? 'bg-gray-600' : 'bg-white border border-gray-200'}`}>
                        {destTypeIcon(p.type)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{p.providerName}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>{p.type}</span>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${p.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {p.isActive ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />} {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{p.accountName} · {p.accountNumber}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEditDest(p)}
                        className={`p-2 rounded-lg ${dark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-500'}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDestDeleteId(p.id)}
                        className={`p-2 rounded-lg ${dark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-500'}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
              <Mail className="w-4 h-4 text-purple-500" /> Payment Instructions
            </h3>
            <Field label="Shown to alumni when donating" value={donation.instructions} onChange={v => setDonation(d => ({...d, instructions: v}))} rows={4} />
          </div>
        </div>
      )}

      {/* ── Add/Edit Payment Destination modal ── */}
      {destModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col ${dark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${dark ? 'border-gray-700' : ''}`}>
              <h3 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>{destModal.editing ? 'Edit' : 'Add'} Payment Destination</h3>
              <button onClick={() => setDestModal({ open: false, editing: null })}><X className={`w-5 h-5 ${dark ? 'text-gray-400' : 'text-gray-500'}`} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className={labelCls}>Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Bank', 'E-Wallet', 'Other'] as const).map(t => (
                    <button key={t} onClick={() => setDestForm(f => ({...f, type: t}))}
                      className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${destForm.type === t ? 'border-blue-600 text-blue-700 bg-blue-50' : dark ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Field label="Provider Name" value={destForm.providerName} onChange={v => setDestForm(f => ({...f, providerName: v}))} placeholder="e.g. GCash, BDO Unibank" />
                {destErrors.providerName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {destErrors.providerName}</p>}
              </div>

              <div>
                <Field label="Account Name" value={destForm.accountName} onChange={v => setDestForm(f => ({...f, accountName: v}))} />
                {destErrors.accountName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {destErrors.accountName}</p>}
              </div>

              <div>
                <Field label={destForm.type === 'E-Wallet' ? 'Account Number (PH mobile no.)' : 'Account Number'}
                  value={destForm.accountNumber} onChange={v => setDestForm(f => ({...f, accountNumber: v}))}
                  placeholder={destForm.type === 'E-Wallet' ? 'e.g. 09171234567' : undefined} />
                {destErrors.accountNumber && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {destErrors.accountNumber}</p>}
              </div>

              <div>
                <label className={labelCls}>QR Code (optional)</label>
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${dark ? 'border-gray-600 hover:border-blue-400 hover:bg-gray-700/50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {destQrFile ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <QrCode className="w-4 h-4" /> <span className="text-sm font-semibold">{destQrFile.name}</span> <CheckCircle className="w-4 h-4" />
                    </div>
                  ) : destModal.editing?.qrCodeUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={destModal.editing.qrCodeUrl} alt="current QR" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                      <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Click to replace</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Upload className={`w-4 h-4 ${dark ? 'text-gray-400' : 'text-gray-400'}`} />
                      <span className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Upload QR code image</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setDestQrFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl border ${dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div>
                  <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Active</p>
                  <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Visible to alumni on the Donation Center</p>
                </div>
                <button onClick={() => setDestForm(f => ({...f, isActive: !f.isActive}))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${destForm.isActive ? 'bg-green-500' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${destForm.isActive ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            <div className={`flex gap-3 px-6 py-4 border-t flex-shrink-0 ${dark ? 'border-gray-700' : ''}`}>
              <button onClick={() => setDestModal({ open: false, editing: null })}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                Cancel
              </button>
              <button onClick={handleSaveDest} disabled={destSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                {destSaving ? 'Saving…' : destModal.editing ? 'Save Changes' : 'Add Destination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {destDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm p-6 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className={`font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>Delete this destination?</h3>
            </div>
            <p className={`text-sm mb-5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>This will remove it from the Donation Center. This can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDestDeleteId(null)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                Cancel
              </button>
              <button onClick={() => handleDeleteDest(destDeleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
