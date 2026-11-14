// =====================================================================
// FACEBOOK SECTION — "From our Facebook page" on the public homepage.
//
// RESERVED: it renders nothing until the facebook-feed Edge Function has a
// Page ID + Page access token (supabase/functions/.env.example). Once the
// token is added as a Supabase secret, the latest posts appear here on their
// own — no code change. See supabase/functions/facebook-feed/index.ts.
// =====================================================================
import { useEffect, useState } from 'react';
import { Facebook, ExternalLink } from 'lucide-react';
import { fetchFacebookFeed, type FacebookFeed } from '../../../lib/facebookFeed';
import type { Palette } from './LandingSections';

const FB_BLUE = '#1877F2';

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export default function FacebookSection({ palette }: { palette: Palette }) {
  const [feed, setFeed] = useState<FacebookFeed | null>(null);

  useEffect(() => {
    let active = true;
    fetchFacebookFeed().then(f => { if (active) setFeed(f); });
    return () => { active = false; };
  }, []);

  if (!feed) return null;

  return (
    <section className="py-12 sm:py-20 bg-white" id="facebook" aria-label="Latest from our Facebook page">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4" style={{ background: '#dce6f5', color: palette.navy }}>
            <Facebook className="w-3.5 h-3.5" aria-hidden="true" /> Facebook
          </span>
          <h2 className="text-3xl md:text-4xl text-gray-900 mb-3">Latest from our <span style={{ color: palette.navy }}>Facebook Page</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">News and announcements straight from Asian College.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {feed.posts.map(p => (
            <article key={p.id} className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col border border-gray-100 hover:shadow-xl transition-shadow">
              {p.image && <img src={p.image} alt="" loading="lazy" className="w-full h-44 object-cover bg-gray-100" />}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <p className="text-xs text-gray-400">{fmtDate(p.createdTime)}</p>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-5 break-words whitespace-pre-line">{p.message || 'View this post on Facebook.'}</p>
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: FB_BLUE }}>
                  Read on Facebook <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>

        {feed.pageUrl && (
          <div className="text-center mt-10">
            <a href={feed.pageUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-lg shadow-md hover:opacity-90 transition-opacity"
              style={{ background: FB_BLUE }}>
              <Facebook className="w-4 h-4" aria-hidden="true" /> Visit our Facebook page
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
