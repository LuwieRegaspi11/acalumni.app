import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { useDarkMode } from './DarkModeContext';
import { useDonations } from './DonationContext';
import { supabase } from '../../../lib/supabaseClient';
import PhoneNumberField from './PhoneNumberField';
import JobInfoCard from './JobInfoCard';
import { Sun, Moon, Camera, Mail, Phone, MapPin, Home, Link as LinkIcon, Calendar, GraduationCap, Building, Shield, Pencil, Check, X, AtSign, Briefcase, Heart, DollarSign } from 'lucide-react';

const DONATION_STATUS_LABELS: Record<string, string> = { Pending: 'Pending', Verified: 'Confirmed', Rejected: 'Rejected' };
const DONATION_STATUS_COLOR: Record<string, string> = {
  Pending: 'bg-orange-100 text-orange-700', Verified: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
};

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { dark, toggle } = useDarkMode();
  const { donations } = useDonations();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'job' | 'donations'>('profile');
  const [form, setForm] = useState({
    phone: user?.phone || '',
    address: user?.address || '',
    currentPosition: user?.currentPosition || '',
    currentCompany: user?.currentCompany || '',
    username: user?.username || '',
    position: user?.position || '',
    permanentAddress: '',
    socialNetworkId: '',
  });

  // Graduate Profile contact fields — Permanent Address and Social Network
  // ID live only on the alumnus/rep's Graduate Tracer Survey response
  // (graduate_tracer_responses), not on `profiles`, so they're fetched
  // separately here. `hasTracerRecord` gates both showing these two fields
  // and, on Save below, pushing Phone/Address into that same row's
  // mobile_number/current_address columns — see
  // supabase/graduate_tracer_contact_info_edit.sql for the database-level
  // lock that permits this after submission (same idea as
  // shared/JobInfoCard.tsx for Employment fields). A legacy account that
  // predates the Graduate Tracer Survey gate (no row at all) just doesn't
  // get this sync — nothing there to keep current.
  const showTracerSync = user?.role === 'alumni' || user?.role === 'representative';
  const [hasTracerRecord, setHasTracerRecord] = useState(false);
  const [tracerOriginal, setTracerOriginal] = useState({ permanentAddress: '', socialNetworkId: '' });

  useEffect(() => {
    if (!user || !showTracerSync) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from('graduate_tracer_responses')
        .select('status, permanent_address, social_network_id').eq('respondent_id', user.id).maybeSingle();
      if (!active || !data || data.status !== 'submitted') return;
      setHasTracerRecord(true);
      setTracerOriginal({ permanentAddress: data.permanent_address || '', socialNetworkId: data.social_network_id || '' });
    })();
    return () => { active = false; };
  }, [user?.id, showTracerSync]);

  const profileImage = user?.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1B3A6B&color=fff&bold=true`;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('public-assets').getPublicUrl(path);
      await updateProfile({ profileImage: `${data.publicUrl}?t=${Date.now()}` });
    } else {
      console.error('[profile] avatar upload failed', error);
    }
    setUploading(false);
  };

  const startEditing = () => {
    setForm({
      phone: user?.phone || '', address: user?.address || '',
      currentPosition: user?.currentPosition || '', currentCompany: user?.currentCompany || '',
      username: user?.username || '', position: user?.position || '',
      permanentAddress: tracerOriginal.permanentAddress, socialNetworkId: tracerOriginal.socialNetworkId,
    });
    setSaveError(null);
    setEditing(true);
  };

  // Saving never requires touching every field — each input above is
  // independently optional here, so an alumnus can change just their
  // phone number (say) and leave everything else exactly as it was.
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const ok = await updateProfile({
      phone: form.phone, address: form.address,
      currentPosition: form.currentPosition, currentCompany: form.currentCompany,
      ...(user?.role === 'admin' ? { username: form.username } : {}),
      ...(user?.role === 'faculty' ? { position: form.position } : {}),
    });
    if (!ok) {
      setSaving(false);
      setSaveError('Could not save your changes. Please try again.');
      return;
    }
    // Mirror Phone/Address plus the two tracer-only fields into the same
    // Graduate Tracer Survey response admin/faculty's Alumni Tracer screen
    // reads from — so this one Save is all it takes for the correction to
    // show up there too, instead of a second edit somewhere else.
    if (showTracerSync && hasTracerRecord && user) {
      const { error } = await supabase.from('graduate_tracer_responses').update({
        mobile_number: form.phone || null, current_address: form.address || null,
        permanent_address: form.permanentAddress || null, social_network_id: form.socialNetworkId || null,
      }).eq('respondent_id', user.id);
      if (error) {
        console.error('[profile] tracer contact sync failed', error);
        setSaving(false);
        setSaveError('Your profile was saved, but the Alumni Tracer record could not be updated. Please try again.');
        return;
      }
      setTracerOriginal({ permanentAddress: form.permanentAddress, socialNetworkId: form.socialNetworkId });
    }
    setSaving(false);
    setEditing(false);
  };

  const card = dark
    ? 'bg-gray-800 border border-gray-700 rounded-xl p-5'
    : 'bg-white border border-gray-100 rounded-xl p-5 shadow-sm';

  const label = dark ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs';
  const value = dark ? 'text-white text-sm font-medium' : 'text-gray-800 text-sm font-medium';
  const heading = dark ? 'text-white font-bold text-base mb-4' : 'text-gray-800 font-bold text-base mb-4';
  const inputCls = `w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors ${
    dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-800'
  }`;

  const employment = user?.currentPosition
    ? `${user.currentPosition}${user.currentCompany ? ` at ${user.currentCompany}` : ''}`
    : '—';

  // A rep is an alumnus first (see TRACER_GATED_ROLES in App.tsx) and is
  // gated through the same mandatory Graduate Tracer Survey, and gives
  // personally too (see RepDonationMonitor's "My Donations" section) —
  // so alumni and reps get an identical set of profile tabs.
  const showJobTab = user?.role === 'alumni' || user?.role === 'representative';
  const showDonationsTab = user?.role === 'alumni' || user?.role === 'representative';
  const profileTabs = [
    { key: 'profile' as const, label: 'Profile Info' },
    ...(showJobTab ? [{ key: 'job' as const, label: 'Job Information' }] : []),
    ...(showDonationsTab ? [{ key: 'donations' as const, label: 'My Donations' }] : []),
  ];
  const hasProfileTabs = profileTabs.length > 1;

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className={dark ? 'text-2xl font-bold text-white' : 'text-2xl font-bold text-gray-800'}>
            My Profile
          </h2>
          <p className={dark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>
            Manage your account information and preferences
          </p>
        </div>
      </div>

      {/* Profile card */}
      <div className={card}>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <img
              src={profileImage}
              alt={user?.name}
              className="w-24 h-24 rounded-full object-cover border-4"
              style={{ borderColor: dark ? '#374151' : '#e5e7eb' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1B3A6B&color=fff&bold=true`;
              }}
            />
            <label
              htmlFor="profile-upload"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #1B3A6B, #2B5BA8)' }}
            >
              <Camera className="w-3.5 h-3.5 text-white" />
              <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <h3 className={dark ? 'text-xl font-bold text-white' : 'text-xl font-bold text-gray-800'}>{user?.name}</h3>
            <p className={dark ? 'text-gray-400 text-sm' : 'text-gray-500 text-sm'}>{user?.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {user?.department && (
                <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: '#2B5BA8' }}>
                  {user.department}
                </span>
              )}
              {user?.batchYear && (
                <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: '#1B3A6B' }}>
                  Batch {user.batchYear}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 capitalize font-medium">
                ✓ {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switcher — Job Information applies to alumni and reps alike
          (a rep is an alumnus first, and goes through the same mandatory
          Graduate Tracer Survey); My Donations is alumni-only. */}
      {hasProfileTabs && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {profileTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {showJobTab && activeTab === 'job' && <JobInfoCard />}

      {showDonationsTab && activeTab === 'donations' && (() => {
        const myDonations = donations.filter(d => d.alumniEmail === user?.email);
        const confirmedTotal = myDonations.filter(d => d.status === 'Verified').reduce((s, d) => s + d.amount, 0);
        const donationsBasePath = user?.role === 'representative' ? '/representative/donations' : '/alumni/donations';
        return (
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={dark ? 'text-white font-bold text-base' : 'text-gray-800 font-bold text-base'}>My Donations</h3>
              <button onClick={() => navigate(donationsBasePath)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                <Heart className="w-3.5 h-3.5" /> Go to Donation Portal
              </button>
            </div>
            <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className={label}>Total confirmed: </span>
              <span className={value}>₱{confirmedTotal.toLocaleString()}</span>
            </div>
            {myDonations.length === 0 ? (
              <p className={`text-sm text-center py-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>You haven't made any donations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={dark ? 'border-b border-gray-700' : 'border-b border-gray-100'}>
                    <tr>{['Date','Campaign','Amount','Status'].map(h => (
                      <th key={h} className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className={dark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-50'}>
                    {myDonations.map(d => (
                      <tr key={d.id}>
                        <td className={`px-3 py-2 text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{d.submittedAt}</td>
                        <td className={`px-3 py-2 ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{d.campaign}</td>
                        <td className={`px-3 py-2 font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>₱{d.amount.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${DONATION_STATUS_COLOR[d.status]}`}>{DONATION_STATUS_LABELS[d.status]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {(!hasProfileTabs || activeTab === 'profile') && (
        <>
      {/* Settings card — dark/light mode */}
      <div className={card}>
        <h3 className={heading}>Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className={value}>Theme Mode</p>
            <p className={label}>Switch between light and dark interface</p>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border"
            style={
              dark
                ? { background: '#1f2937', borderColor: '#374151', color: '#f9fafb' }
                : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#1f2937' }
            }
          >
            {dark ? (
              <><Sun className="w-4 h-4 text-yellow-400" /> Light Mode</>
            ) : (
              <><Moon className="w-4 h-4 text-indigo-500" /> Dark Mode</>
            )}
          </button>
        </div>
      </div>

      {/* Personal info */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={dark ? 'text-white font-bold text-base' : 'text-gray-800 font-bold text-base'}>Personal Information</h3>
          {!editing ? (
            <button onClick={startEditing} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(false)} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border ${dark ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {showTracerSync && hasTracerRecord && (
          <p className={`text-xs mb-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            Saving here also updates your contact details on the school's Alumni Tracer records — no need to change anything else.
          </p>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{saveError}</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-gray-400" /><span className={label}>Email Address</span></div>
            <p className={value}>{user?.email}</p>
          </div>

          {user?.role === 'admin' && (
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1"><AtSign className="w-4 h-4 text-gray-400" /><span className={label}>Username</span></div>
              {editing ? (
                <input className={inputCls} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username" />
              ) : (
                <p className={value}>{user?.username || '—'}</p>
              )}
            </div>
          )}

          {user?.role === 'faculty' && (
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-gray-400" /><span className={label}>Position</span></div>
              {editing ? (
                <input className={inputCls} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Department Chair" />
              ) : (
                <p className={value}>{user?.position || '—'}</p>
              )}
            </div>
          )}

          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><Phone className="w-4 h-4 text-gray-400" /><span className={label}>Phone Number</span></div>
            {editing ? (
              <PhoneNumberField variant="compact" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="9XX XXX XXXX" hint="Start with 9 — leave out the leading 0" />
            ) : (
              <p className={value}>{user?.phone || '—'}</p>
            )}
          </div>

          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><MapPin className="w-4 h-4 text-gray-400" /><span className={label}>{showTracerSync && hasTracerRecord ? 'Current Address' : 'Address'}</span></div>
            {editing ? (
              <input className={inputCls} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City" />
            ) : (
              <p className={value}>{user?.address || '—'}</p>
            )}
          </div>

          {/* Permanent Address / Social Network ID — Graduate Profile
              columns that live only on the tracer response (see
              showTracerSync/hasTracerRecord above), not on `profiles`. */}
          {showTracerSync && hasTracerRecord && (
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1"><Home className="w-4 h-4 text-gray-400" /><span className={label}>Permanent Address</span></div>
              {editing ? (
                <input className={inputCls} value={form.permanentAddress} onChange={e => setForm(f => ({ ...f, permanentAddress: e.target.value }))} placeholder="Street, City" />
              ) : (
                <p className={value}>{tracerOriginal.permanentAddress || '—'}</p>
              )}
            </div>
          )}

          {showTracerSync && hasTracerRecord && (
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1"><LinkIcon className="w-4 h-4 text-gray-400" /><span className={label}>Social Network ID</span></div>
              {editing ? (
                <input className={inputCls} value={form.socialNetworkId} onChange={e => setForm(f => ({ ...f, socialNetworkId: e.target.value }))} placeholder="Facebook/Twitter name or link" />
              ) : (
                <p className={value}>{tracerOriginal.socialNetworkId || '—'}</p>
              )}
            </div>
          )}

          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><GraduationCap className="w-4 h-4 text-gray-400" /><span className={label}>Department</span></div>
            <p className={value}>{user?.department || '—'}</p>
          </div>

          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-gray-400" /><span className={label}>Batch Year</span></div>
            <p className={value}>{user?.batchYear?.toString() || '—'}</p>
          </div>

          {/* Set once from the Alumni Tracer Survey (or an admin's manual
              approval) — see graduate_tracer_job_info_edit.sql's edit lock,
              which treats these as permanent identity fields. Not editable
              here, same split as GraduateTracerForm.tsx vs JobInfoCard.tsx. */}
          {(user?.role === 'alumni' || user?.role === 'representative') && (
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-gray-400" /><span className={label}>Birthdate</span></div>
              <p className={value}>{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : '—'}</p>
            </div>
          )}

          <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1"><Building className="w-4 h-4 text-gray-400" /><span className={label}>Employment</span></div>
            {editing ? (
              <div className="space-y-2">
                <input className={inputCls} value={form.currentPosition} onChange={e => setForm(f => ({ ...f, currentPosition: e.target.value }))} placeholder="Position" />
                <input className={inputCls} value={form.currentCompany} onChange={e => setForm(f => ({ ...f, currentCompany: e.target.value }))} placeholder="Company" />
              </div>
            ) : (
              <p className={value}>{employment}</p>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Privacy notice */}
      <div className={`${card} ${dark ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex items-start gap-3">
          <Shield className={`w-5 h-5 mt-0.5 flex-shrink-0 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <p className={`text-sm font-semibold mb-1 ${dark ? 'text-blue-300' : 'text-blue-700'}`}>Privacy & Data Protection</p>
            <p className={`text-xs ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
              Your personal information is protected under RA 10173 (Data Privacy Act of 2012).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
