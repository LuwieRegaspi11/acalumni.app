// =====================================================================
// TERMS MODAL — shown from the sign-up form's "Terms" / "Privacy
// Policy" links (see AuthPage.tsx). The agreement checkbox stays
// disabled until the user has opened this modal and scrolled its
// content all the way to the bottom; clicking "I have read and agree"
// closes the modal and checks the box for them. Content itself lives
// in src/app/content/TermsAndPrivacyContent.tsx, shared with the
// standalone /terms page.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle } from 'lucide-react';
import TermsAndPrivacyContent, { NAVY, TOS_ANCHOR, PRIVACY_ANCHOR } from '../../content/TermsAndPrivacyContent';

// How close to the bottom (in px) counts as "reached the end" — a
// little slack so sub-pixel layout rounding doesn't strand a user who
// visibly scrolled all the way down.
const SCROLL_END_THRESHOLD = 24;

export default function TermsModal({
  open,
  onClose,
  onAgree,
  alreadyAgreed = false,
  initialAnchor,
}: {
  open: boolean;
  onClose: () => void;
  onAgree: () => void;
  /** true once the user has already reached the end in a previous opening — lets them reopen just to re-read without re-gating the button. */
  alreadyAgreed?: boolean;
  /** which section to scroll to on open — 'tos' or 'privacy' depending on which link was clicked. */
  initialAnchor?: typeof TOS_ANCHOR | typeof PRIVACY_ANCHOR;
}) {
  const [reachedEnd, setReachedEnd] = useState(alreadyAgreed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Reset/seed scroll-gate state each time the modal opens, and jump to
  // whichever section the user's link click was for.
  useEffect(() => {
    if (!open) return;
    setReachedEnd(alreadyAgreed);
    const el = scrollRef.current;
    if (!el) return;
    // Defer to after paint so the anchor element is actually laid out.
    requestAnimationFrame(() => {
      if (initialAnchor) {
        const target = el.querySelector<HTMLElement>(`#${initialAnchor}`);
        if (target) {
          el.scrollTop = target.offsetTop - el.offsetTop;
          return;
        }
      }
      el.scrollTop = 0;
    });
    closeButtonRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAnchor]);

  // A short document already fits without scrolling at all — don't
  // strand the user with a permanently-disabled button in that case.
  useEffect(() => {
    if (!open || reachedEnd) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.clientHeight <= SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  }, [open, reachedEnd]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + SCROLL_END_THRESHOLD) {
      setReachedEnd(true);
    }
  };

  // Escape to close, Tab/Shift+Tab trapped within the dialog.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock background scroll while the modal is open, and restore
  // whatever the page's overflow was before, once it closes.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  // Rendered via a portal straight onto <body> — this is a full-viewport
  // overlay that must sit above (and be centered independently of) the
  // auth page's left/right columns, so it can't live inside their
  // width-constrained, overflow-hidden flex layout. Fixed positioning
  // alone can still get trapped by an ancestor that establishes its own
  // containing block (transform/filter/etc.); a portal sidesteps that
  // entirely regardless of what the auth page's layout does.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 id="terms-modal-title" className="text-base font-bold" style={{ color: NAVY }}>
            Terms of Service &amp; Privacy Policy
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto px-5 sm:px-7 py-5 flex-1"
        >
          <TermsAndPrivacyContent />
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-4 border-t border-gray-100 flex-shrink-0">
          {!reachedEnd && (
            <p className="text-xs text-gray-400 mb-3 text-center">
              Scroll to the bottom to enable the agree button.
            </p>
          )}
          <button
            type="button"
            disabled={!reachedEnd}
            onClick={() => { onAgree(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none hover:opacity-90 hover:shadow-lg"
            style={{ background: NAVY }}
          >
            <CheckCircle className="w-4 h-4" /> I have read and agree
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
