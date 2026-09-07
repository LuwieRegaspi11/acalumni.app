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
  createdByName: string; // display name of the admin/faculty account that created it
  registeredCount: number;
  maxCapacity?: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  imageUrl?: string;
}

export interface EventRegistrant {
  id: string;           // profile id
  name: string;
  email: string;
  role: string;         // 'alumni' | 'representative'
  department: string | null;
  batchYear: number | null;
  program: string | null;
  registeredAt: string;
}

interface EventsCtx {
  events: AppEvent[];
  myRegisteredEventIds: Set<string>;
  addEvent: (e: Omit<AppEvent, 'id' | 'registeredCount' | 'status' | 'createdByName'>) => Promise<void>;
  registerForEvent: (eventId: string) => Promise<void>;
  cancelRegistration: (eventId: string) => Promise<void>;
  getEventRegistrants: (eventId: string) => Promise<EventRegistrant[]>;
}

const Ctx = createContext<EventsCtx>({
  events: [], myRegisteredEventIds: new Set(),
  addEvent: async () => {}, registerForEvent: async () => {}, cancelRegistration: async () => {},
  getEventRegistrants: async () => [],
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
      .select('*, creator:profiles!events_created_by_fkey(name, role), registrations:event_registrations(count)')
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
        createdBy: e.creator?.role || '',
        createdByName: e.creator?.name || 'Unknown',
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
    if (!user) throw new Error('You must be signed in to create an event.');
    const eventDateTime = new Date(`${e.date}T${e.time || '00:00'}`);
    const { error } = await supabase.from('events').insert({
      title: e.title,
      description: e.description,
      event_date: eventDateTime.toISOString(),
      location: e.location,
      department: e.department || 'All',
      max_capacity: e.maxCapacity ?? null,
      image_url: e.imageUrl ?? null,
      created_by: user.id,
    });
    // Insert failures (RLS denial, an oversized banner image tripping the
    // API gateway's request-size limit, a dropped connection, ...) used to
    // be swallowed here — the dialog closed and the "New Event Published"
    // notifications still fired via handleCreate, even though nothing was
    // ever saved. Throwing lets the caller show the real error and keep
    // the dialog open instead of silently losing the event.
    if (error) throw error;
    await loadEvents();
  };

  // Admin/faculty-only: who actually registered for a given event, with
  // enough profile detail (name, role, department, batch, contact) to show
  // in a registrants table. RLS scopes what comes back per-caller — admins
  // see everyone, faculty see any profile that has an event_registrations
  // row (see event_registrant_visibility.sql) — so this never needs a
  // client-side role check of its own.
  const getEventRegistrants = async (eventId: string): Promise<EventRegistrant[]> => {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('registered_at, profile:profiles(id, name, email, role, department, batch_year, program)')
      .eq('event_id', eventId)
      .order('registered_at', { ascending: true });
    if (error || !data) return [];
    return data
      .filter((r: any) => r.profile) // RLS may hide a profile the caller isn't allowed to see
      .map((r: any) => ({
        id: r.profile.id,
        name: r.profile.name || 'Unknown',
        email: r.profile.email || '',
        role: r.profile.role || '',
        department: r.profile.department ?? null,
        batchYear: r.profile.batch_year ?? null,
        program: r.profile.program ?? null,
        registeredAt: r.registered_at,
      }));
  };

  return <Ctx.Provider value={{ events, myRegisteredEventIds, addEvent, registerForEvent, cancelRegistration, getEventRegistrants }}>{children}</Ctx.Provider>;
}

export const useEvents = () => useContext(Ctx);
