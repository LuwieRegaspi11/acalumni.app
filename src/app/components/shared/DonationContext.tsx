// =====================================================================
// DONATION CONTEXT — donations and campaigns are backed by Supabase
// (donations / donation_campaigns / campaign_expenses tables). Proof-
// of-payment files (from donors) and expense receipts (from admins
// logging where funds went) both go to the same private
// `donation-proofs` Storage bucket, not inline base64.
// Every screen that already uses useDonations() keeps working
// unchanged — only what's inside this file changed.
// =====================================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { uploadCampaignImage, removeCampaignImages, campaignPhotoUrl, type CampaignMediaChanges } from '../../../lib/campaignMedia';

export interface DonationRecord {
  id: string;
  donorId: string;
  alumniName: string;
  alumniEmail: string;
  department: string;
  campaign: string;
  amount: number;
  type: 'Cash';
  description: string;
  proofUrl: string | null; // storage PATH, not a browsable URL — resolve with getProofUrl()
  status: 'Pending' | 'Verified' | 'Rejected';
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  // The donor's consent choice: false = "Show my name", true = "Anonymous".
  // Public screens never get an anonymous donor's name (see supabase/donations_transparency.sql).
  isAnonymous: boolean;
}

// One photo in a campaign/project's gallery (shows where the money goes).
export interface CampaignPhoto {
  id: string;
  storagePath: string;
  url: string;     // public URL in the campaign-photos bucket
  caption: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  department: string;
  active: boolean;
  // Three distinct, non-overlapping date fields — never conflate these:
  location?: string; // Where the project/event happens. Purely informational.
  eventStartDate?: string; // Date the real-world event/campaign starts. Purely informational, shown to donors. Does NOT affect status.
  postedDate: string; // Auto-set when the row was created. Read-only, display-only — never used in status logic.
  releaseDate?: string; // ISO timestamp, admin-set. ALONE controls Scheduled -> Active (release_date <= now => Active; future => Scheduled). Never nulled once set — kept as a permanent "released on" record.
  endedAt?: string; // ISO timestamp — set only via endCampaign(); distinguishes an explicitly-ended campaign from one still running.
  coverImageUrl?: string; // public URL of the campaign/project cover photo
  photos: CampaignPhoto[]; // project photo gallery, in display order
}

// What the admin types into the New/Edit Campaign form; cover + gallery
// uploads travel separately as CampaignMediaChanges.
export type CampaignInput = Omit<Campaign, 'id' | 'current' | 'postedDate' | 'photos' | 'coverImageUrl'>;

// A campaign that has reached its goal.
export function isCampaignFunded(c: Campaign): boolean {
  return c.target > 0 && c.current >= c.target;
}

// Turns a campaign's `eventStartDate` (YYYY-MM-DD) into a human status
// relative to today, e.g. "Starts in 12 days", "Starts today", or
// "Started 3 days ago". Used everywhere a campaign's start date is shown
// so admins/alumni can see when it kicks off without doing date math.
// Purely informational — has no bearing on getCampaignPhase()/isCampaignLive().
export function getEventStartStatus(eventStartDate?: string): string | null {
  if (!eventStartDate) return null;
  const start = new Date(`${eventStartDate}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil((start.getTime() - Date.now()) / msPerDay);
  if (diffDays > 1) return `Starts in ${diffDays} days`;
  if (diffDays === 1) return 'Starts tomorrow';
  if (diffDays === 0) return 'Starts today';
  const elapsedDays = Math.abs(diffDays);
  return elapsedDays === 1 ? 'Started 1 day ago' : `Started ${elapsedDays} days ago`;
}

// Buckets a campaign into one of the three Campaigns-tab sub-filters.
// An explicit end always wins (History). Otherwise, if a release_date is
// set, IT ALONE decides Scheduled vs Active — a future release_date is
// Scheduled, anything else is Active — regardless of the raw `active`
// flag, so the UI is correct on load even a few seconds before the
// release_scheduled_campaigns cron job (runs every minute) catches up.
// Only a campaign with no release_date at all (legacy/manual DB edit)
// falls back to the raw `active` flag.
export type CampaignPhase = 'Active' | 'Scheduled' | 'History';

export function getCampaignPhase(c: Campaign): CampaignPhase {
  if (c.endedAt) return 'History';
  if (c.releaseDate) return new Date(c.releaseDate).getTime() > Date.now() ? 'Scheduled' : 'Active';
  return c.active ? 'Active' : 'History';
}

// Whether a campaign is currently live/visible to donors — same rule as
// getCampaignPhase() === 'Active', exposed separately so the simpler
// donor-facing screens (which just need a yes/no) don't have to import
// CampaignPhase to ask the same question.
export function isCampaignLive(c: Campaign): boolean {
  return getCampaignPhase(c) === 'Active';
}

export interface CampaignExpense {
  id: string;
  campaignId: string;
  description: string;
  amount: number;
  spentAt: string;
  loggedBy?: string;
  createdAt: string;
  receiptUrl: string | null; // storage PATH, not a browsable URL — resolve with getProofUrl()
}

export interface PaymentDestination {
  id: string;
  type: 'Bank' | 'E-Wallet' | 'Other';
  providerName: string;
  accountName: string;
  accountNumber: string;
  qrCodeUrl: string | null; // public URL (public-assets bucket) — browsable as-is
  isActive: boolean;
  sortOrder: number;
}

interface DonationCtx {
  donations: DonationRecord[];
  campaigns: Campaign[];
  expenses: CampaignExpense[];
  paymentDestinations: PaymentDestination[];
  submitDonation: (
    d: Omit<DonationRecord, 'id' | 'status' | 'submittedAt' | 'proofUrl' | 'donorId'>,
    proofFile?: File | null
  ) => Promise<string | null>; // resolves with the new donation's id (null if it could not be saved)
  // A donor changing their "Show my name" / "Anonymous" choice after the fact.
  setDonationAnonymity: (id: string, anonymous: boolean) => Promise<boolean>;
  verifyDonation: (id: string, verifiedBy: string) => Promise<void>;
  rejectDonation: (id: string, reason: string, verifiedBy: string) => Promise<void>;
  addCampaign: (c: CampaignInput, media?: CampaignMediaChanges) => Promise<void>;
  updateCampaign: (id: string, c: CampaignInput, media?: CampaignMediaChanges) => Promise<void>;
  releaseCampaignNow: (id: string) => Promise<void>;
  endCampaign: (id: string) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  deleteDonation: (id: string) => Promise<void>;
  addExpense: (campaignId: string, description: string, amount: number, loggedBy: string, receiptFile?: File | null) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getProofUrl: (path: string) => Promise<string | null>;
  addPaymentDestination: (d: Omit<PaymentDestination, 'id' | 'sortOrder' | 'qrCodeUrl'>, qrFile?: File | null) => Promise<void>;
  updatePaymentDestination: (id: string, d: Omit<PaymentDestination, 'id' | 'sortOrder' | 'qrCodeUrl'>, qrFile?: File | null) => Promise<void>;
  deletePaymentDestination: (id: string) => Promise<void>;
  movePaymentDestination: (id: string, direction: 'up' | 'down') => Promise<void>;
}

const Ctx = createContext<DonationCtx>({
  donations: [], campaigns: [], expenses: [], paymentDestinations: [],
  submitDonation: async () => null, setDonationAnonymity: async () => false, verifyDonation: async () => {},
  rejectDonation: async () => {}, addCampaign: async () => {},
  updateCampaign: async () => {}, releaseCampaignNow: async () => {},
  endCampaign: async () => {},
  deleteCampaign: async () => {}, deleteDonation: async () => {},
  addExpense: async () => {}, deleteExpense: async () => {},
  getProofUrl: async () => null,
  addPaymentDestination: async () => {}, updatePaymentDestination: async () => {},
  deletePaymentDestination: async () => {}, movePaymentDestination: async () => {},
});

const statusMap: Record<string, DonationRecord['status']> = {
  pending: 'Pending', verified: 'Verified', rejected: 'Rejected',
};

const PROOFS_BUCKET = 'donation-proofs';
const PUBLIC_BUCKET = 'public-assets';

// Every money column in the donation feature is numeric(12,2) — round to
// cents on the way in so a stray float (e.g. from a decimal multiplication
// upstream) never gets sent as-is and surprises the DB's own rounding.
const roundMoney = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export function DonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expenses, setExpenses] = useState<CampaignExpense[]>([]);
  const [paymentDestinations, setPaymentDestinations] = useState<PaymentDestination[]>([]);

  const loadExpenses = async () => {
    const { data } = await supabase.from('campaign_expenses').select('*').order('spent_at', { ascending: false });
    if (!data) return;
    setExpenses(data.map((e: any) => ({
      id: e.id, campaignId: e.campaign_id, description: e.description,
      amount: Number(e.amount), spentAt: e.spent_at, loggedBy: e.logged_by || undefined,
      createdAt: e.created_at, receiptUrl: e.receipt_url || null,
    })));
  };

  const loadCampaigns = async () => {
    const { data } = await supabase.from('donation_campaigns').select('*').order('posted_date', { ascending: false });
    if (!data) return;
    // "current" = sum of verified donations for this campaign
    const { data: totals } = await supabase.from('donations').select('campaign_id, amount').eq('status', 'verified');
    // Gallery rows (campaign_photos). Missing table/RLS denial just means no photos.
    const { data: photoRows } = await supabase.from('campaign_photos').select('id, campaign_id, storage_path, caption')
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    const photosByCampaign: Record<string, CampaignPhoto[]> = {};
    (photoRows || []).forEach((p: any) => {
      (photosByCampaign[p.campaign_id] ||= []).push({
        id: p.id, storagePath: p.storage_path, url: campaignPhotoUrl(p.storage_path), caption: p.caption || '',
      });
    });
    const sums: Record<string, number> = {};
    (totals || []).forEach(t => { if (t.campaign_id) sums[t.campaign_id] = (sums[t.campaign_id] || 0) + Number(t.amount); });
    setCampaigns(data.map((c: any) => ({
      id: c.id, name: c.name, description: c.description || '',
      target: Number(c.goal_amount) || 0, current: sums[c.id] || 0,
      department: c.department || 'All', active: c.active,
      eventStartDate: c.event_start_date || undefined,
      location: c.location || undefined,
      postedDate: c.posted_date,
      releaseDate: c.release_date || undefined,
      endedAt: c.ended_at || undefined,
      coverImageUrl: c.cover_image_url || undefined,
      photos: photosByCampaign[c.id] || [],
    })));
  };

  const loadDonations = async () => {
    const { data } = await supabase
      .from('donations')
      .select('*, donor:profiles!donations_donor_id_fkey(name, email, department), campaign:donation_campaigns(name)')
      .order('created_at', { ascending: false });
    if (!data) return;
    setDonations(data.map((d: any) => ({
      id: d.id,
      donorId: d.donor_id,
      alumniName: d.donor?.name || 'Unknown',
      alumniEmail: d.donor?.email || '',
      department: d.donor?.department || '',
      campaign: d.campaign?.name || '',
      amount: Number(d.amount),
      type: 'Cash',
      description: d.description || '',
      proofUrl: d.proof_url || null,
      status: statusMap[d.status] || 'Pending',
      submittedAt: d.created_at,
      verifiedAt: d.verified_at || undefined,
      verifiedBy: d.verified_by || undefined,
      rejectionReason: d.rejection_reason || undefined,
      isAnonymous: !!d.is_anonymous,
    })));
  };

  const loadPaymentDestinations = async () => {
    const { data } = await supabase.from('payment_destinations').select('*').order('sort_order', { ascending: true });
    if (!data) return;
    setPaymentDestinations(data.map((p: any) => ({
      id: p.id, type: p.type, providerName: p.provider_name,
      accountName: p.account_name, accountNumber: p.account_number,
      qrCodeUrl: p.qr_code_url || null, isActive: p.is_active, sortOrder: p.sort_order,
    })));
  };

  // Reload when the signed-in user changes: these tables are protected by row-level
  // security, so the load that ran at page start (before sign-in) came back empty.
  useEffect(() => { loadCampaigns(); loadDonations(); loadExpenses(); loadPaymentDestinations(); }, [user?.id]);

  // Uploads a proof-of-payment (or expense receipt) file into the
  // uploader's own folder in the private bucket and returns the storage
  // path (not a public URL). Reused for both donor proofs and admin
  // expense receipts — same bucket, same signed-URL-on-read pattern.
  const uploadProof = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(PROOFS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      console.error('[donations] proof upload failed', error);
      return null;
    }
    return path;
  };

  // Resolves a stored proof path to a short-lived signed URL for viewing.
  // Safe to call with an already-full URL too (returns it unchanged).
  const getProofUrl = async (path: string): Promise<string | null> => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const { data, error } = await supabase.storage.from(PROOFS_BUCKET).createSignedUrl(path, 60 * 5);
    if (error) {
      console.error('[donations] failed to sign proof url', error);
      return null;
    }
    return data?.signedUrl || null;
  };

  const submitDonation = async (
    d: Omit<DonationRecord, 'id' | 'status' | 'submittedAt' | 'proofUrl' | 'donorId'>,
    proofFile?: File | null
  ): Promise<string | null> => {
    if (!user) return null;
    const campaign = campaigns.find(c => c.name === d.campaign);

    let proofPath: string | null = null;
    if (proofFile) {
      proofPath = await uploadProof(proofFile);
    }

    const { data: inserted, error } = await supabase.from('donations').insert({
      donor_id: user.id,
      campaign_id: campaign?.id,
      amount: roundMoney(d.amount),
      type: d.type,
      description: d.description || null,
      proof_url: proofPath,
      is_anonymous: !!d.isAnonymous,
      status: 'pending',
    }).select('id').single();
    if (error) console.error('[donations] submit failed', error);
    await loadDonations();
    await loadCampaigns();
    return inserted?.id ?? null;
  };

  const setDonationAnonymity = async (id: string, anonymous: boolean): Promise<boolean> => {
    const { error } = await supabase.rpc('set_donation_anonymity', { p_donation_id: id, p_anonymous: anonymous });
    if (error) { console.error('[donations] set_donation_anonymity failed', error); return false; }
    await loadDonations();
    return true;
  };

  const verifyDonation = async (id: string, verifiedBy: string) => {
    await supabase.from('donations').update({
      status: 'verified',
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    }).eq('id', id);
    await loadDonations();
    await loadCampaigns();
  };

  const rejectDonation = async (id: string, reason: string, verifiedBy: string) => {
    await supabase.from('donations').update({
      status: 'rejected',
      rejection_reason: reason || null,
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    }).eq('id', id);
    await loadDonations();
  };

  // release_date is the ONLY thing that decides Scheduled vs Active (see
  // getCampaignPhase). If the caller didn't supply one — i.e. "Publish
  // Now" rather than "Schedule" — it's stamped to "now" so the field is
  // always populated (never nulled) and there's always a real "Releases
  // On" value to show, instead of falling back to the raw `active` flag.
  // Cover + gallery changes for one campaign: uploads new files to the
  // campaign-photos bucket, inserts/deletes campaign_photos rows, and keeps
  // donation_campaigns.cover_image_url in step. Photo problems are logged
  // but never undo the campaign save itself.
  const applyCampaignMedia = async (campaignId: string, media: CampaignMediaChanges | undefined, existing?: Campaign) => {
    if (!media) return;
    try {
      const pathsToDelete: string[] = [];
      if (media.removeCover || media.coverFile) {
        const oldCover = existing?.coverImageUrl;
        if (oldCover) {
          const marker = '/campaign-photos/';
          const idx = oldCover.indexOf(marker);
          if (idx >= 0) pathsToDelete.push(decodeURIComponent(oldCover.slice(idx + marker.length).split('?')[0]));
        }
        if (media.coverFile) {
          const path = await uploadCampaignImage(campaignId, media.coverFile);
          await supabase.from('donation_campaigns').update({ cover_image_url: campaignPhotoUrl(path) }).eq('id', campaignId);
        } else {
          await supabase.from('donation_campaigns').update({ cover_image_url: null }).eq('id', campaignId);
        }
      }
      if (media.removePhotoIds.length > 0) {
        const doomed = (existing?.photos || []).filter(p => media.removePhotoIds.includes(p.id));
        await supabase.from('campaign_photos').delete().in('id', media.removePhotoIds);
        pathsToDelete.push(...doomed.map(p => p.storagePath));
      }
      if (media.newPhotos.length > 0) {
        const baseOrder = (existing?.photos.length || 0);
        const rows: { campaign_id: string; storage_path: string; caption: string | null; sort_order: number }[] = [];
        for (let i = 0; i < media.newPhotos.length; i++) {
          const { file, caption } = media.newPhotos[i];
          const path = await uploadCampaignImage(campaignId, file);
          rows.push({ campaign_id: campaignId, storage_path: path, caption: caption.trim() || null, sort_order: baseOrder + i });
        }
        const { error } = await supabase.from('campaign_photos').insert(rows);
        if (error) console.error('[donations] gallery insert failed', error);
      }
      await removeCampaignImages(pathsToDelete);
    } catch (err) {
      console.error('[donations] campaign photo update failed', err);
    }
  };

  const addCampaign = async (c: CampaignInput, media?: CampaignMediaChanges) => {
    const releaseDate = c.releaseDate || new Date().toISOString();
    const isFutureRelease = new Date(releaseDate).getTime() > Date.now();
    const { data: inserted } = await supabase.from('donation_campaigns').insert({
      name: c.name, description: c.description, goal_amount: roundMoney(c.target),
      department: c.department, event_start_date: c.eventStartDate || null,
      // Only sent when set, so saving a campaign keeps working even before
      // supabase/campaign_location.sql has added the column.
      ...(c.location?.trim() ? { location: c.location.trim() } : {}),
      active: !isFutureRelease,
      release_date: releaseDate,
    }).select('id').single();
    if (inserted?.id) await applyCampaignMedia(inserted.id, media);
    await loadCampaigns();
  };

  const updateCampaign = async (id: string, c: CampaignInput, media?: CampaignMediaChanges) => {
    const releaseDate = c.releaseDate || new Date().toISOString();
    const isFutureRelease = new Date(releaseDate).getTime() > Date.now();
    // An explicit end always wins — editing other fields on an ended
    // campaign must not silently resurrect it just because its
    // release_date happens to be in the past.
    await supabase.from('donation_campaigns').update({
      name: c.name, description: c.description, goal_amount: roundMoney(c.target),
      department: c.department, event_start_date: c.eventStartDate || null,
      ...((c.location?.trim() || campaigns.find(x => x.id === id)?.location) ? { location: c.location?.trim() || null } : {}),
      active: c.endedAt ? false : !isFutureRelease,
      release_date: releaseDate,
    }).eq('id', id);
    await applyCampaignMedia(id, media, campaigns.find(x => x.id === id));
    await loadCampaigns();
  };

  // Publishes a scheduled campaign immediately, bypassing its release_date.
  const releaseCampaignNow = async (id: string) => {
    await supabase.from('donation_campaigns').update({
      active: true, release_date: new Date().toISOString(), ended_at: null,
    }).eq('id', id);
    await loadCampaigns();
  };

  // Explicitly ends a campaign (moves it into the History filter) without
  // deleting it or its donation/expense records — distinct from
  // deleteCampaign, and not something inferred from the event start date.
  const endCampaign = async (id: string) => {
    await supabase.from('donation_campaigns').update({
      active: false, ended_at: new Date().toISOString(),
    }).eq('id', id);
    await loadCampaigns();
  };

  // "Delete" archives the campaign into History (same as endCampaign)
  // rather than removing the row — its donations and expenses stay
  // linked and the record stays visible under the History filter,
  // instead of vanishing outright.
  const deleteCampaign = async (id: string) => {
    await supabase.from('donation_campaigns').update({
      active: false, ended_at: new Date().toISOString(),
    }).eq('id', id);
    await loadCampaigns();
    await loadDonations();
  };

  const deleteDonation = async (id: string) => {
    await supabase.from('donations').delete().eq('id', id);
    await loadDonations();
    await loadCampaigns();
  };

  const addExpense = async (campaignId: string, description: string, amount: number, loggedBy: string, receiptFile?: File | null) => {
    let receiptPath: string | null = null;
    if (receiptFile) {
      receiptPath = await uploadProof(receiptFile);
    }
    await supabase.from('campaign_expenses').insert({
      campaign_id: campaignId, description, amount: roundMoney(amount), logged_by: loggedBy, receipt_url: receiptPath,
    });
    await loadExpenses();
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('campaign_expenses').delete().eq('id', id);
    await loadExpenses();
  };

  // QR codes go in the public 'public-assets' bucket (same bucket as the
  // university logo) so donors can view them without a signed URL.
  const uploadPaymentQr = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `payment-qr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, file, { upsert: true });
    if (error) {
      console.error('[donations] QR upload failed', error);
      return null;
    }
    const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const addPaymentDestination = async (d: Omit<PaymentDestination, 'id' | 'sortOrder' | 'qrCodeUrl'>, qrFile?: File | null) => {
    let qrCodeUrl: string | null = null;
    if (qrFile) qrCodeUrl = await uploadPaymentQr(qrFile);
    const nextSortOrder = paymentDestinations.length
      ? Math.max(...paymentDestinations.map(p => p.sortOrder)) + 1
      : 0;
    await supabase.from('payment_destinations').insert({
      type: d.type, provider_name: d.providerName, account_name: d.accountName,
      account_number: d.accountNumber, qr_code_url: qrCodeUrl, is_active: d.isActive,
      sort_order: nextSortOrder,
    });
    await loadPaymentDestinations();
  };

  const updatePaymentDestination = async (id: string, d: Omit<PaymentDestination, 'id' | 'sortOrder' | 'qrCodeUrl'>, qrFile?: File | null) => {
    const patch: Record<string, any> = {
      type: d.type, provider_name: d.providerName, account_name: d.accountName,
      account_number: d.accountNumber, is_active: d.isActive,
    };
    if (qrFile) {
      const url = await uploadPaymentQr(qrFile);
      if (url) patch.qr_code_url = url;
    }
    await supabase.from('payment_destinations').update(patch).eq('id', id);
    await loadPaymentDestinations();
  };

  const deletePaymentDestination = async (id: string) => {
    await supabase.from('payment_destinations').delete().eq('id', id);
    await loadPaymentDestinations();
  };

  // Swaps sort_order with the neighboring entry to move an item up/down
  // the list, rather than renumbering everything.
  const movePaymentDestination = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...paymentDestinations].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(p => p.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    await Promise.all([
      supabase.from('payment_destinations').update({ sort_order: b.sortOrder }).eq('id', a.id),
      supabase.from('payment_destinations').update({ sort_order: a.sortOrder }).eq('id', b.id),
    ]);
    await loadPaymentDestinations();
  };

  return (
    <Ctx.Provider value={{
      donations, campaigns, expenses, paymentDestinations, submitDonation, setDonationAnonymity, verifyDonation, rejectDonation,
      addCampaign, updateCampaign, releaseCampaignNow, endCampaign, deleteCampaign, deleteDonation, addExpense, deleteExpense, getProofUrl,
      addPaymentDestination, updatePaymentDestination, deletePaymentDestination, movePaymentDestination,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDonations = () => useContext(Ctx);
