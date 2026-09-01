// =====================================================================
// PHONE NUMBER FIELD — shared country-code dropdown + local number input.
//
// Wraps `react-phone-number-input` so the full ISO country list, flags,
// and dial codes come from the library (and libphonenumber-js's metadata)
// instead of a hand-maintained list. The value is always stored/emitted
// as a single E.164 string, e.g. "+639123456789".
// =====================================================================

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './phone-input.css';

export type PhoneFieldVariant = 'card' | 'compact' | 'auth';

interface PhoneNumberFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  /** 'card' matches RegistrationPage's <Field> styling (rounded-xl, border-2).
   *  'compact' matches ProfilePage's inline-edit inputs (rounded-lg, border, dark-mode aware).
   *  'auth' matches AuthPage's rounded-md/thin-border/navy-focus inputs, with a small
   *  static label above (AuthPage's other phone-adjacent fields don't use its floating
   *  label style either — see SelectField). */
  variant?: PhoneFieldVariant;
}

export default function PhoneNumberField({
  label, value, onChange, onFocus, onBlur, placeholder, required, hint, variant = 'card',
}: PhoneNumberFieldProps) {
  const field = (
    <PhoneInput
      international
      defaultCountry="PH"
      countryCallingCodeEditable={false}
      value={value || undefined}
      onChange={v => onChange(v || '')}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder || 'Phone number'}
      className={`aci-phone-input aci-phone-input--${variant}`}
      numberInputProps={{ required }}
    />
  );

  if (variant === 'auth') {
    return (
      <div className="aci-phone-field-auth">
        {label && (
          <label className="aci-phone-field-auth-label">
            {label}{required && <span className="aci-phone-field-auth-required">*</span>}
          </label>
        )}
        {field}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    );
  }

  if (!label) {
    return hint ? (<div>{field}<p className="text-xs text-gray-400 mt-1">{hint}</p></div>) : field;
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
