// Read-side helpers for the privacy-aware donor RPCs defined in
// supabase/donations_transparency.sql. The database applies the donor's
// "Show my name" / "Anonymous" choice, so nothing here (or in the browser)
// ever receives the name of a donor who chose to stay anonymous.
import { supabase } from './supabaseClient';
import { campaignPhotoUrl } from './campaignMedia';

export interface TopDonor {
  rank: number;
  displayName: string;      // "Anonymous" when the donor chose that
  batchYear: number | null;
  program: string | null;
  avatarUrl: string | null; // never set for anonymous donors
  totalAmount: number;
  donationCount: number;
  isAnonymous: boolean;
}

export async function fetchTopDonors(limit = 10, year?: number | null): Promise<TopDonor[]> {
  const { data, error } = await supabase.rpc('top_donors', { p_limit: limit, p_year: year ?? null });
  if (error || !data) {
    if (error) console.error('[donors] top_donors failed', error);
    return [];
  }
  return (data as any[]).map(r => ({
    rank: Number(r.rank),
    displayName: r.display_name,
    batchYear: r.batch_year ?? null,
    program: r.program ?? null,
    avatarUrl: r.profile_image ?? null,
    totalAmount: Number(r.total_amount),
    donationCount: Number(r.donation_count),
    isAnonymous: !!r.is_anonymous,
  }));
}

export interface DonorCredit {
  named: { name: string; batchYear: number | null; total: number }[];
  anonymousCount: number;
}

export async function fetchDonorCredits(campaignId: string): Promise<DonorCredit> {
  const { data, error } = await supabase.rpc('campaign_donor_credits', { p_campaign_id: campaignId });
  if (error || !data) {
    if (error) console.error('[donors] campaign_donor_credits failed', error);
    return { named: [], anonymousCount: 0 };
  }
  const d = data as any;
  return {
    named: (d.named || []).map((n: any) => ({ name: n.name, batchYear: n.batch_year ?? null, total: Number(n.total) })),
    anonymousCount: Number(d.anonymous_count) || 0,
  };
}

// ---- Homepage (signed-out visitors can call these) ----------------------

export interface ShowcaseCampaign {
  id: string;
  name: string;
  description: string;
  goal: number;
  raised: number;
  coverUrl: string | null;
  active: boolean;
  endedAt: string | null;
  eventStartDate: string | null;
  location: string | null;
  photos: { url: string; caption: string }[];
  donors: { name: string; total: number }[];
  anonymousCount: number;
}

export async function fetchCampaignShowcase(): Promise<ShowcaseCampaign[]> {
  const { data, error } = await supabase.rpc('public_campaign_showcase');
  if (error || !data) {
    if (error) console.error('[landing] public_campaign_showcase failed', error);
    return [];
  }
  return (data as any[]).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    goal: Number(c.goal) || 0,
    raised: Number(c.raised) || 0,
    coverUrl: c.cover_image_url || null,
    active: !!c.active,
    endedAt: c.ended_at || null,
    eventStartDate: c.event_start_date || null,
    location: c.location || null,
    photos: (c.photos || []).map((p: any) => ({ url: campaignPhotoUrl(p.path), caption: p.caption || '' })),
    donors: (c.donors || []).map((d: any) => ({ name: d.name, total: Number(d.total) })),
    anonymousCount: Number(c.anonymous_count) || 0,
  }));
}

export interface LandingStats { alumniCount: number; totalRaised: number }

export async function fetchLandingStats(): Promise<LandingStats | null> {
  const { data, error } = await supabase.rpc('public_landing_stats');
  if (error || !data) {
    if (error) console.error('[landing] public_landing_stats failed', error);
    return null;
  }
  const d = data as any;
  return { alumniCount: Number(d.alumni_count) || 0, totalRaised: Number(d.total_raised) || 0 };
}

export interface MyRank { rank: number; total: number; count: number; gapToNext: number }

// The signed-in donor's own standing (null when they have no verified donation yet).
export async function fetchMyRank(year?: number | null): Promise<MyRank | null> {
  const { data, error } = await supabase.rpc('my_donor_rank', { p_year: year ?? null });
  if (error || !data || (data as any[]).length === 0) return null;
  const r = (data as any[])[0];
  return { rank: Number(r.rank), total: Number(r.total_amount), count: Number(r.donation_count), gapToNext: Number(r.gap_to_next) };
}
