import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  CircularProgress,
} from '@mui/material';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useEvents, AppEvent, EventRegistrant } from './EventsContext';

interface Props {
  event: AppEvent | null;
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  alumni: 'Alumni',
  representative: 'Batch Rep',
};
const roleLabel = (role: string) => ROLE_LABELS[role] || (role ? role[0].toUpperCase() + role.slice(1) : '—');

// Admin/faculty-only view of exactly who registered for an event — opened
// by clicking an event's title in "Upcoming Events This Month". Alumni and
// batch reps never see this dialog; they still get the plain event detail
// dialog EventCalendar already shows everyone.
export default function EventRegistrantsDialog({ event, open, onClose }: Props) {
  const { getEventRegistrants } = useEvents();
  const [registrants, setRegistrants] = useState<EventRegistrant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !event) return;
    let cancelled = false;
    setLoading(true);
    getEventRegistrants(event.id).then(list => {
      if (!cancelled) { setRegistrants(list); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [open, event]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{event?.title || 'Event Registrants'}</DialogTitle>
      <DialogContent>
        {event && (
          <div className="space-y-4 pt-1">
            {/* Event summary */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{event.time}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />
                {event.registeredCount}{event.maxCapacity ? ` / ${event.maxCapacity}` : ''} registered
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Chip label={event.department === 'All' ? 'All Alumni' : `${event.department} Dept.`} size="small" />
              <Chip label={`Created by ${event.createdByName}${event.createdBy ? ` (${roleLabel(event.createdBy)})` : ''}`} size="small" variant="outlined" />
            </div>

            {/* Registrants table */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Registered Alumni / Batch Reps ({registrants.length})</h4>
              {loading ? (
                <div className="flex justify-center py-8"><CircularProgress size={28} /></div>
              ) : registrants.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No one has registered for this event yet.</p>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell>Batch Year</TableCell>
                        <TableCell>Program</TableCell>
                        <TableCell>Registered On</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {registrants.map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.email}</TableCell>
                          <TableCell>
                            <Chip label={roleLabel(r.role)} size="small" color={r.role === 'representative' ? 'secondary' : 'default'} />
                          </TableCell>
                          <TableCell>{r.department || '—'}</TableCell>
                          <TableCell>{r.batchYear ?? '—'}</TableCell>
                          <TableCell>{r.program || '—'}</TableCell>
                          <TableCell>{new Date(r.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
