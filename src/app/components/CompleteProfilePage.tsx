// =====================================================================
// COMPLETE PROFILE — shown once, right after a first-time Google/
// Facebook/LinkedIn sign-in (see AuthCallback.tsx), to collect the
// fields the OAuth provider never supplies: department, course/program,
// batch year, address, and a valid-ID photo. Every other signup path
// (the normal email/password SignUpForm in AuthPage.tsx) already
// collects these up front; OAuth users fill them in here instead so the
// alumni office still has what it needs to review the registration.
//
// Writes straight to `profiles` via supabase-js (same table/columns
// AuthContext.updateProfile() writes, just with idType/idDocument added,
// which aren't part of that function's typed patch) — RLS's "Users can
// update their own profile" policy (auth.uid() = id) already allows a
// signed-in user to set these columns on their own row; the guard
// trigger from batch_representative_assignment_guard.sql only locks
// down role/assigned_* fields, none of which this page touches.
// =====================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { compressImageFile } from '../../lib/image';
import { PROGRAMS_BY_DEPT as PROGRAMS } from '../../lib/academicPrograms';
import { getBatchYearOptions } from '../../lib/batchYears';
import { Camera, CheckCircle } from 'lucide-react';
import {
  NAVY, RED, PANEL_GRADIENT,
  SelectField,
  ALL_PROGRAMS, DEPARTMENT_LABELS, ID_TYPE_LABELS,
} from './AuthPage';
import AddressAutocomplete from './shared/AddressAutocomplete';

const BATCH_YEAR_OPTIONS = getBatchYearOptions();

export default function CompleteProfilePage() {
  const { user, loading, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress]         = useState('');
  const [department, setDepartment]   = useState('');
  const [program, setProgram]         = useState('');
  const [batchYear, setBatchYear]     = useState('');
  const [idType, setIdType]           = useState('');
  const [idDocumentImg, setIdDocumentImg] = useState('');
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Not signed in (direct nav here, or a session that never resolved) —
  // nothing to complete. Wait out the initial auth check first so this
  // doesn't flash before `user` has a chance to load.
  React.useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  // Already complete (e.g. someone re-visits this URL after finishing
  // it) — nothing left to do here.
  React.useEffect(() => {
    if (user && !(user.role === 'alumni' && (!user.department || !user.program || !user.batchYear))) {
      navigate('/pending-approval', { replace: true });
    }
  }, [user, navigate]);

  const setDept = (value: string) => {
    setDepartment(value);
    // Clear a course that belonged to a different department, same as
    // the signup form's own department picker.
    setProgram(p => (ALL_PROGRAMS.find(x => x.code === p)?.department === value ? p : ''));
  };

  const setProg = (value: string) => {
    setProgram(value);
    const match = ALL_PROGRAMS.find(p => p.code === value);
    if (match) setDepartment(match.department);
  };

  const handleIdDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 1000, 0.7)
      .then(setIdDocumentImg)
      .catch(() => setError('Could not process that photo. Please try a different image.'));
  };

  const validate = () => {
    if (!address) return 'Address is required.';
    if (!department) return 'Select your department.';
    if (!program) return 'Select your course/program.';
    if (!batchYear) return 'Select your batch year.';
    if (!idType) return 'Select the type of ID you are uploading.';
    if (!idDocumentImg) return 'Upload a photo of your valid ID.';
    return '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    if (!user) return;
    setError('');
    setSubmitting(true);

    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        address,
        department,
        program,
        batch_year: Number(batchYear),
        id_type: idType,
        id_document_url: idDocumentImg,
      })
      .eq('id', user.id);

    if (dbError) {
      setSubmitting(false);
      setError('Could not save your profile. Please try again.');
      return;
    }

    const result = await refreshProfile();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Saved, but could not refresh your profile. Please refresh the page.');
      return;
    }
    navigate('/pending-approval', { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: '#f0f4f8' }}>
      <div className="relative bg-white shadow-2xl overflow-hidden w-full" style={{ maxWidth: 480, borderRadius: 16 }}>
        <div className="px-6 sm:px-8 pt-8 pb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow" style={{ background: PANEL_GRADIENT }}>
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl mb-1" style={{ color: NAVY }}>Finish Your Profile</h2>
          <p className="text-sm text-gray-500 mb-5">
            Welcome, <strong>{user.name}</strong>! We just need a few more details before your registration can be reviewed.
          </p>

          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-2.5">
            <AddressAutocomplete label="Address" value={address} onChange={setAddress} required />

            <SelectField placeholder="Select Department" value={department} onChange={setDept}>
              {Object.keys(PROGRAMS).map(dept => (
                <option key={dept} value={dept}>{DEPARTMENT_LABELS[dept] || dept}</option>
              ))}
            </SelectField>

            <SelectField placeholder="Select Course / Program" value={program} onChange={setProg} disabled={!department}>
              {(department ? ALL_PROGRAMS.filter(p => p.department === department) : ALL_PROGRAMS).map(p => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </SelectField>

            <SelectField placeholder="Select Batch Year" value={batchYear} onChange={setBatchYear}>
              {BATCH_YEAR_OPTIONS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </SelectField>

            <SelectField placeholder="Select ID Type" value={idType} onChange={setIdType}>
              {Object.entries(ID_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelectField>

            <label
              className="flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer transition-all duration-200 hover:bg-gray-50"
              style={{ borderColor: idDocumentImg ? '#22c55e' : '#d1d5db' }}
            >
              {idDocumentImg ? (
                <img src={idDocumentImg} alt="ID preview" className="w-14 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />
              ) : (
                <div className="w-14 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 font-medium">
                  {idDocumentImg ? 'ID photo attached' : 'Upload a photo of a valid ID'}<span style={{ color: RED }}>*</span>
                </p>
                <p className="text-xs text-gray-400">JPG or PNG, clear and legible</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleIdDocument} />
            </label>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Sign out
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 hover:shadow-lg disabled:opacity-60"
                style={{ background: PANEL_GRADIENT }}
              >
                {submitting ? 'SAVING…' : 'SUBMIT'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
