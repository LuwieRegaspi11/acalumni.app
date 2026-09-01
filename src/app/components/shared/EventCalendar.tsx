import React, { useState } from 'react';
import {
  Card, CardContent, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField
} from '@mui/material';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Users, Plus, X, Upload } from 'lucide-react';
import { useEvents, AppEvent } from './EventsContext';
import { useNotifications } from './NotificationContext';

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'All':   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-400' },
  'CSE':   { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-400' },
  'CTHM':  { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-400' },
  'BAA':   { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
  'default':{ bg: 'bg-gray-100',  text: 'text-gray-800',   border: 'border-gray-400' },
};
const getColor = (dept: string) => DEPT_COLORS[dept] || DEPT_COLORS['default'];

interface Props {
  department?: string; // faculty's locked department; undefined = admin sees all
  canCreate?: boolean;
  createdBy?: string;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const BLANK_FORM = { title: '', description: '', date: '', time: '', location: '', maxCapacity: '', imageUrl: '', department: 'All' };

export default function EventCalendar({ department, canCreate = false, createdBy = 'faculty' }: Props) {
  const { events, addEvent } = useEvents();
  const { trigger } = useNotifications();
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [detailOpen, setDetailOpen]       = useState(false);
  const [createOpen, setCreateOpen]       = useState(false);
  const [form, setForm]                   = useState(BLANK_FORM);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // All roles see ALL events — shared calendar for date/time coordination
  const visibleEvents = events;

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return visibleEvents.filter(e => e.date === dateStr);
  };

  const monthEvents = visibleEvents.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalCells     = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setImagePreview(reader.result as string); setForm(f => ({ ...f, imageUrl: reader.result as string })); };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!form.title || !form.date || !form.time || !form.location) return;
    const targetDept = department || form.department || 'All';
    addEvent({
      title: form.title,
      description: form.description,
      date: form.date,
      time: form.time,
      location: form.location,
      department: targetDept,
      createdBy,
      maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
      imageUrl: form.imageUrl || undefined,
    });

    // Only the people this event is actually for get notified — the
    // event's own department (alumni + their faculty/reps), or everyone
    // when the event is tagged "All".
    const notifyMsg = `"${form.title}" has been scheduled for ${form.date}${targetDept !== 'All' ? ` (${targetDept} Department)` : ''}.`;
    const roles: Array<'alumni' | 'faculty' | 'representative'> = ['alumni', 'faculty', 'representative'];
    roles.forEach(role => {
      trigger({
        title: 'New Event Published',
        message: notifyMsg,
        type: 'info',
        targetRole: role,
        targetDept: targetDept === 'All' ? undefined : targetDept,
      });
    });

    setForm(BLANK_FORM);
    setImagePreview(null);
    setCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Calendar card */}
      <Card>
        <CardContent>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3 mb-4">
            <h3 className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {MONTHS[month]} {year}
              {department && <span className="ml-2 text-sm font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{department} Dept.</span>}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outlined" size="small" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} startIcon={<ChevronLeft className="w-4 h-4" />}>Prev</Button>
              <Button variant="outlined" size="small" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outlined" size="small" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} endIcon={<ChevronRight className="w-4 h-4" />}>Next</Button>
              {canCreate && (
                <Button variant="contained" size="small" startIcon={<Plus className="w-4 h-4" />}
                  style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}
                  onClick={() => setCreateOpen(true)}
                >
                  Add Event
                </Button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0">
            {DAYS.map(d => (
              <div key={d} className="bg-gray-100 border border-gray-200 p-1 sm:p-2 text-center text-xs sm:text-sm font-semibold">{d}</div>
            ))}
            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - firstDayOfMonth + 1;
              const valid = day > 0 && day <= daysInMonth;
              const dayEvents = valid ? eventsForDay(day) : [];
              const today = valid && day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              return (
                <div key={i} className={`min-h-24 border border-gray-200 p-1.5 ${valid ? 'bg-white' : 'bg-gray-50'} ${today ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
                  {valid && (
                    <>
                      <div className={`text-sm mb-1 ${today ? 'font-bold text-blue-600' : 'text-gray-700'}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayEvents.map((ev, idx) => {
                          const c = getColor(ev.department);
                          return (
                            <div key={idx} onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }}
                              className={`text-[11px] ${c.bg} ${c.text} px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 truncate border-l-2 ${c.border}`}>
                              {ev.time.substring(0,5)} {ev.title}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-100" /><span>Today</span></div>
            {(!department || department === 'All') && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-l-2 border-blue-400 bg-blue-100" /><span>All Alumni</span></div>}
            {(!department || department === 'CSE')  && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-l-2 border-purple-400 bg-purple-100" /><span>CSE</span></div>}
            {(!department || department === 'CTHM') && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-l-2 border-red-400 bg-red-100" /><span>CTHM</span></div>}
            {(!department || department === 'BAA')  && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-l-2 border-yellow-400 bg-yellow-100" /><span>BAA</span></div>}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming events list */}
      <Card>
        <CardContent>
          <h3 className="text-lg mb-3">Upcoming Events This Month</h3>
          {monthEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No events scheduled for this month</p>
          ) : (
            <div className="space-y-2">
              {monthEvents.map(ev => {
                const c = getColor(ev.department);
                return (
                  <div key={ev.id} onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }}
                    className={`border-l-4 ${c.border} rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">{ev.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(ev.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ev.time}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>
                        </div>
                      </div>
                      <Chip label={ev.department === 'All' ? 'All Alumni' : `${ev.department}`} size="small" className={`${c.bg} ${c.text}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Event Details</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <div className="space-y-4 pt-2">
              {selectedEvent.imageUrl && (
                <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full h-48 object-cover rounded-lg" />
              )}
              <h3 className="text-xl font-semibold">{selectedEvent.title}</h3>
              <p className="text-gray-600 text-sm">{selectedEvent.description}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{new Date(selectedEvent.date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />{selectedEvent.time}</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{selectedEvent.location}</div>
                {selectedEvent.maxCapacity && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />{selectedEvent.registeredCount} registered / {selectedEvent.maxCapacity} max</div>}
              </div>
              <div className="flex items-center gap-2">
                <Chip label={selectedEvent.department === 'All' ? 'All Alumni' : `${selectedEvent.department} Dept.`} size="small" />
                <Chip label={`Created by ${selectedEvent.createdBy}`} size="small" variant="outlined" />
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create event dialog (faculty / admin) */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setForm(BLANK_FORM); setImagePreview(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add New Event
          {department && <span className="ml-2 text-sm font-normal text-gray-500">— {department} Department</span>}
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-3">
            <TextField fullWidth label="Event Title" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
            <TextField fullWidth label="Description" multiline rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />

            {/* Image upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3">
              <p className="text-sm text-gray-600 mb-2">Event Banner (optional)</p>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="preview" className="w-full h-36 object-cover rounded-lg" />
                  <button onClick={() => { setImagePreview(null); setForm(f => ({...f, imageUrl: ''})); }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer py-4 hover:bg-gray-50 rounded-lg transition-colors">
                  <Upload className="w-7 h-7 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Click to upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField fullWidth label="Date" type="date" InputLabelProps={{ shrink: true }} value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
              <TextField fullWidth label="Time" type="time" InputLabelProps={{ shrink: true }} value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} required />
            </div>
            <TextField fullWidth label="Location" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} required />

            {/* Department — locked for faculty, selectable for admin */}
            {department ? (
              <TextField
                fullWidth
                label="Target Department"
                value={`${department} Department`}
                InputProps={{ readOnly: true }}
                helperText="Events are tagged to your department. All can see it on the shared calendar."
              />
            ) : (
              <TextField
                fullWidth
                select
                label="Target Department"
                value={form.department ?? 'All'}
                onChange={e => setForm(f => ({...f, department: e.target.value}))}
                helperText="Select which department this event is for, or All Alumni."
                SelectProps={{ native: true }}
              >
                <option value="All">All Alumni</option>
                <option value="CSE">CSE</option>
                <option value="CTHM">CTHM</option>
                <option value="BAA">BAA</option>
              </TextField>
            )}
            <TextField fullWidth label="Max Capacity (optional)" type="number" value={form.maxCapacity} onChange={e => setForm(f => ({...f, maxCapacity: e.target.value}))} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setForm(BLANK_FORM); setImagePreview(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.title || !form.date || !form.time || !form.location}
            style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
            Create Event
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
