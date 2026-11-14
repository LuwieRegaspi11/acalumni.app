import { Trophy } from 'lucide-react';
import { TopDonorsLeaderboard } from './DonorTransparency';

// Donor Ranking module for alumni and batch representatives (the admin has its
// own full version in admin/DonorRanking.tsx). Verified donations only.
export default function DonorRankingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" aria-hidden="true" /> Donor Ranking
        </h2>
        <p className="text-gray-500 text-sm mt-1">Top donors, ranked by donations confirmed by the Alumni Head. Every ₱1,000 donated earns 1 raffle entry.</p>
      </div>
      <TopDonorsLeaderboard limit={10} />
    </div>
  );
}
