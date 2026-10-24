// Client side of the notify-alumni Edge Function
// (supabase/functions/notify-alumni/index.ts). Used wherever the admin
// posts something alumni should hear about — announcements, events, and the
// "Contact batch" action in Alumni Tracer. The provider keys (email / SMS)
// live only in the Edge Function's environment; nothing secret is here.
import { supabase } from './supabaseClient';

export interface NotifyChannels {
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

// In-app + email by default; SMS is opt-in per post because it costs money.
export const DEFAULT_NOTIFY_CHANNELS: NotifyChannels = { inApp: true, email: true, sms: false };

export interface NotifyAudience {
  department?: string;
  batchYear?: number;
  program?: string;
  userIds?: string[];
}

interface ChannelResult { sent: number; failed: number; skipped?: string }
interface NotifyResponse {
  recipients: number;
  note?: string;
  inApp?: ChannelResult;
  email?: ChannelResult;
  sms?: ChannelResult;
}

export interface NotifyOutcome {
  ok: boolean;
  /** Human-readable one-liner for a toast / inline status. */
  summary: string;
}

function describe(label: string, r?: ChannelResult): string | null {
  if (!r) return null;
  if (r.skipped) return `${label} skipped (${r.skipped})`;
  return `${label} ${r.sent}${r.failed ? ` (${r.failed} failed)` : ''}`;
}

export async function notifyAlumni(params: {
  title: string;
  message: string;
  channels: NotifyChannels;
  audience: NotifyAudience;
}): Promise<NotifyOutcome> {
  if (!params.channels.inApp && !params.channels.email && !params.channels.sms) {
    return { ok: true, summary: 'No notification channel selected.' };
  }
  const { data, error } = await supabase.functions.invoke<NotifyResponse>('notify-alumni', { body: params });
  if (error || !data) {
    return { ok: false, summary: error?.message || 'The notification service could not be reached.' };
  }
  if (data.note) return { ok: true, summary: data.note };
  const parts = [
    describe('In-app', data.inApp),
    describe('Email', data.email),
    describe('SMS', data.sms),
  ].filter(Boolean);
  return { ok: true, summary: `Notified ${data.recipients} alumni — ${parts.join(' · ')}` };
}
