import { useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';

// ================= [SHARED: CURRENCYAMOUNTFIELD] =================
// One currency-style amount input, shared by every place someone types a
// peso figure into this app: the admin/faculty campaign goal amount
// (CampaignFormModal) and the alumni + batch rep donation amount forms
// (DonationPortal, RepDonationMonitor). Centralizing it means the
// formatting rules — and any future fix to them — live in one place
// instead of three drifting copies.
//
// Contract: `value`/`onChange` always carry the plain, comma-free numeric
// string a form already stores ("10000" or "10000.5" or "" while empty)
// — never the on-screen formatted text. That keeps this a drop-in
// replacement for a bare <input type="number">: existing `parseFloat(...)`
// / `Number(...)` calls at submit time keep working unchanged, and
// nothing downstream ever has to strip commas itself. Grouping is done
// with Intl.NumberFormat rather than a hand-rolled "insert a comma every
// 3 digits" regex.
//
// Negative amounts aren't just rejected, they're unrepresentable: every
// keystroke and paste is sanitized down to [0-9.] before it ever reaches
// state, so a minus sign (or letters, or a second decimal point) never
// survives long enough to be "invalid input" — there's simply nothing to
// reject.

interface CurrencyAmountFieldProps {
  label?: string;
  /** Plain numeric string, no commas — e.g. "10000.5" or "". */
  value: string;
  /** Emits the same plain, comma-free format on every change. */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  /** Shown as a fixed prefix inside the field, e.g. "₱". */
  currencySymbol?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const groupFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fixedFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Reduces arbitrary typed or pasted text down to a valid, possibly partial
// amount: digits only, at most one decimal point, at most 2 digits after
// it. No sign of any kind survives this pass.
function sanitize(input: string): string {
  let s = input.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  }
  return s;
}

// Groups the integer part with thousand separators live, via
// Intl.NumberFormat (BigInt-based so very large goal amounts still group
// correctly rather than risking float precision loss). The decimal part
// is left exactly as typed — padding to 2 places is a `formatFixed` job,
// applied only on blur, so "10.5" doesn't jump to "10.50" mid-keystroke.
function formatLive(sanitized: string): string {
  if (sanitized === '') return '';
  const [intRaw, decRaw] = sanitized.split('.');
  const intDigits = intRaw.replace(/^0+(?=\d)/, '');
  const grouped = intDigits === '' ? '0' : groupFormatter.format(BigInt(intDigits));
  return decRaw === undefined ? grouped : `${grouped}.${decRaw}`;
}

// Settled display once the field isn't being actively edited: grouped,
// and always exactly 2 decimal places.
function formatFixed(sanitized: string): string {
  if (sanitized === '') return '';
  return fixedFormatter.format(Number(sanitized));
}

export default function CurrencyAmountField({
  label, value, onChange, placeholder, required, hint, currencySymbol, id, className, disabled,
}: CurrencyAmountFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawBefore = e.target.value;
    const caretBefore = e.target.selectionStart ?? rawBefore.length;
    const cleaned = sanitize(rawBefore);
    onChange(cleaned);

    // Restore the caret at the same *digit* position after React re-renders
    // with the newly-grouped text — otherwise a comma appearing ahead of
    // the caret would silently push it backwards on every keystroke.
    const keptBeforeCaret = rawBefore.slice(0, caretBefore).replace(/[^0-9.]/g, '').length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const formatted = formatLive(cleaned);
      let seen = 0, pos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9.]/.test(formatted[i])) seen++;
        if (seen === keptBeforeCaret) { pos = i + 1; break; }
      }
      el.setSelectionRange(pos, pos);
    });
  };

  // Belt-and-suspenders on top of sanitize(): the minus sign never even
  // reaches the input's value, keystroke or paste, so there's no flash of
  // a rejected "-" before it disappears.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'Subtract') e.preventDefault();
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    // Land the caret at the end rather than wherever the fixed-format
    // string happens to put it relative to the mouse click.
    requestAnimationFrame(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length));
  };

  const handleBlur = () => setFocused(false);

  const displayValue = focused ? formatLive(value) : formatFixed(value);

  const field = (
    <div className="relative">
      {currencySymbol && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          {currencySymbol}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || '0.00'}
        className={
          className ||
          `w-full text-sm border border-gray-200 rounded-xl py-2.5 focus:outline-none focus:border-blue-400 ${currencySymbol ? 'pl-7 pr-3' : 'px-3'}`
        }
      />
    </div>
  );

  if (!label) {
    return hint ? (<div>{field}<p className="text-xs text-gray-400 mt-1">{hint}</p></div>) : field;
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-gray-500 mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
