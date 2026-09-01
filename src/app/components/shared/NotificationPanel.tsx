import React from 'react';
import { Bell, X, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useNotifications } from './NotificationContext';

const typeIcon: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
};

const typeBg: Record<string, string> = {
  info: 'border-l-blue-400',
  success: 'border-l-green-400',
  warning: 'border-l-orange-400',
  error: 'border-l-red-400',
};

interface Props {
  role: string;
  department?: string;
  open: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ role, department, open, onClose }: Props) {
  const { getFor, markRead, markAllRead, unreadCount } = useNotifications();
  const items = getFor(role, department);
  const count = unreadCount(role, department);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white shadow-2xl w-full max-w-sm h-full flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' }}>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-white" />
            <h3 className="font-bold text-white">Notifications</h3>
            {count > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{count}</span>}
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <button onClick={() => markAllRead(role, department)} className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Bell className="w-7 h-7 text-gray-300" />
              </div>
              <h4 className="font-semibold text-gray-500 mb-1">All caught up!</h4>
              <p className="text-sm text-gray-400">No notifications to show right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(n => (
                <div key={n.id}
                  className={`px-5 py-4 border-l-4 ${typeBg[n.type]} ${n.read ? 'bg-white' : 'bg-blue-50/40'} hover:bg-gray-50 transition-colors cursor-pointer`}
                  onClick={() => markRead(n.id)}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{typeIcon[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${n.read ? 'text-gray-600' : 'text-gray-800'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{n.createdAt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
