// =====================================================================
// TRACER FIELD CONTROLS — shared presentational form primitives for the
// Graduate Tracer Survey's UI. Extracted out of GraduateTracerForm.tsx so
// shared/JobInfoCard.tsx (the editable "Job Information" section on the
// alumni Profile page) can reuse the exact same radio/checkbox/rating
// controls instead of a second, drifting copy. GraduateTracerForm.tsx
// imports these too — this file has no logic of its own, purely markup.
// =====================================================================

import { useId } from 'react';
import { Check } from 'lucide-react';

export const inputCls = 'w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400';

// `error` — set once the user has tried to move past this field's section
// while it's unanswered (see fieldErrors() in tracerSurveySections.tsx).
// Wrapping children in the red ring rather than styling them directly
// means this works uniformly for every control type below (a plain
// input/select, RadioGroup, CheckboxGroup, RatingInput, CompetencyGrid)
// without each one needing its own error-aware border logic.
//
// <fieldset>/<legend> rather than a plain <div>/<p>: `children` here is
// sometimes a single input, sometimes a whole RadioGroup or
// CheckboxGroup (multiple native controls). A <label> can only ever
// caption one control, and a <p> captions nothing at all as far as
// assistive tech is concerned — <legend> is the one HTML label that
// correctly announces itself for either case, so this is the one place
// that needs to change for every question on the Tracer Survey to
// actually announce its label. The border/margin/padding/min-width
// resets undo the browser's default fieldset chrome (a border box plus
// a min-width that can overflow a grid cell) so this still looks exactly
// like the plain div it replaces.
export function Field({ label, required, children, hint, error }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <fieldset className="space-y-1.5 border-0 m-0 p-0 min-w-0">
      <legend className="text-sm font-semibold text-gray-700 p-0">{label}{required && <span className="text-red-500"> *</span>}</legend>
      <div className={error ? 'rounded-xl ring-2 ring-red-400' : ''}>{children}</div>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : hint && <p className="text-xs text-gray-500">{hint}</p>}
    </fieldset>
  );
}

export function RadioGroup({ options, value, onChange, hasOther, otherValue, onOtherChange, otherError, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; otherError?: string; disabled?: boolean;
}) {
  // Shared `name` groups the native radios so screen readers announce
  // "N of M" and arrow keys move between options, same as any native
  // radio group — one id per RadioGroup instance so separate questions
  // on the same page never collide.
  const groupName = useId();
  return (
    <div className="space-y-2" role="radiogroup">
      {options.map(opt => (
        <label key={opt} className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value === opt ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${disabled ? '' : 'hover:border-gray-300'}`}`}>
          {/* opacity-0 stretched over the whole label (not Tailwind's
              `sr-only`, which clips the input down to a 1x1px box) keeps
              the native input focusable and in the tab order — a
              display:none input can never receive keyboard focus, which
              would make this option unreachable and unselectable without
              a mouse. A 1x1px focus target has its own problem though:
              some Windows browser/display-scaling combinations try to
              scroll or zoom that literal pixel into view on focus, which
              visibly breaks the page layout until the user changes their
              display scaling. Sizing the invisible input to match the
              label instead gives focus a normal-sized target. The
              peer-focus-visible ring on the drawn circle stands in for
              the native focus ring browsers won't paint on a hidden input. */}
          <input type="radio" name={groupName} checked={value === opt} onChange={() => onChange(opt)} disabled={disabled} className="absolute inset-0 w-full h-full opacity-0 peer" />
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 ${value === opt ? 'border-blue-600' : 'border-gray-300'}`}>
            {value === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
          </div>
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {hasOther && value === 'Other' && (
        <div className="mt-1">
          <div className={otherError ? 'rounded-xl ring-2 ring-red-400' : ''}>
            <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
              disabled={disabled} className={inputCls} />
          </div>
          {otherError && <p className="text-xs font-semibold text-red-600 mt-1">{otherError}</p>}
        </div>
      )}
    </div>
  );
}

export function CheckboxGroup({ options, value, onChange, minSelect, maxSelect, hasOther, otherValue, onOtherChange, otherError, disabled }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; minSelect?: number; maxSelect?: number;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; otherError?: string; disabled?: boolean;
}) {
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  const atMax = typeof maxSelect === 'number' && value.length >= maxSelect;
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const checked = value.includes(opt);
        // Once maxSelect is reached, only already-checked options stay
        // clickable (to uncheck) — everything else locks until room frees up.
        const optionDisabled = disabled || (atMax && !checked);
        return (
          <label key={opt} className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${optionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${optionDisabled ? '' : 'hover:border-gray-300'}`}`}>
            {/* Stretched opacity-0 input, not `sr-only`/`hidden` — see
                RadioGroup above for why a display:none checkbox would be
                unreachable by keyboard, and why a 1x1px sr-only one is
                its own problem (a tiny focus target some Windows
                browser/scaling combinations try to zoom into view). */}
            <input type="checkbox" checked={checked} onChange={() => toggle(opt)} disabled={optionDisabled} className="absolute inset-0 w-full h-full opacity-0 peer" />
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
              {checked && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        );
      })}
      {hasOther && value.includes('Other') && (
        <div className="mt-1">
          <div className={otherError ? 'rounded-xl ring-2 ring-red-400' : ''}>
            <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
              disabled={disabled} className={inputCls} />
          </div>
          {otherError && <p className="text-xs font-semibold text-red-600 mt-1">{otherError}</p>}
        </div>
      )}
      {typeof minSelect === 'number' && (
        <p className={`text-xs font-semibold ${value.length >= minSelect ? 'text-green-600' : 'text-amber-600'}`}>
          Selected {value.length} / at least {minSelect} required
        </p>
      )}
      {typeof maxSelect === 'number' && (
        <p className={`text-xs font-semibold ${atMax ? 'text-amber-600' : 'text-gray-500'}`}>
          Selected {value.length} / up to {maxSelect}
        </p>
      )}
    </div>
  );
}

export function RatingInput({ value, onChange, lowLabel, highLabel, disabled }: { value: string; onChange: (v: string) => void; lowLabel: string; highLabel: string; disabled?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" disabled={disabled} onClick={() => onChange(String(n))}
            className={`w-11 h-11 rounded-xl border-2 font-bold text-sm transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${value === String(n) ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={value === String(n) ? { background: 'linear-gradient(135deg,#1B3A6B,#2B5BA8)' } : {}}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 max-w-[13.5rem]">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </div>
  );
}
