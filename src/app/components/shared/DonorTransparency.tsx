import React, { useEffect, useId, useState } from 'react';
import { Heart, Trophy, X, ChevronLeft, ChevronRight, EyeOff, Eye } from 'lucide-react';
import { fetchTopDonors, fetchDonorCredits, fetchMyRank, type TopDonor, type DonorCredit, type MyRank } from '../../../lib/donorApi';
import { useAuth } from '../AuthContext';
import { useDonations } from './DonationContext';
import type { CampaignPhoto } from './DonationContext';
import { SkeletonLines } from './Skeleton';

// =====================================================================
// DONOR TRANSPARENCY PIECES — small, reusable UI used by the Donation
// Portal, the batch rep's Donation Center, the campaign donor modal and the
// public homepage:
//   DonorVisibilityChoice  "Show my name" / "Anonymous" radio pair
//   DonationThankYou       thank-you dialog shown right after donating
//   TopDonorsLeaderboard   consent-aware Top Donors list
//   DonatedBy              "Donated by …" credit line for a funded project
//   CampaignGallery        project photo strip with a lightbox
// The database applies the consent rule (supabase/donations_transparency.sql);
// these components only render what it returns.
// =====================================================================

export const money = (n: number) => `₱${Number(n || 0).toLocaleString()}`;

// ---- "Show my name" / "Anonymous" ----------------------------------------

export function DonorVisibilityChoice({ anonymous, onChange }: { anonymous: boolean; onChange: (anonymous: boolean) => void }) {
  const name = useId();
  const options = [
    { value: false, icon: Eye, label: 'Show my name', hint: 'Your name may appear in the Top Donors list and as a “Donated by” credit on the project.' },
    { value: true, icon: EyeOff, label: 'Anonymous', hint: 'You will appear as “Anonymous”. The Alumni Head still sees who donated, for verification.' },
  ];
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-gray-500 mb-1">How should we credit you?</legend>
      <div className="space-y-2">
        {options.map(o => (
          <label key={String(o.value)} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${anonymous === o.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="radio" name={name} checked={anonymous === o.value} onChange={() => onChange(o.value)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-blue-700" />
            <span className="text-sm text-gray-800 leading-tight">
              <span className="flex items-center gap-1.5 font-semibold"><o.icon className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />{o.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---- Thank-you after a donation -------------------------------------------

export interface ThankYouInfo {
  donorName: string;
  amount: number;
  campaign: string;
  reference: string;
  anonymous: boolean;
}

export function DonationThankYou({ info, onClose }: { info: ThankYouInfo; onClose: () => void }) {
  const firstName = info.donorName.trim().split(/\s+/)[0] || 'friend';
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Thank you for your donation">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4"><X className="w-5 h-5 text-gray-400" /></button>
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-rose-500" fill="currentColor" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Thank you, {firstName}!</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Your generous gift of <strong>{money(info.amount)}</strong> to <strong>{info.campaign}</strong> means the world to
          your alma mater and to the students and alumni it will help.
        </p>
        <div className="mt-4 text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 text-gray-500 space-y-1">
          <p>Reference no. <span className="font-mono font-semibold text-gray-700">{info.reference}</span></p>
          <p>The Alumni Head will verify your proof of payment and you’ll be notified here once it’s confirmed.</p>
          <p>{info.anonymous ? 'You chose to remain anonymous — your name will not be shown publicly.' : 'You chose to show your name — you may be credited as a donor once your gift is confirmed.'}</p>
        </div>
        <button onClick={onClose} className="mt-6 w-full py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ---- Top Donors leaderboard (podium + ranked list) ---------------------------
// Glass-style panel on a navy/blue backdrop with gold accents: ranks 1-3 stand
// on a podium (2nd left, 1st raised in the centre with a trophy, 3rd right),
// ranks 4+ follow as a list. Only verified donations are counted; donors who
// chose "Anonymous" show as "Anonymous" with a neutral avatar.

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

function DonorAvatar({ donor, size, ring }: { donor: TopDonor; size: number; ring: string }) {
  const style = { width: size, height: size, boxShadow: `0 0 0 3px ${ring}` } as const;
  if (donor.isAnonymous) {
    return <div className="rounded-full bg-white/15 flex items-center justify-center text-white/70 flex-shrink-0" style={style}><EyeOff style={{ width: size * 0.45, height: size * 0.45 }} aria-hidden="true" /></div>;
  }
  if (donor.avatarUrl) {
    return <img src={donor.avatarUrl} alt="" loading="lazy" className="rounded-full object-cover flex-shrink-0 bg-white/20" style={style} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ ...style, background: 'linear-gradient(135deg,#2B5BA8,#5B9BD5)', fontSize: size * 0.34 }}>{initialsOf(donor.displayName)}</div>
  );
}

// ---- Champions' podium with statues (2nd | 1st | 3rd) --------------------------
// Like a championship podium: three statues stand on numbered blocks, the winner
// raised in the middle. Gold, silver and bronze mark the places; the first-place
// statue wears a crown and raises both arms.

export interface PodiumItem {
  place: 1 | 2 | 3;
  title: string;      // donor name ("Anonymous" when they chose that)
  subtitle: string;   // e.g. "Batch 2024" / "Anonymous donor"
  amount: number;
  note?: string;      // small extra line, e.g. "Keep anonymous"
}

const METALS = {
  1: { stops: ['#FFF3B0', '#F5C542', '#B8860B'], block: 'linear-gradient(180deg,#FBE08A 0%,#E9B52B 55%,#C28E12 100%)', num: '#6b4b00', height: 132, statue: 66, maxStatue: 150 },
  2: { stops: ['#FFFFFF', '#CBD3DE', '#7B8794'], block: 'linear-gradient(180deg,#EEF1F5 0%,#BCC5D1 55%,#8A94A3 100%)', num: '#3a4350', height: 100, statue: 56, maxStatue: 128 },
  3: { stops: ['#F8D7B0', '#CD7F32', '#7A4A1A'], block: 'linear-gradient(180deg,#EBC08E 0%,#C58540 55%,#8A5522 100%)', num: '#4a2a0c', height: 76, statue: 56, maxStatue: 128 },
} as const;

function StatueFigure({ place }: { place: 1 | 2 | 3 }) {
  const m = METALS[place];
  const id = `statue-metal-${place}`;
  const limb = { stroke: `url(#${id})`, strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  // arm poses: 1 = both arms raised (victory), 2 = one arm up / hand on hip, 3 = arms relaxed
  const arms = place === 1
    ? (<><path d="M36 48 L16 14" {...limb} /><path d="M64 48 L84 14" {...limb} /></>)
    : place === 2
      ? (<><path d="M36 48 L20 22" {...limb} /><path d="M64 48 L78 68 L62 84" {...limb} /></>)
      : (<><path d="M36 48 L22 88" {...limb} /><path d="M64 48 L78 88" {...limb} /></>);
  return (
    <svg viewBox="0 0 100 162" role="img" aria-label={`Statue for place ${place}`}
      style={{ width: `${m.statue}%`, maxWidth: m.maxStatue, height: 'auto', display: 'block', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.45))', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={m.stops[0]} /><stop offset="0.5" stopColor={m.stops[1]} /><stop offset="1" stopColor={m.stops[2]} />
        </linearGradient>
      </defs>
      {arms}
      {/* legs + feet */}
      <path d="M45 96 L42 152" {...limb} /><path d="M55 96 L58 152" {...limb} />
      <ellipse cx="40" cy="157" rx="9" ry="4" fill={`url(#${id})`} /><ellipse cx="60" cy="157" rx="9" ry="4" fill={`url(#${id})`} />
      {/* torso, neck, head */}
      <path d="M32 46 Q50 38 68 46 L62 98 Q50 103 38 98 Z" fill={`url(#${id})`} />
      <rect x="45" y="34" width="10" height="9" rx="3" fill={`url(#${id})`} />
      <circle cx="50" cy="24" r="12" fill={`url(#${id})`} />
      {/* soft highlight so it reads as polished metal */}
      <path d="M38 50 Q42 46 48 46 L46 92 Q42 94 40 92 Z" fill="#fff" opacity=".28" />
      <ellipse cx="45" cy="20" rx="4" ry="6" fill="#fff" opacity=".3" />
      {place === 1 && (
        <path d="M37 14 L40 2 L45 10 L50 -2 L55 10 L60 2 L63 14 Z" fill="#F5C542" stroke="#B8860B" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function StatueSpot({ item }: { item?: PodiumItem }) {
  if (!item) return <div className="flex-1" aria-hidden="true" />;
  const m = METALS[item.place];
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <div className="w-full flex justify-center pt-3">
        <StatueFigure place={item.place} />
      </div>
      {/* the numbered block the statue stands on */}
      <div className="w-full rounded-t-lg flex items-center justify-center border border-white/50 shadow-[0_8px_20px_rgba(0,0,0,.3)] -mt-px"
        style={{ height: m.height, background: m.block }}>
        <span className="font-extrabold leading-none" style={{ fontSize: item.place === 1 ? 54 : 44, color: m.num, textShadow: '0 1px 0 rgba(255,255,255,.5)' }}>{item.place}</span>
      </div>
      <div className="w-full mt-2 text-center">
        <p className={`text-sm font-bold text-white truncate px-1 ${item.title === 'Anonymous' ? 'italic text-white/80' : ''}`}>{item.title}</p>
        <p className="text-[11px] text-blue-100/80 truncate px-1">{item.subtitle || ' '}</p>
        <p className="text-sm font-extrabold mt-0.5" style={{ color: '#F5C542' }}>{money(item.amount)}</p>
        {item.note && <p className="text-[10px] text-blue-100/60 mt-0.5">{item.note}</p>}
      </div>
    </div>
  );
}

export function StatuePodium({ items }: { items: PodiumItem[] }) {
  const at = (p: 1 | 2 | 3) => items.find(i => i.place === p);
  return (
    <div className="flex items-end gap-2 sm:gap-3 pt-2 w-full max-w-2xl mx-auto">
      <StatueSpot item={at(2)} />
      <StatueSpot item={at(1)} />
      <StatueSpot item={at(3)} />
    </div>
  );
}

// Dark glass panel used behind the podium (alumni leaderboard + admin ranking).
export function PodiumPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl"
      style={{ background: 'linear-gradient(145deg,#0f2447 0%,#1B3A6B 45%,#2B5BA8 100%)' }}>
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(245,197,66,.28),transparent 70%)' }} />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(91,155,213,.35),transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5" style={{ color: '#F5C542' }} aria-hidden="true" />
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-blue-100/80 mb-4">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

// "Your rank" strip — connects the Donation Center to the ranking: where the
// signed-in alumnus stands, and how much more reaches the next rank.
function MyRankCard({ mine, onDonate }: { mine: MyRank | null; onDonate?: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-white/25 bg-white/10 backdrop-blur px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#FBE08A,#C28E12)', color: '#6b4b00' }}>
        {mine ? `#${mine.rank}` : '—'}
      </div>
      <div className="flex-1 min-w-0 text-sm">
        {mine ? (
          <>
            <p className="font-bold text-white">Your rank: #{mine.rank} · {money(mine.total)} given</p>
            <p className="text-xs text-blue-100/80">
              {mine.rank === 1 ? 'You are leading the board — thank you!' : `${money(mine.gapToNext)} more moves you up a rank.`}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-white">You’re not on the board yet</p>
            <p className="text-xs text-blue-100/80">Your rank appears once the Alumni Head confirms your first donation.</p>
          </>
        )}
      </div>
      {onDonate && (
        <button onClick={onDonate} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: '#F5C542', color: '#4a3500' }}>Donate</button>
      )}
    </div>
  );
}

export function TopDonorsLeaderboard({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const [donors, setDonors] = useState<TopDonor[] | null>(null);
  const [mine, setMine] = useState<MyRank | null>(null);
  const [year, setYear] = useState<string>('all');
  const thisYear = new Date().getFullYear();
  const { user } = useAuth();
  const { donations } = useDonations();
  // Refresh when any of the signed-in donor's donations change status (e.g. the
  // admin verifies one) so the ranking and "Your rank" stay current.
  const donationsKey = donations.map(d => `${d.id}:${d.status}`).join('|');
  const showMine = !compact && !!user && user.role !== 'admin';
  useEffect(() => {
    let active = true;
    const y = year === 'all' ? null : Number(year);
    fetchTopDonors(limit, y).then(rows => { if (active) setDonors(rows); });
    if (showMine) fetchMyRank(y).then(m => { if (active) setMine(m); });
    return () => { active = false; };
  }, [limit, year, donationsKey, showMine]);

  const byRank = (n: number) => donors?.find(d => d.rank === n);
  const rest = (donors || []).filter(d => d.rank > 3);

  return (
    <section aria-label="Top donors" className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl"
      style={{ background: 'linear-gradient(145deg,#0f2447 0%,#1B3A6B 45%,#2B5BA8 100%)' }}>
      {/* soft light blobs behind the glass */}
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(245,197,66,.28),transparent 70%)' }} />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(91,155,213,.35),transparent 70%)' }} />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5" style={{ color: '#F5C542' }} aria-hidden="true" />
          <h3 className="font-bold text-lg">Top Donors</h3>
          {!compact && (
            <select value={year} onChange={e => setYear(e.target.value)} aria-label="Ranking period"
              className="ml-auto text-xs rounded-lg px-2 py-1 bg-white/15 border border-white/25 text-white focus:outline-none focus:border-white/60">
              <option value="all" className="text-gray-800">All time</option>
              {[thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y} className="text-gray-800">{y}</option>)}
            </select>
          )}
        </div>
        <p className="text-xs text-blue-100/80 mb-4">Alumni whose confirmed gifts are building the future of Asian College.</p>

        {donors === null ? (
          <SkeletonLines rows={4} tone="glass" />
        ) : donors.length === 0 ? (
          <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur p-6 text-center">
            <Heart className="w-8 h-8 mx-auto mb-2" style={{ color: '#F5C542' }} aria-hidden="true" />
            <p className="text-sm text-white/90">No confirmed donations yet — be the first to give back.</p>
          </div>
        ) : (
          <>
            {/* Podium: 2nd | 1st (raised) | 3rd */}
            <StatuePodium items={([1, 2, 3] as const).flatMap(p => {
              const d = byRank(p);
              return d ? [{
                place: p, title: d.displayName,
                subtitle: d.isAnonymous ? 'Anonymous donor' : (d.batchYear ? `Batch ${d.batchYear}` : d.program || ''),
                amount: d.totalAmount,
              }] : [];
            })} />

            {showMine && <MyRankCard mine={mine} />}

            {/* Rank 4 downward */}
            {rest.length > 0 && (
              <ol className="mt-4 space-y-2">
                {rest.map(d => (
                  <li key={`${d.rank}-${d.displayName}`}
                    className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur px-3 py-2.5">
                    <span className="w-7 text-center text-sm font-bold text-blue-100/80">{d.rank}</span>
                    <DonorAvatar donor={d} size={38} ring="rgba(255,255,255,.35)" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${d.isAnonymous ? 'italic text-white/80' : 'text-white'}`}>{d.displayName}</p>
                      <p className="text-xs text-blue-100/70 truncate">
                        {d.isAnonymous ? 'Anonymous donor' : [d.batchYear ? `Batch ${d.batchYear}` : null, d.program].filter(Boolean).join(' · ') || ' '}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#F5C542' }}>{money(d.totalAmount)}</p>
                      <p className="text-[11px] text-blue-100/60">{d.donationCount} {d.donationCount === 1 ? 'gift' : 'gifts'}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <p className="text-[11px] text-blue-100/60 mt-4">Only donations confirmed by the Alumni Head are counted. Donors who chose “Anonymous” are never named. Every gift inspires the next!</p>
      </div>
    </section>
  );
}

// ---- "Donated by" credit -----------------------------------------------------

export function DonatedByLine({ named, anonymousCount, className = '' }: { named: { name: string }[]; anonymousCount: number; className?: string }) {
  if (named.length === 0 && anonymousCount === 0) return null;
  const MAX = 6;
  const shown = named.slice(0, MAX).map(n => n.name);
  const hiddenNamed = named.length - shown.length;
  const extras: string[] = [];
  if (hiddenNamed > 0) extras.push(`${hiddenNamed} more`);
  if (anonymousCount > 0) extras.push(`${anonymousCount} anonymous ${anonymousCount === 1 ? 'donor' : 'donors'}`);
  const text = [...shown, ...extras];
  const joined = text.length > 1 ? `${text.slice(0, -1).join(', ')} and ${text[text.length - 1]}` : text[0];
  return (
    <p className={`text-xs text-gray-600 ${className}`}>
      <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><Heart className="w-3 h-3" fill="currentColor" aria-hidden="true" /> Donated by</span>{' '}
      {joined}
    </p>
  );
}

// Fetches and renders the credit for one campaign (in-portal screens).
export function DonatedBy({ campaignId, className }: { campaignId: string; className?: string }) {
  const [credit, setCredit] = useState<DonorCredit | null>(null);
  useEffect(() => {
    let active = true;
    fetchDonorCredits(campaignId).then(c => { if (active) setCredit(c); });
    return () => { active = false; };
  }, [campaignId]);
  if (!credit) return null;
  return <DonatedByLine named={credit.named} anonymousCount={credit.anonymousCount} className={className} />;
}

// ---- Project photo gallery ---------------------------------------------------

export function CampaignGallery({ photos, title }: { photos: Pick<CampaignPhoto, 'url' | 'caption'>[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen(i => (i === null ? i : (i + 1) % photos.length));
      if (e.key === 'ArrowLeft') setOpen(i => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  if (photos.length === 0) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label={`${title} photos`}>
        {photos.map((p, i) => (
          <button key={p.url} role="listitem" onClick={() => setOpen(i)}
            className="flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90"
            aria-label={`View photo ${i + 1} of ${photos.length}${p.caption ? `: ${p.caption}` : ''}`}>
            <img src={p.url} alt={p.caption || `${title} photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${title} photo viewer`}
          onClick={() => setOpen(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(null)} aria-label="Close photo viewer" className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            <img src={photos[open].url} alt={photos[open].caption || `${title} photo ${open + 1}`} className="max-w-full max-h-[75vh] mx-auto rounded-xl object-contain" />
            {photos[open].caption && <p className="text-center text-white text-sm mt-3">{photos[open].caption}</p>}
            {photos.length > 1 && (
              <>
                <button onClick={() => setOpen((open - 1 + photos.length) % photos.length)} aria-label="Previous photo"
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-12 p-2 rounded-full bg-white/20 text-white hover:bg-white/30"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={() => setOpen((open + 1) % photos.length)} aria-label="Next photo"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-12 p-2 rounded-full bg-white/20 text-white hover:bg-white/30"><ChevronRight className="w-5 h-5" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
