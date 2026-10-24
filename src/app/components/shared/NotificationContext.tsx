// =====================================================================
// NOTIFICATION CONTEXT — backed by Supabase (`notifications` table).
// Every notification row belongs to one specific account (user_id), so
// nothing here is shared/broadcast state anymore — what one admin sees
// and marks read is theirs alone, even if the same event notified five
// other admins too. New rows arrive live via Supabase Realtime.
//
// The external API (trigger/getFor/unreadCount/markAllRead) keeps its
// old (role, department) shape so existing call sites and dashboards
// don't need to change — internally those are just used to decide who
// gets notified, not to filter what's shown (the loaded data is already
// scoped to the signed-in user by RLS).
// =====================================================================
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetRole?: string;   // who to notify when triggering (broadcast by role)
  targetDept?: string;   // optionally scope a role-broadcast to one department
  targetUserId?: string; // notify one specific account directly
  offerId?: string;      // set on a batch-representative offer: the panel shows Accept / Decline for it
  read: boolean;
  createdAt: string;
}

interface NotificationCtx {
  notifications: Notification[];
  unreadCount: (role?: string, dept?: string) => number;
  trigger: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: (role?: string, dept?: string) => Promise<void>;
  getFor: (role?: string, dept?: string) => Notification[];
}

const Ctx = createContext<NotificationCtx>({
  notifications: [], unreadCount: () => 0,
  trigger: async () => {}, markRead: async () => {}, markAllRead: async () => {}, getFor: () => [],
});

function mapRow(r: any): Notification {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.read,
    createdAt: r.created_at,
    offerId: r.offer_id ?? undefined,
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setNotifications(data.map(mapRow));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Live updates: new rows for this account (RLS already restricts the
  // subscription to user_id = auth.uid()) show up instantly, no refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [mapRow(payload.new), ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // getFor/unreadCount ignore the role/dept args on purpose — what's
  // loaded is already exactly (and only) this account's notifications.
  const getFor = useCallback((_role?: string, _dept?: string) => notifications, [notifications]);

  const unreadCount = useCallback((_role?: string, _dept?: string) =>
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  // Raises a notification for either a specific account (targetUserId)
  // or every account with a role (targetRole, optionally + targetDept).
  const trigger = useCallback(async (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    if (n.targetUserId) {
      await supabase.rpc('notify_user', {
        p_user_id: n.targetUserId, p_title: n.title, p_message: n.message, p_type: n.type,
      });
      return;
    }
    if (n.targetRole) {
      await supabase.rpc('notify_role', {
        p_role: n.targetRole, p_title: n.title, p_message: n.message, p_type: n.type,
        p_department: n.targetDept || null,
      });
    }
  }, []);

  // The UI flips to "read" immediately, and the change is then SAVED to the
  // database. (A Supabase query only runs once it is awaited — before, these
  // calls were never awaited, so nothing was saved and every notification
  // came back unread after a refresh.) If the save fails, reload so the list
  // shows the truth instead of pretending it was read.
  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) { console.error('[notifications] markRead failed', error); load(); }
  }, [load]);

  const markAllRead = useCallback(async (_role?: string, _dept?: string) => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    if (error) { console.error('[notifications] markAllRead failed', error); load(); }
  }, [user, load]);

  return <Ctx.Provider value={{ notifications, unreadCount, trigger, markRead, markAllRead, getFor }}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
