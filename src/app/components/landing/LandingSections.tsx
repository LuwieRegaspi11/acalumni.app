// =====================================================================
// LANDING SECTIONS — the live, data-driven part of the public homepage
// (LandingPage.tsx renders it and passes in its own palette):
//
//   ProjectsSection   alumni projects/campaigns: title, description, when,
//                     where and the verified funds accumulated so far.
//
// The data comes from a SECURITY DEFINER function that signed-out visitors may
// call (supabase/donations_transparency.sql + campaign_location.sql), so no
// private data is exposed: only college-wide, released campaigns are listed and
// no donor is ever named.
// =====================================================================
import { Calendar, MapPin, Handshake } from 'lucide-react';
import type { ShowcaseCampaign } from '../../../lib/donorApi';
import { money } from '../shared/DonorTransparency';

export interface Palette { navy: string; blue: string; lblue: string; red: string; panel: string }


const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });

function SectionHeading({ tag, title, accent, palette, blurb }: { tag: string; title: string; accent: string; palette: Palette; blurb?: string }) {
  return (
    <div className="text-center mb-12">
      <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4" style={{ background: '#dce6f5', color: palette.navy }}>{tag}</span>
      <h2 className="text-3xl md:text-4xl text-gray-900 mb-3">{title} <span style={{ color: palette.navy }}>{accent}</span></h2>
      {blurb && <p className="text-gray-500 max-w-2xl mx-auto">{blurb}</p>}
    </div>
  );
}

// A campaign/project on the homepage shows only the essentials: title,
// description, when, where and the funds accumulated so far — no goal,
// progress bar, donor names or Donate button.
function CampaignCard({ c, palette }: { c: ShowcaseCampaign; palette: Palette }) {
  const when = c.eventStartDate ? fmtDate(`${c.eventStartDate}T00:00:00`, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  return (
    <article className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col border border-gray-100 hover:shadow-xl transition-shadow">
      <div className={`relative bg-gray-100 ${c.coverUrl ? 'h-44' : 'h-24'}`}>
        {c.coverUrl ? (
          <img src={c.coverUrl} alt={`${c.name} cover`} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: palette.panel }}>
            <Handshake className="w-8 h-8 text-white/70" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-gray-900 font-bold leading-snug break-words">{c.name}</h3>
          {c.description && <p className="text-sm text-gray-500 mt-1 line-clamp-4 break-words">{c.description}</p>}
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /><span><span className="font-semibold text-gray-600">When:</span> {when || 'To be announced'}</span></p>
          <p className="flex items-center gap-2 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /><span className="min-w-0 break-words"><span className="font-semibold text-gray-600">Where:</span> {c.location || 'To be announced'}</span></p>
        </div>
        <div className="mt-auto rounded-lg px-3 py-2.5 flex items-center justify-between" style={{ background: '#EEF6F1', border: '1px solid #d4eadb' }}>
          <span className="text-xs font-semibold text-emerald-800">Funds accumulated</span>
          <span className="text-base font-extrabold text-emerald-700">{money(c.raised)}</span>
        </div>
      </div>
    </article>
  );
}

export function ProjectsSection({ palette, showcase }: { palette: Palette; showcase: ShowcaseCampaign[] | null }) {
  const projects = showcase || [];
  return (
    <section className="py-20 bg-gray-50" id="projects">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading tag="Your Impact" title="Alumni" accent="Projects" palette={palette}
          blurb="Projects and campaigns made possible by alumni generosity." />
        {showcase === null ? (
          <p className="text-center text-gray-400 py-12">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-14 text-center px-4">
            <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold text-gray-600">Projects will appear here</p>
            <p className="text-sm text-gray-400">Campaigns and projects posted by the Alumni Office are shown on this page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {projects.map(c => <CampaignCard key={c.id} c={c} palette={palette} />)}
          </div>
        )}
      </div>
    </section>
  );
}
