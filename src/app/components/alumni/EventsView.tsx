import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle, Search } from 'lucide-react';
import { useEvents } from '../shared/EventsContext';
import { Card, CardContent, TextField, Button, Chip, Tabs, Tab, Box } from '@mui/material';
import EventCalendar from '../shared/EventCalendar';

// ================= [ALUMNI: EVENTSVIEW] =================
// Backed by Supabase (events / event_registrations tables via useEvents()).

export default function EventsView() {
  const { events, myRegisteredEventIds, registerForEvent, cancelRegistration } = useEvents();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const matches = (e: (typeof events)[number]) =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase());

  const filteredEvents = events.filter(matches);
  const myRegistrations = filteredEvents.filter(e => myRegisteredEventIds.has(e.id));
  const notRegistered = filteredEvents.filter(e => !myRegisteredEventIds.has(e.id));

  const handleRegister = async (id: string) => {
    setBusyId(id);
    await registerForEvent(id);
    setBusyId(null);
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    await cancelRegistration(id);
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1">Events & Calendar</h2>
          <p className="text-gray-600">Stay connected with alumni events and activities</p>
        </div>
      </div>

      {/* View Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_e, newValue) => setCurrentTab(newValue)}>
            <Tab label="Calendar View" />
            <Tab label="List View" />
          </Tabs>
        </Box>
      </Card>

      {/* Calendar View */}
      {currentTab === 0 && (
        <EventCalendar />
      )}

      {/* List View */}
      {currentTab === 1 && (
        <>
          {/* Search Bar */}
          <Card>
            <CardContent>
              <TextField
                fullWidth
                placeholder="Search events by title, description, location, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" />
                }}
              />
            </CardContent>
          </Card>

          {/* My Registrations */}
          {myRegistrations.length > 0 && (
            <div>
              <h3 className="text-lg mb-4">My Registered Events ({myRegistrations.length})</h3>
              <div className="space-y-4">
                {myRegistrations.map((event) => (
                  <Card key={event.id} className="border-l-4 border-l-blue-600">
                    <CardContent>
                      {event.imageUrl && (
                        <div className="w-full h-32 rounded-lg overflow-hidden mb-3">
                          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg">{event.title}</h4>
                            <Chip label="Registered" size="small" color="success" icon={<CheckCircle className="w-3 h-3" />} />
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span>{event.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span>{event.location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outlined" size="small" color="error"
                            disabled={busyId === event.id}
                            onClick={() => handleCancel(event.id)}
                          >
                            Cancel Registration
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div>
            <h3 className="text-lg mb-4">Upcoming Events ({notRegistered.length})</h3>
            {notRegistered.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No upcoming events found matching your search</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notRegistered.map((event) => {
                  const spotsLeft = event.maxCapacity != null ? Math.max(0, event.maxCapacity - event.registeredCount) : undefined;
                  const full = spotsLeft === 0;
                  return (
                    <Card key={event.id} className="hover:shadow-lg transition-shadow">
                      <CardContent>
                        {event.imageUrl && (
                          <div className="w-full h-32 rounded-lg overflow-hidden mb-3">
                            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="mb-3">
                          <h4 className="text-lg mb-2">{event.title}</h4>
                          <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span>{event.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span>{event.location}</span>
                            </div>
                            {spotsLeft !== undefined && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-gray-500" />
                                <span>{spotsLeft} spots remaining</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t">
                          <Chip label={event.department} size="small" variant="outlined" />
                          <Button
                            variant="contained" size="small" className="ml-auto bg-blue-600"
                            disabled={busyId === event.id || full}
                            onClick={() => handleRegister(event.id)}
                          >
                            {full ? 'Full' : 'Register Now'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
