// =====================================================================
// TERMS PAGE — the full "Terms of Service & Privacy Policy" document
// as a standalone route. The actual copy lives in
// src/app/content/TermsAndPrivacyContent.tsx (shared with the sign-up
// "read before you check the box" modal, see shared/TermsModal.tsx) —
// this file is just the page chrome around it.
// =====================================================================
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import asianCollegeLogo from '../../imports/asiancollege_logo.jpeg';
import TermsAndPrivacyContent, { NAVY, BLUE, LAST_UPDATED, TOS_ANCHOR, PRIVACY_ANCHOR } from '../content/TermsAndPrivacyContent';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/register'))}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <img src={asianCollegeLogo} alt="Asian College" className="w-7 h-7 object-contain rounded-md" />
          <span className="text-sm font-bold" style={{ color: NAVY }}>
            Asian College Alumni Tracer &amp; Donation System
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
          <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>Terms of Service &amp; Privacy Policy</h1>
          <p className="text-xs text-gray-400 mb-1">Asian College Alumni Tracer &amp; Donation System</p>
          <p className="text-xs text-gray-400 mb-6">Last updated: {LAST_UPDATED}</p>

          {/* Quick jump */}
          <div className="flex flex-wrap gap-2 mb-8">
            <a href={`#${TOS_ANCHOR}`} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color: BLUE, background: '#EEF3FB' }}>Terms of Service</a>
            <a href={`#${PRIVACY_ANCHOR}`} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color: BLUE, background: '#EEF3FB' }}>Privacy Policy</a>
          </div>

          <TermsAndPrivacyContent />
        </div>
      </div>
    </div>
  );
}
