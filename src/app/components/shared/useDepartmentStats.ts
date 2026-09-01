// =====================================================================
// useDepartmentStats — live, department-scoped Supabase counts for the
// role dashboards' overview cards (Faculty today; Representative/Alumni
// can reuse this if they need the same shape of counts later).
//
// Each count is its own query with its own loading flag, so one slow or
// failing card never blocks the others. On error we log a warning and
// fall back to 0 rather than throwing — a stat card should never crash
// the dashboard.
//
// IMPORTANT: the department scoping here is a convenience filter, not
// the security boundary. RLS on profiles/donations/events is what
// actually stops a faculty account from pulling another department's
// numbers if the request were tampered with — see:
//   - profiles: "Faculty can view alumni in their department"
//   - donations: "donations_select_own_or_scoped_staff" (department-
//     scoped for faculty via the donor's profile)
//   - events: "events_read_all" (the calendar is intentionally shared
//     across departments, so no department RLS restriction there)
// =====================================================================
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface StatState {
  value: number;
  loading: boolean;
}

export interface DepartmentStats {
  deptAlumni: StatState;
  pendingDonations: StatState;
  upcomingEvents: StatState;
}

const IDLE: StatState = { value: 0, loading: false };
const LOADING: StatState = { value: 0, loading: true };

export function useDepartmentStats(department?: string | null): DepartmentStats {
  const [deptAlumni, setDeptAlumni] = useState<StatState>(LOADING);
  const [pendingDonations, setPendingDonations] = useState<StatState>(LOADING);
  const [upcomingEvents, setUpcomingEvents] = useState<StatState>(LOADING);

  useEffect(() => {
    if (!department) {
      setDeptAlumni(IDLE);
      setPendingDonations(IDLE);
      setUpcomingEvents(IDLE);
      return;
    }
    let cancelled = false;

    setDeptAlumni(LOADING);
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'alumni')
      .eq('department', department)
      .eq('registration_status', 'approved')
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[useDepartmentStats] dept alumni count failed', error);
          setDeptAlumni(IDLE);
          return;
        }
        setDeptAlumni({ value: count || 0, loading: false });
      });

    setPendingDonations(LOADING);
    supabase
      .from('donations')
      // !inner turns the embedded profiles row into a filter, not just a
      // join — this is what lets us count "pending donations whose donor
      // is in this department" in one query. RLS still narrows the base
      // set of donation rows before this filter ever runs.
      .select('id, donor:profiles!donations_donor_id_fkey!inner(department)', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('donor.department', department)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[useDepartmentStats] pending donations count failed', error);
          setPendingDonations(IDLE);
          return;
        }
        setPendingDonations({ value: count || 0, loading: false });
      });

    setUpcomingEvents(LOADING);
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .or(`department.eq.${department},department.eq.All`)
      .gte('event_date', new Date().toISOString())
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[useDepartmentStats] upcoming events count failed', error);
          setUpcomingEvents(IDLE);
          return;
        }
        setUpcomingEvents({ value: count || 0, loading: false });
      });

    return () => { cancelled = true; };
  }, [department]);

  return { deptAlumni, pendingDonations, upcomingEvents };
}
