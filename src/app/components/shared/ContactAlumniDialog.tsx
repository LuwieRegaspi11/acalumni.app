import { useEffect, useId, useState } from 'react';
import { X, Send } from 'lucide-react';
import NotifyChannelPicker from './NotifyChannelPicker';
import { notifyAlumni, DEFAULT_NOTIFY_CHANNELS, type NotifyChannels, type NotifyOutcome } from '../../../lib/notifyAlumni';

// "Contact batch" dialog — the admin writes one message and sends it to every
// alumnus in the current group/filter at once (in-app, email, optional SMS),
// through the notify-alumni Edge Function. Opened from Alumni Management
// (admin/AlumniManagement -> shared/AlumniManagementView.tsx).
interface Props {
  open: boolean;
  onClose: () => void;
  /** Shown in the header, e.g. "Batch 2022 · BSIT". */
  audienceLabel: string;
  /** Profile ids that will receive the message. */
  recipientIds: string[];
}

export default function ContactAlumniDialog({ open, onClose, audienceLabel, recipientIds }: Props) {
  const id = useId();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<NotifyChannels>(DEFAULT_NOTIFY_CHANNELS);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<NotifyOutcome | null>(null);

  // Start fresh every time the dialog is opened for a (possibly different) group.
  useEffect(() => {
    if (open) { setSubject(''); setMessage(''); setChannels(DEFAULT_NOTIFY_CHANNELS); setOutcome(null); }
  }, [open, audienceLabel]);

  if (!open) return null;

  const canSend = !sending && recipientIds.length > 0 && subject.trim() && message.trim()
    && (channels.inApp || channels.email || channels.sms);

  const send = async () => {
    setSending(true);
    setOutcome(null);
    const result = await notifyAlumni({
      title: subject.trim(),
      message: message.trim(),
      channels,
      audience: { userIds: recipientIds },
    });
    setOutcome(result);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 id={`${id}-title`} className="font-bold text-gray-800">Contact alumni</h3>
            <p className="text-xs text-gray-500">{audienceLabel} · {recipientIds.length} {recipientIds.length === 1 ? 'recipient' : 'recipients'}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor={`${id}-subject`} className="text-xs font-semibold text-gray-500 mb-1 block">Subject</label>
            <input id={`${id}-subject`} value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400"
              placeholder="e.g. Batch 2022 grand reunion" />
          </div>
          <div>
            <label htmlFor={`${id}-message`} className="text-xs font-semibold text-gray-500 mb-1 block">Message</label>
            <textarea id={`${id}-message`} value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={4000}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 resize-none"
              placeholder="Write your message…" />
            {channels.sms && <p className="text-[11px] text-gray-400 mt-1">SMS is trimmed to 300 characters.</p>}
          </div>
          <NotifyChannelPicker value={channels} onChange={setChannels} />

          {outcome && (
            <div role="status" className={`rounded-xl border p-3 text-sm ${outcome.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {outcome.summary}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {outcome?.ok ? 'Done' : 'Cancel'}
          </button>
          {!outcome?.ok && (
            <button onClick={send} disabled={!canSend}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
