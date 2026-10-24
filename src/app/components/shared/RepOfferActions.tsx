import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, X as XIcon, Shield } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';

// =====================================================================
// BATCH REPRESENTATIVE OFFER — Accept / Decline UI
// Used in two places for the same offer: inside the notification bell panel
// and in the popup (RepOfferPrompt). The admin sends the offer from
// admin/BatchRepresentatives.tsx; the database functions in
// supabase/batch_rep_offers.sql do the real work (role change, admin
// notification, audit log). On Accept the alumnus's profile is reloaded and
// they are taken straight to the batch representative dashboard.
// =====================================================================

export interface OfferInfo {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  batchYear: number;
  department: string;
  program: string;
}

export async function fetchOffer(id: string): Promise<OfferInfo | null> {
  const { data } = await supabase.from('rep_offers')
    .select('id, status, batch_year, department, program').eq('id', id).maybeSingle();
  if (!data) return null;
  return { id: data.id, status: data.status, batchYear: data.batch_year, department: data.department, program: data.program };
}

const STATUS_TEXT: Record<string, string> = {
  accepted: 'You accepted this offer.',
  rejected: 'You declined this offer.',
  cancelled: 'This offer was withdrawn by the Alumni Head.',
};

export default function RepOfferActions({ offerId, onResponded }: { offerId: string; onResponded?: () => void }) {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [offer, setOffer] = useState<OfferInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchOffer(offerId).then(o => { if (active) setOffer(o); });
    return () => { active = false; };
  }, [offerId]);

  const respond = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    setError('');
    const { error: rpcError } = await supabase.rpc('respond_to_rep_offer', { p_offer_id: offerId, p_accept: accept });
    if (rpcError) {
      setBusy(null);
      setError(rpcError.message || 'Could not save your answer. Please try again.');
      return;
    }
    onResponded?.();
    if (accept) {
      // Role changed in the database — reload the profile, then open the
      // batch representative dashboard (the alumni one no longer allows them).
      await refreshProfile();
      navigate('/representative', { replace: true });
    } else {
      setOffer(o => (o ? { ...o, status: 'rejected' } : o));
      setBusy(null);
    }
  };

  if (offer === undefined) return null;
  if (offer === null) return <p className="text-[11px] text-gray-400 mt-2">This offer is no longer available.</p>;

  if (offer.status !== 'pending') {
    return <p className="text-[11px] font-semibold text-gray-500 mt-2">{STATUS_TEXT[offer.status]}</p>;
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-semibold mb-2">
        <Shield className="w-3.5 h-3.5" aria-hidden="true" />
        Batch {offer.batchYear} · {offer.department} · {offer.program}
      </div>
      <div className="flex gap-2">
        <button onClick={e => { e.stopPropagation(); respond(true); }} disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'accept' ? 'Accepting…' : 'Accept'}
        </button>
        <button onClick={e => { e.stopPropagation(); respond(false); }} disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60">
          <XIcon className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 font-semibold mt-2" role="alert">{error}</p>}
    </div>
  );
}
