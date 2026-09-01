// =====================================================================
// PENDING APPROVAL PAGE — a dedicated, full-page notice shown instead
// of the dashboard whenever a signed-in account's registration_status
// is 'pending'. Replaces the old approach of letting pending accounts
// into a restricted dashboard view (see AlumniDashboard.tsx, which no
// longer needs that logic now that ProtectedRoute redirects here).
// =====================================================================
import React from 'react';
import { useNavigate } from 'react-router';
import { Clock, LogOut, Mail } from 'lucide-react';
import { useAuth } from './AuthContext';
import asianCollegeLogo from '../../imports/asiancollege_logo.jpeg';

const NAVY = '#1B3A6B';

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Only meant for a signed-in, still-pending alumni account — pending
  // approval only ever applies to alumni registrations (faculty/rep
  // accounts are auto-approved on signup), so anyone else who lands
  // here (already approved, not alumni, or not signed in at all) gets
  // sent where they actually belong.
  const isPending = user?.role === 'alumni' && user?.registrationStatus === 'pending';

  React.useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    } else if (!isPending) {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'alumni') navigate('/alumni', { replace: true });
      else if (user.role === 'faculty') navigate('/user', { replace: true });
      else if (user.role === 'representative') navigate('/representative', { replace: true });
    }
  }, [user, isPending, navigate]);

  if (!isPending) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: '#f0f4f8' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <img src={asianCollegeLogo} alt="Asian College" className="w-14 h-14 object-contain rounded-xl mx-auto mb-6" />

        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>

        <h1 className="text-xl font-bold mb-1" style={{ color: NAVY }}>Your Account Is Pending Approval</h1>
        <p className="text-sm text-gray-400 mb-5">{user.name}</p>

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Thanks for registering, {user.name.split(' ')[0]}! The Alumni Office still needs to review and approve your account
          before you can access the portal. This is usually quick — please check back soon.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-bold">Signed in as:</span> {user.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 text-gray-600 font-bold rounded-xl border-2 border-gray-200 transition-all hover:bg-gray-50"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3 text-left">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-gray-100">
            <Mail className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">Need help?</span> Contact the Alumni Admin Office at{' '}
            <a href="mailto:admin@asiancollege.edu.ph" className="font-medium hover:underline" style={{ color: NAVY }}>admin@asiancollege.edu.ph</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
