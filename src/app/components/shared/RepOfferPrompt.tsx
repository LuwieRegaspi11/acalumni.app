import { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { useNotifications } from './NotificationContext';
import RepOfferActions, { fetchOffer, REOPEN_OFFER_EVENT } from './RepOfferActions';

// Popup shown to an alumnus the moment the Alumni Head offers them the batch
// representative role (and again on their next sign-in if they haven't
// answered). It watches the notification list, which is live via Realtime,
// so it appears without a refresh. "Decide later" hides it for this visit
// only — the offer stays in the bell panel with the same Accept / Decline.
export default function RepOfferPrompt() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [offerId, setOfferId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const offerNotificationIds = notifications.filter(n => n.offerId && !n.read).map(n => n.offerId as string).join(',');

  useEffect(() => {
    if (!user || user.role !== 'alumni') { setOfferId(null); return; }
    let active = true;
    supabase.from('rep_offers').select('id').eq('alumni_id', user.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (active) setOfferId(data?.[0]?.id ?? null); });
    return () => { active = false; };
  }, [user?.id, user?.role, offerNotificationIds]);

  // Clicking the offer in the notification bell brings this popup back.
  useEffect(() => {
    const reopen = async (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const offer = id ? await fetchOffer(id) : null;
      if (!offer || offer.status !== 'pending') return;
      setDismissed(prev => { const next = new Set(prev); next.delete(id); return next; });
      setOfferId(id);
    };
    window.addEventListener(REOPEN_OFFER_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_OFFER_EVENT, reopen);
  }, []);

  if (!offerId || dismissed.has(offerId)) return null;

  const close = () => setDismissed(prev => new Set(prev).add(offerId));

  return (
    <div onClick={close} className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Batch representative offer">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={close} aria-label="Decide later" className="absolute top-4 right-4"><X className="w-5 h-5 text-gray-400" /></button>
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
          <Shield className="w-7 h-7 text-blue-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">You’ve been offered a new role</h3>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          The Alumni Head would like you to serve as your <strong>batch representative</strong> — verifying
          batchmates and monitoring your batch’s giving. If you accept, your account switches to the
          batch representative portal right away. If you decline, nothing changes.
        </p>
        <RepOfferActions offerId={offerId} onResponded={() => setTimeout(close, 1500)} />
        <button onClick={close} className="mt-4 w-full text-xs font-semibold text-gray-500 hover:text-gray-700">Decide later</button>
      </div>
    </div>
  );
}
