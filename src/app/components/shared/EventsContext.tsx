// =====================================================================
// EVENTS CONTEXT — events are backed by Supabase (events /
// event_registrations tables). Every screen that already uses
// useEvents() keeps working unchanged.
// =====================================================================
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  department: string; // 'All' | 'CSE' | 'CTHM' | 'BAA' | ...
  createdBy: string;  // role: 'admin' | 'faculty'
  registeredCount: number;
  maxCapacity?: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  imageUrl?: string;
}

interface EventsCtx {
  events: AppEvent[];
  myRegisteredEventIds: Set<string>;
  addEvent: (e: Omit<AppEvent, 'id' | 'registeredCount' | 'status'>) => Promise<void>;
  registerForEvent: (eventId: string) => Promise<void>;
  cancelRegistration: (eventId: string) => Promise<void>;
}

const Ctx = createContext<EventsCtx>({
  events: [], myRegisteredEventIds: new Set(),
  addEvent: async () => {}, registerForEvent: async () => {}, cancelRegistration: async () => {},
});

function computeStatus(dateStr: string): AppEvent['status'] {
  const eventDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (eventDate < today) return 'Completed';
  if (eventDate.toDateString() === today.toDateString()) return 'Ongoing';
  return 'Upcoming';
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [myRegisteredEventIds, setMyRegisteredEventIds] = useState<Set<string>>(new Set());

  const loadMyRegistrations = async () => {
    if (!user) { setMyRegisteredEventIds(new Set()); return; }
    const { data } = await supabase.from('event_registrations').select('event_id').eq('alumni_id', user.id);
    setMyRegisteredEventIds(new Set((data || []).map((r: any) => r.event_id)));
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*, registrations:event_registrations(count)')
      .order('event_date', { ascending: true });
    if (!data) return;
    setEvents(data.map((e: any) => {
      const d = new Date(e.event_date);
      return {
        id: e.id,
        title: e.title,
        description: e.description || '',
        date: d.toLocaleDateString('en-CA'),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        location: e.location || '',
        department: e.department || 'All',
        createdBy: '',
        registeredCount: e.registrations?.[0]?.count || 0,
        maxCapacity: e.max_capacity ?? undefined,
        status: computeStatus(e.event_date),
        imageUrl: e.image_url ?? undefined,
      };
    }));
  };

  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { loadMyRegistrations(); }, [user]);

  const registerForEvent = async (eventId: string) => {
    if (!user) return;
    await supabase.from('event_registrations').insert({ event_id: eventId, alumni_id: user.id });
    await Promise.all([loadEvents(), loadMyRegistrations()]);
  };

  const cancelRegistration = async (eventId: string) => {
    if (!user) return;
    await supabase.from('event_registrations').delete().eq('event_id', eventId).eq('alumni_id', user.id);
    await Promise.all([loadEvents(), loadMyRegistrations()]);
  };

  const addEvent = async (e: Omit<AppEvent, 'id' | 'registeredCount' | 'status'>) => {
    if (!user) return;
    const eventDateTime = new Date(`${e.date}T${e.time || '00:00'}`);
    await supabase.from('events').insert({
      title: e.title,
      description: e.description,
      event_date: eventDateTime.toISOString(),
      location: e.location,
      department: e.department || 'All',
      max_capacity: e.maxCapacity ?? null,
      image_url: e.imageUrl ?? null,
      created_by: user.id,
    });
    await loadEvents();
  };

  return <Ctx.Provider value={{ events, myRegisteredEventIds, addEvent, registerForEvent, cancelRegistration }}>{children}</Ctx.Provider>;
}

export const useEvents = () => useContext(Ctx);
