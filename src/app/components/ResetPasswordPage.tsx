// =====================================================================
// RESET PASSWORD PAGE — landed on from the link in the password-reset
// email sent via AuthPage's "Forgot your password?" flow. Supabase
// puts the user into a temporary authenticated session for this page
// only, letting them set a new password.
// =====================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

const NAVY  = '#1B3A6B';
const BLUE  = '#2B5BA8';
const LBLUE = '#5B9BD5';
const PANEL_GRADIENT = `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${LBLUE} 100%)`;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl mb-2" style={{ color: NAVY }}>Set New Password</h2>
        <p className="text-xs text-gray-400 mb-6">Choose a new password for your account.</p>

        {done ? (
          <div className="px-3 py-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            Password updated! Redirecting you to sign in\u2026
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">{error}</div>
            )}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New Password (min. 8 characters)"
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm New Password"
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
            />
            <button type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: PANEL_GRADIENT }}>
              {loading ? 'UPDATING\u2026' : 'UPDATE PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
