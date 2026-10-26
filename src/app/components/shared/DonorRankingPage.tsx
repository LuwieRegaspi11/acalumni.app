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
        <p className="text-gray-500 text-sm mt-1">Alumni whose confirmed gifts are building the future of Asian College.</p>
      </div>
      <TopDonorsLeaderboard limit={10} />
    </div>
  );
}
