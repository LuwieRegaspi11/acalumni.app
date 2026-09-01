// =====================================================================
// ANNOUNCEMENT CONTEXT — announcements are now backed by Supabase
// (announcements table), shared by both the admin Announcement
// Management screen and the alumni/faculty Announcement Board — so
// a post made by one role is now actually visible to the others
// (previously these were two disconnected hardcoded lists).
// =====================================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';

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
  addAnnouncement: (a: { title: string; content: string; category: string; targetDept: string }) => Promise<void>;
  updateAnnouncement: (id: string, updates: Partial<{ title: string; content: string; category: string; targetDept: string }>) => Promise<void>;
  togglePin: (id: string, currentlyPinned: boolean) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

const Ctx = createContext<AnnouncementCtx>({
  announcements: [],
  addAnnouncement: async () => {}, updateAnnouncement: async () => {},
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, author:profiles!announcements_created_by_fkey(name, role)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements((data || []).map(mapRow));
  };

  useEffect(() => { load(); }, []);

  const addAnnouncement = async (a: { title: string; content: string; category: string; targetDept: string }) => {
    if (!user) return;
    await supabase.from('announcements').insert({
      title: a.title, content: a.content, category: a.category,
      target_dept: a.targetDept, created_by: user.id,
    });
    await load();
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
