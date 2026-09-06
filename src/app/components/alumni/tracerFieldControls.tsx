// =====================================================================
// TRACER FIELD CONTROLS — shared presentational form primitives for the
// Graduate Tracer Survey's UI. Extracted out of GraduateTracerForm.tsx so
// shared/JobInfoCard.tsx (the editable "Job Information" section on the
// alumni Profile page) can reuse the exact same radio/checkbox/rating
// controls instead of a second, drifting copy. GraduateTracerForm.tsx
// imports these too — this file has no logic of its own, purely markup.
// =====================================================================

import { Check } from 'lucide-react';

export const inputCls = 'w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-400';

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</p>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function RadioGroup({ options, value, onChange, hasOther, otherValue, onOtherChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value === opt ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${disabled ? '' : 'hover:border-gray-300'}`}`}>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-blue-600' : 'border-gray-300'}`}>
            {value === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
          </div>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} disabled={disabled} className="hidden" />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {hasOther && value === 'Other' && (
        <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
          disabled={disabled} className={`${inputCls} mt-1`} />
      )}
    </div>
  );
}

export function CheckboxGroup({ options, value, onChange, minSelect, maxSelect, hasOther, otherValue, onOtherChange, disabled }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; minSelect?: number; maxSelect?: number;
  hasOther?: boolean; otherValue?: string; onOtherChange?: (v: string) => void; disabled?: boolean;
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
          <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${optionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-blue-500 bg-blue-50' : `border-gray-200 ${optionDisabled ? '' : 'hover:border-gray-300'}`}`}>
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
              {checked && <Check className="w-3 h-3 text-white" />}
            </div>
            <input type="checkbox" checked={checked} onChange={() => toggle(opt)} disabled={optionDisabled} className="hidden" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        );
      })}
      {hasOther && value.includes('Other') && (
        <input value={otherValue || ''} onChange={e => onOtherChange?.(e.target.value)} placeholder="Please specify…"
          disabled={disabled} className={`${inputCls} mt-1`} />
      )}
      {typeof minSelect === 'number' && (
        <p className={`text-xs font-semibold ${value.length >= minSelect ? 'text-green-600' : 'text-amber-600'}`}>
          Selected {value.length} / at least {minSelect} required
        </p>
      )}
      {typeof maxSelect === 'number' && (
        <p className={`text-xs font-semibold ${atMax ? 'text-amber-600' : 'text-gray-400'}`}>
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
      <div className="flex justify-between text-xs text-gray-400 mt-1 max-w-[13.5rem]">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </div>
  );
}
