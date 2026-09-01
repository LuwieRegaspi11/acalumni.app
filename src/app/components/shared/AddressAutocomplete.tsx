// =====================================================================
// ADDRESS AUTOCOMPLETE — free-text address search backed by OpenStreetMap's
// Nominatim geocoder, so it covers streets, landmarks, and districts (e.g.
// "Sangley Point, Cavite City" or "Malate, Manila") the same way Google
// Maps would, not just official barangay names. Styled to match
// AuthPage.tsx's InputField (floating label, same focus color) so it drops
// straight into the sign-up / complete-profile forms.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// caps its free public instance at 1 request/second and asks callers not to
// fire one per keystroke — this debounces input and aborts whatever's
// still in flight when a newer keystroke supersedes it, so a normal
// person typing an address never comes close to that limit. Results are
// restricted to the Philippines (countrycodes=ph) since that's the only
// place this app's addresses are ever in.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import { NAVY, RED } from '../AuthPage';

type AddressSuggestion = {
  id: string;   // OSM place_id — just used as the React list key
  label: string; // cleaned display_name, also what fills the field on click
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Below this length Nominatim's results are too broad to be useful and
// it's not worth spending a request on every keystroke.
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;

// The trailing ", Philippines" is implied everywhere in this app (an
// Asian College alumni system for a Philippine college) — stripping it
// keeps suggestions the same shape as the rest of the form.
function cleanDisplayName(displayName: string): string {
  return displayName.replace(/,\s*Philippines$/i, '');
}

export default function AddressAutocomplete({ label, value, onChange, placeholder, required, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const floated = focused || value.length > 0;

  // Debounced Nominatim search — re-fires on every value change, but the
  // returned cleanup (which React runs before the *next* change, and on
  // unmount) cancels both the pending debounce timer and any in-flight
  // request, so only the latest keystroke's request ever completes.
  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        countrycodes: 'ph',
        limit: '8',
      });
      fetch(`${NOMINATIM_URL}?${params}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`Nominatim returned ${res.status}`))))
        .then((results: Array<{ place_id: number; display_name: string }>) => {
          setSuggestions(results.map(r => ({ id: String(r.place_id), label: cleanDisplayName(r.display_name) })));
          setLoading(false);
        })
        .catch(err => {
          if ((err as Error).name === 'AbortError') return; // superseded by a newer keystroke
          console.error('[address] Nominatim search failed', err);
          setSuggestions([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const showDropdown = open && focused && (suggestions.length > 0 || loading);

  return (
    <div ref={wrapRef} className="w-full relative" style={{ paddingTop: '10px' }}>
      {/* Floating label — matches AuthPage.tsx's InputField */}
      <label
        className="absolute left-3 pointer-events-none transition-all duration-200 origin-left"
        style={{
          top: floated ? 0 : '50%',
          transform: floated ? 'translateY(-2px) scale(0.78)' : 'translateY(-50%) scale(1)',
          color: floated ? NAVY : '#9ca3af',
          fontWeight: floated ? 600 : 400,
          fontSize: '0.875rem',
          background: floated ? 'white' : 'transparent',
          paddingLeft: floated ? 4 : 0,
          paddingRight: floated ? 4 : 0,
          borderRadius: 2,
          lineHeight: 1,
          zIndex: 1,
        }}
      >
        {label}{required && <span style={{ color: RED }}>*</span>}
      </label>

      <div
        className="w-full relative rounded-md border bg-white transition-all duration-200"
        style={{ borderColor: focused ? NAVY : '#d1d5db' }}
      >
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder={focused ? placeholder : ''}
          required={required}
          autoComplete="off"
          className="w-full px-3 bg-transparent outline-none rounded-md text-sm text-gray-800"
          style={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '0.75rem' }}
        />
      </div>
      {showDropdown && (
        <ul className="absolute z-20 mt-1.5 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1">
          {loading && suggestions.length === 0 && (
            <li className="px-4 py-2 text-sm text-gray-400">Searching…</li>
          )}
          {suggestions.map(opt => {
            // Bold just the first comma-separated part (mirrors the old
            // barangay-list styling: the most specific part stands out,
            // the rest reads as supporting context).
            const commaIdx = opt.label.indexOf(',');
            const head = commaIdx === -1 ? opt.label : opt.label.slice(0, commaIdx);
            const rest = commaIdx === -1 ? '' : opt.label.slice(commaIdx);
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()} // keep focus so onBlur doesn't close before click registers
                  onClick={() => { onChange(opt.label); setSuggestions([]); setOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{head}</span>
                  <span className="text-gray-500">{rest}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      <p className="mt-1 text-[10px] text-gray-300">
        Address search by{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-gray-400">
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
