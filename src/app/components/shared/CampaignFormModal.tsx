import { useState } from 'react';
import { X, Zap, CalendarClock } from 'lucide-react';
import type { Campaign } from './DonationContext';
import CurrencyAmountField from './CurrencyAmountField';

// ================= [SHARED: CAMPAIGNFORMMODAL] =================
// The New/Edit Campaign form, extracted out of admin/DonationManagement.tsx
// so faculty (department-scoped, no department picker) and admin
// (always college-wide — no department picker either) share one
// implementation instead of two copies drifting apart. Also doubles as
// the Edit Campaign form when `initial` is passed.
//
// Three distinct date fields are in play here — never conflate them:
//   - eventStartDate: purely informational, no effect on status.
//   - postedDate: auto-set, shown read-only when editing, never submitted.
//   - releaseDate: the ONLY thing that controls Scheduled -> Active. Once
//     a campaign has actually gone live, its release_date becomes a
//     historical record — this form shows it read-only from then on
//     rather than silently re-stamping it on every edit. To force an
//     early release of a still-Scheduled campaign, use the "Release Now"
//     action on the campaigns list instead of this form.

export interface NewCampaignInput {
  name: string;
  description: string;
  target: number;
  department: string;
  eventStartDate: string;
  releaseDate?: string;
  active: boolean;
  endedAt?: string;
}

interface Props {
  onClose: () => void;
  onSubmit: (input: NewCampaignInput) => void;
  // When set, every campaign this form creates/edits is fixed to this
  // department (faculty use). Left unset for admin, whose campaigns are
  // always college-wide ("All").
  lockDepartment?: string;
  // Present => editing this campaign instead of creating a new one.
  initial?: Campaign;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function CampaignFormModal({ onClose, onSubmit, lockDepartment, initial }: Props) {
  const isEdit = !!initial;
  const initialReleaseDate = initial?.releaseDate ? new Date(initial.releaseDate) : null;
  const isAlreadyReleased = !!initialReleaseDate && initialReleaseDate.getTime() <= Date.now();
  const isCurrentlyScheduled = !!initialReleaseDate && initialReleaseDate.getTime() > Date.now();
  // Only a not-yet-released campaign (new, or edited before its scheduled
  // time arrives) exposes the Publish Now / Schedule toggle at all.
  const showReleaseToggle = !isEdit || !isAlreadyReleased;

  const [form, setForm] = useState({
    name: initial?.name || '', description: initial?.description || '',
    target: initial ? String(initial.target) : '',
    eventStartDate: initial?.eventStartDate || '',
    releaseMode: (isCurrentlyScheduled ? 'schedule' : 'now') as 'now' | 'schedule',
    releaseDate: isCurrentlyScheduled && initialReleaseDate ? initialReleaseDate.toISOString().slice(0, 10) : '',
    releaseTime: isCurrentlyScheduled && initialReleaseDate ? `${pad2(initialReleaseDate.getHours())}:${pad2(initialReleaseDate.getMinutes())}` : '',
  });
  const scheduledReleaseAt = () => {
    if (form.releaseMode !== 'schedule' || !form.releaseDate) return undefined;
    return new Date(`${form.releaseDate}T${form.releaseTime || '00:00'}`).toISOString();
  };

  // release_date must be >= posted_date. posted_date isn't known
  // client-side until insert, but it's for-all-practical-purposes "now",
  // so a scheduled date/time in the past is what this actually guards
  // against.
  const scheduledDateTimeValid = form.releaseMode !== 'schedule' || !form.releaseDate
    || new Date(`${form.releaseDate}T${form.releaseTime || '00:00'}`).getTime() >= Date.now();

  const handleSubmit = () => {
    const target = Math.round((parseFloat(form.target) || 0) * 100) / 100;
    // Once live, release_date is a historical record — keep it as-is
    // rather than letting an unrelated edit silently re-stamp it.
    const releaseDate = isAlreadyReleased && initial?.releaseDate ? initial.releaseDate : scheduledReleaseAt();
    onSubmit({
      name: form.name, description: form.description, target,
      department: lockDepartment || initial?.department || 'All',
      eventStartDate: form.eventStartDate,
      releaseDate,
      active: true,
      endedAt: initial?.endedAt,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h3 className="font-bold text-gray-800">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {isEdit && (
            <div className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="font-semibold text-gray-500">Posted</span>
              <span className="text-gray-600">{new Date(initial!.postedDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">read-only</span>
            </div>
          )}
          {([
            { label: 'Campaign Name', key: 'name', placeholder: 'e.g. Scholarship Fund 2026' },
            { label: 'Description', key: 'description', placeholder: 'Brief description' },
          ] as { label: string; key: string; placeholder: string }[]).map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                type="text" placeholder={f.placeholder}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
            </div>
          ))}
          <CurrencyAmountField
            label="Fundraising Target"
            currencySymbol="₱"
            required
            value={form.target}
            onChange={target => setForm(p => ({ ...p, target }))}
          />
          {/* No Department field shown here — for faculty it's silently pinned
              to `lockDepartment` in handleSubmit below (and enforced by RLS
              regardless), and for admin it's always "All". Nothing for
              either role to pick, so nothing to show. */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Event Start Date</label>
            <input type="date" value={form.eventStartDate} onChange={e => setForm(p => ({ ...p, eventStartDate: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
          </div>

          {showReleaseToggle ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Release</label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-3">
                {([
                  { key: 'now', label: 'Publish Now', icon: <Zap className="w-3.5 h-3.5" /> },
                  { key: 'schedule', label: 'Schedule', icon: <CalendarClock className="w-3.5 h-3.5" /> },
                ] as const).map(o => (
                  <button key={o.key} onClick={() => setForm(p => ({ ...p, releaseMode: o.key }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.releaseMode === o.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
              {form.releaseMode === 'schedule' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Posting Date</label>
                    <input type="date" value={form.releaseDate} min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setForm(p => ({ ...p, releaseDate: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Posting Time</label>
                    <input type="time" value={form.releaseTime}
                      onChange={e => setForm(p => ({ ...p, releaseTime: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                  </div>
                  {!scheduledDateTimeValid && (
                    <p className="col-span-2 text-xs text-red-500 font-semibold">Releases On must be now or in the future.</p>
                  )}
                  <p className="col-span-2 text-xs text-gray-400">
                    The campaign is created hidden and goes live automatically at this date/time. You can release it early from the campaigns list.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="font-semibold text-gray-500">Releases On</span>
              <span className="text-gray-600">{new Date(initial!.releaseDate!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">already live — use "Release Now"/"End Campaign" from the list to change this</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit}
            disabled={!form.name || !form.target || (showReleaseToggle && form.releaseMode === 'schedule' && (!form.releaseDate || !scheduledDateTimeValid))}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            {isEdit ? 'Save Changes' : form.releaseMode === 'schedule' ? 'Schedule Campaign' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
