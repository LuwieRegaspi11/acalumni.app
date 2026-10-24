import { useEffect, useId, useState } from 'react';
import { X, Zap, CalendarClock, ImagePlus, Trash2 } from 'lucide-react';
import type { Campaign } from './DonationContext';
import CurrencyAmountField from './CurrencyAmountField';
import type { CampaignMediaChanges } from '../../../lib/campaignMedia';

// ================= [SHARED: CAMPAIGNFORMMODAL] =================
// The New/Edit Campaign form, shared by the admin Donation Management screen
// for both creating and editing (`initial` set = editing). Besides the text
// fields it collects the campaign's cover photo and project photo gallery
// (Supabase Storage) — handed back as CampaignMediaChanges so
// DonationContext can upload/delete them.
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
  location?: string;
  releaseDate?: string;
  active: boolean;
  endedAt?: string;
}

interface Props {
  onClose: () => void;
  onSubmit: (input: NewCampaignInput, media: CampaignMediaChanges) => void;
  // Present => editing this campaign instead of creating a new one.
  initial?: Campaign;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const MAX_GALLERY_PHOTOS = 12;

interface PendingPhoto { file: File; preview: string; caption: string }

export default function CampaignFormModal({ onClose, onSubmit, initial }: Props) {
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
    location: initial?.location || '',
    releaseMode: (isCurrentlyScheduled ? 'schedule' : 'now') as 'now' | 'schedule',
    releaseDate: isCurrentlyScheduled && initialReleaseDate ? initialReleaseDate.toISOString().slice(0, 10) : '',
    releaseTime: isCurrentlyScheduled && initialReleaseDate ? `${pad2(initialReleaseDate.getHours())}:${pad2(initialReleaseDate.getMinutes())}` : '',
  });
  const formId = useId(); // ties each field's <label> to its input — see per-field ids below

  // Cover + gallery state. Existing photos (edit mode) can be removed; new
  // files are previewed locally and only uploaded when the form is saved.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  const [removePhotoIds, setRemovePhotoIds] = useState<string[]>([]);
  const [mediaError, setMediaError] = useState('');
  const keptExisting = (initial?.photos || []).filter(p => !removePhotoIds.includes(p.id));
  const galleryCount = keptExisting.length + newPhotos.length;

  // Free the local preview URLs when the form closes.
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    newPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = (file: File | undefined): File | null => {
    if (!file) return null;
    if (!file.type.startsWith('image/')) { setMediaError('Please choose an image file (JPG, PNG or WebP).'); return null; }
    setMediaError('');
    return file;
  };

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = pickImage(e.target.files?.[0]);
    e.target.value = '';
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  };

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_GALLERY_PHOTOS - galleryCount;
    if (files.length > room) setMediaError(`A project can have up to ${MAX_GALLERY_PHOTOS} photos — ${room > 0 ? `only the first ${room} were added.` : 'remove one to add another.'}`);
    const accepted = files.slice(0, Math.max(room, 0)).filter(f => f.type.startsWith('image/'));
    setNewPhotos(prev => [...prev, ...accepted.map(file => ({ file, preview: URL.createObjectURL(file), caption: '' }))]);
  };

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
      department: initial?.department || 'All',
      eventStartDate: form.eventStartDate,
      location: form.location,
      releaseDate,
      active: true,
      endedAt: initial?.endedAt,
    }, {
      coverFile,
      removeCover: removeCover && !coverFile,
      newPhotos: newPhotos.map(p => ({ file: p.file, caption: p.caption })),
      removePhotoIds,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h3 className="font-bold text-gray-800">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h3>
          <button onClick={onClose} aria-label="Close campaign form"><X className="w-5 h-5 text-gray-500" /></button>
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
              <label htmlFor={`${formId}-${f.key}`} className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
              <input id={`${formId}-${f.key}`} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
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
          {/* No Department field shown here — it's always "All"
              (college-wide) for new campaigns. */}
          <div>
            <label htmlFor={`${formId}-location`} className="text-xs font-semibold text-gray-500 mb-1 block">Location (where)</label>
            <input id={`${formId}-location`} type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="e.g. Asian College Gymnasium, Dumaguete City"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label htmlFor={`${formId}-eventStartDate`} className="text-xs font-semibold text-gray-500 mb-1 block">Event Start Date</label>
            <input id={`${formId}-eventStartDate`} type="date" value={form.eventStartDate} onChange={e => setForm(p => ({ ...p, eventStartDate: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
          </div>

          {/* Cover photo + project gallery — shown to donors and on the public
              homepage so people can see where the money goes. */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-gray-500 mb-1 block">Cover Photo</span>
              {(() => {
                const shown = coverPreview || (!removeCover ? initial?.coverImageUrl : undefined);
                return shown ? (
                  <div className="relative">
                    <img src={shown} alt="Campaign cover preview" className="w-full h-36 object-cover rounded-xl border border-gray-200" />
                    <button type="button" onClick={() => { if (coverPreview) URL.revokeObjectURL(coverPreview); setCoverFile(null); setCoverPreview(null); setRemoveCover(true); }}
                      aria-label="Remove cover photo" className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-1 border-2 border-dashed border-gray-300 rounded-xl py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <ImagePlus className="w-6 h-6 text-gray-400" aria-hidden="true" />
                    <span className="text-sm text-gray-500">Upload a cover photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCover} />
                  </label>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500">Project Photos <span className="font-normal text-gray-400">({galleryCount}/{MAX_GALLERY_PHOTOS}) — show where the money goes</span></span>
                {galleryCount < MAX_GALLERY_PHOTOS && (
                  <label className="flex items-center gap-1 text-xs font-semibold text-blue-700 cursor-pointer hover:underline">
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" /> Add photos
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleGallery} />
                  </label>
                )}
              </div>
              {galleryCount === 0 ? (
                <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-3 text-center">No project photos yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {keptExisting.map(p => (
                    <li key={p.id} className="relative">
                      <img src={p.url} alt={p.caption || 'Project photo'} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                      {p.caption && <p className="text-[11px] text-gray-500 truncate mt-0.5">{p.caption}</p>}
                      <button type="button" onClick={() => setRemovePhotoIds(ids => [...ids, p.id])} aria-label="Remove this photo"
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                    </li>
                  ))}
                  {newPhotos.map((p, i) => (
                    <li key={p.preview} className="relative">
                      <img src={p.preview} alt="New project photo preview" className="w-full h-24 object-cover rounded-lg border border-blue-300" />
                      <input value={p.caption} placeholder="Caption (optional)" aria-label="Photo caption"
                        onChange={e => setNewPhotos(list => list.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                        className="w-full text-[11px] border border-gray-200 rounded-md px-1.5 py-1 mt-0.5 focus:outline-none focus:border-blue-400" />
                      <button type="button" onClick={() => { URL.revokeObjectURL(p.preview); setNewPhotos(list => list.filter((_, j) => j !== i)); }} aria-label="Remove this photo"
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {mediaError && <p className="text-xs text-red-500 font-semibold" role="alert">{mediaError}</p>}
          </div>

          {showReleaseToggle ? (
            <div>
              <span className="text-xs font-semibold text-gray-500 mb-1 block">Release</span>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-3" role="radiogroup" aria-label="Release">
                {([
                  { key: 'now', label: 'Publish Now', icon: <Zap className="w-3.5 h-3.5" /> },
                  { key: 'schedule', label: 'Schedule', icon: <CalendarClock className="w-3.5 h-3.5" /> },
                ] as const).map(o => (
                  <button key={o.key} onClick={() => setForm(p => ({ ...p, releaseMode: o.key }))}
                    role="radio" aria-checked={form.releaseMode === o.key}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.releaseMode === o.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
              {form.releaseMode === 'schedule' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${formId}-releaseDate`} className="text-xs font-semibold text-gray-500 mb-1 block">Posting Date</label>
                    <input id={`${formId}-releaseDate`} type="date" value={form.releaseDate} min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setForm(p => ({ ...p, releaseDate: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-releaseTime`} className="text-xs font-semibold text-gray-500 mb-1 block">Posting Time</label>
                    <input id={`${formId}-releaseTime`} type="time" value={form.releaseTime}
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
