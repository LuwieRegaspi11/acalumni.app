import { useId } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import type { NotifyChannels } from '../../../lib/notifyAlumni';

// Checkbox row used by every "post something to alumni" form (announcements,
// events, contact-a-batch): In-app and Email are on by default, SMS is an
// optional extra. The actual sending happens in the notify-alumni Edge
// Function; this is just the admin's choice of channels.
interface Props {
  value: NotifyChannels;
  onChange: (next: NotifyChannels) => void;
}

const OPTIONS: { key: keyof NotifyChannels; label: string; hint: string; icon: typeof Bell }[] = [
  { key: 'inApp', label: 'In-app', hint: 'Bell notification inside the portal', icon: Bell },
  { key: 'email', label: 'Email', hint: 'Sent to each alumnus’s email address', icon: Mail },
  { key: 'sms', label: 'SMS (optional)', hint: 'Text message to mobile numbers on file', icon: MessageSquare },
];

export default function NotifyChannelPicker({ value, onChange }: Props) {
  const id = useId();
  return (
    <fieldset className="border border-gray-200 rounded-xl p-3">
      <legend className="text-xs font-semibold text-gray-500 px-1">Notify alumni via</legend>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        {OPTIONS.map(({ key, label, hint, icon: Icon }) => (
          <label key={key} htmlFor={`${id}-${key}`} className="flex items-start gap-2 cursor-pointer flex-1" title={hint}>
            <input
              id={`${id}-${key}`}
              type="checkbox"
              checked={value[key]}
              onChange={e => onChange({ ...value, [key]: e.target.checked })}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-blue-700"
            />
            <span className="text-sm text-gray-700 leading-tight">
              <span className="flex items-center gap-1 font-medium"><Icon className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />{label}</span>
              <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
