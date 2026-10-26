import { Heart } from 'lucide-react';
import { getEventStartStatus, type Campaign } from './DonationContext';

// Phone layout for the "Active Campaigns" list. On a wide screen this is a table;
// on a phone a table hides its Donate column off-screen, so each campaign becomes
// a card with its progress and a full-width Donate button instead.
interface Props {
  campaigns: Campaign[];
  onOpen: (c: Campaign) => void;     // tap the card -> donor list / details
  onDonate: (c: Campaign) => void;   // Donate button -> donation form
}

export default function CampaignMobileCards({ campaigns, onOpen, onDonate }: Props) {
  return (
    <div className="md:hidden space-y-3">
      {campaigns.map(c => {
        const pct = c.target > 0 ? Math.min((c.current / c.target) * 100, 100) : 0;
        const startStatus = getEventStartStatus(c.eventStartDate);
        return (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button type="button" onClick={() => onOpen(c)} className="w-full text-left">
              {c.coverImageUrl && <img src={c.coverImageUrl} alt="" loading="lazy" className="w-full h-32 object-cover" />}
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-800 leading-snug break-words min-w-0">{c.name}</p>
                  <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">{c.department === 'All' ? 'All' : c.department}</span>
                </div>
                {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-bold text-emerald-700">₱{c.current.toLocaleString()} <span className="font-normal text-gray-400">raised</span></span>
                    <span className="text-gray-500">Goal ₱{c.target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1B3A6B,#2B5BA8)' }} />
                  </div>
                  <p className="text-[11px] font-bold text-gray-600 mt-1">{pct.toFixed(0)}% funded</p>
                </div>
                {c.eventStartDate && (
                  <p className="text-[11px] mt-2 text-gray-500">
                    Event start: {c.eventStartDate}
                    {startStatus && <span className={`ml-1 font-semibold ${startStatus.startsWith('Starts') ? 'text-amber-600' : 'text-gray-500'}`}>· {startStatus}</span>}
                  </p>
                )}
              </div>
            </button>
            <div className="px-4 pb-4 pt-2">
              <button type="button" onClick={() => onDonate(c)}
                className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
                <Heart className="w-4 h-4" aria-hidden="true" /> Donate
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
