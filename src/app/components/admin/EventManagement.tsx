import EventCalendar from '../shared/EventCalendar';

// ================= [ADMIN: EVENTMANAGEMENT] =================

export default function EventManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-1">Event Management</h2>
        <p className="text-gray-600">Schedule and manage alumni events</p>
      </div>

      <EventCalendar canCreate={true} createdBy="admin" />
    </div>
  );
}