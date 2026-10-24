// =====================================================================
// ANNOUNCEMENT CONTEXT — announcements are now backed by Supabase
// (announcements table), shared by both the admin Announcement
// Management screen and the alumni Announcement Board — so
// a post made by one role is now actually visible to the others
// (previously these were two disconnected hardcoded lists).
// =====================================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { useNotifications } from './NotificationContext';
import { notifyAlumni, type NotifyChannels, type NotifyOutcome } from '../../../lib/notifyAlumni';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  targetDept: string;
  date: string;
  pinned: boolean;
  author: string;
  authorRole: string;
}

interface AnnouncementCtx {
  announcements: Announcement[];
  // Posts the announcement and, when `notify` is given, tells alumni about it
  // in-app / by email / by SMS through the notify-alumni Edge Function.
  // Resolves with a one-line outcome the form can show the admin.
  addAnnouncement: (a: { title: string; content: string; category: string; targetDept: string }, notify?: NotifyChannels) => Promise<NotifyOutcome>;
  updateAnnouncement: (id: string, updates: Partial<{ title: string; content: string; category: string; targetDept: string }>) => Promise<void>;
  togglePin: (id: string, currentlyPinned: boolean) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

const Ctx = createContext<AnnouncementCtx>({
  announcements: [],
  addAnnouncement: async () => ({ ok: true, summary: '' }), updateAnnouncement: async () => {},
  togglePin: async () => {}, deleteAnnouncement: async () => {},
});

function mapRow(r: any): Announcement {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    targetDept: r.target_dept,
    date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    pinned: r.pinned,
    author: r.author?.name || 'Unknown',
    authorRole: r.author?.role || '',
  };
}

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { trigger } = useNotifications();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, author:profiles!announcements_created_by_fkey(name, role)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements((data || []).map(mapRow));
  };

  // Reload when the signed-in user changes: these tables are protected by row-level
  // security, so the load that ran at page start (before sign-in) came back empty.
  useEffect(() => { load(); }, [user?.id]);

  const addAnnouncement = async (a: { title: string; content: string; category: string; targetDept: string }, notify?: NotifyChannels): Promise<NotifyOutcome> => {
    if (!user) return { ok: false, summary: 'You must be signed in to post an announcement.' };
    const { error } = await supabase.from('announcements').insert({
      title: a.title, content: a.content, category: a.category,
      target_dept: a.targetDept, created_by: user.id,
    });
    if (error) return { ok: false, summary: `Could not post the announcement: ${error.message}` };
    await load();
    if (!notify) return { ok: true, summary: 'Announcement posted.' };

    const preview = a.content.length > 400 ? `${a.content.slice(0, 397)}…` : a.content;
    const outcome = await notifyAlumni({
      title: a.title,
      message: preview,
      channels: notify,
      audience: { department: a.targetDept },
    });
    // The Edge Function may not be deployed yet (or be unreachable). The
    // in-app bell is the one channel that has an in-database fallback, so
    // alumni still get that even then.
    if (!outcome.ok && notify.inApp) {
      const dept = a.targetDept === 'All Alumni' ? undefined : a.targetDept;
      await Promise.all((['alumni', 'representative'] as const).map(role =>
        trigger({ title: a.title, message: preview, type: 'info', targetRole: role, targetDept: dept })));
      return { ok: true, summary: `Announcement posted. In-app notification sent; email/SMS could not be sent (${outcome.summary}).` };
    }
    return { ok: outcome.ok, summary: `Announcement posted. ${outcome.summary}` };
  };

  const updateAnnouncement = async (id: string, updates: Partial<{ title: string; content: string; category: string; targetDept: string }>) => {
    const patch: any = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.targetDept !== undefined) patch.target_dept = updates.targetDept;
    await supabase.from('announcements').update(patch).eq('id', id);
    await load();
  };

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    await supabase.from('announcements').update({ pinned: !currentlyPinned }).eq('id', id);
    await load();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    await load();
  };

  return (
    <Ctx.Provider value={{ announcements, addAnnouncement, updateAnnouncement, togglePin, deleteAnnouncement }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAnnouncements = () => useContext(Ctx);
