export interface CallingCode {
  /** E.164 calling code, with the leading `+` — "+91". */
  code: string;
  country: string;
  flag: string;
}

/**
 * Brief §E2 (2026-11-14): "a searchable list of common codes such as +91,
 * +1, +44, +971, +65, +61, +49, +33" — exactly that list, India first
 * (the default), longest/most-specific codes are not needed here since
 * every entry in this short list is already unambiguous.
 */
export const CALLING_CODES: readonly CallingCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
] as const;

export const DEFAULT_CALLING_CODE = '+91';

export interface ParsedPhone {
  callingCode: string;
  localNumber: string;
}

/**
 * Splits a combined `mobile` form value ("+919876543210") back into a
 * calling code + local number for display — e.g. when the modal reopens
 * with a previously-typed value, or a form reset restores a default. Falls
 * back to `DEFAULT_CALLING_CODE` with the whole value treated as the local
 * number when nothing in `CALLING_CODES` prefixes it (including the common
 * case of an empty string, or a bare local number with no `+` at all).
 */
export function parsePhone(combined: string): ParsedPhone {
  const trimmed = combined.trim();
  const match = CALLING_CODES.find((entry) => trimmed.startsWith(entry.code));
  if (match) {
    return { callingCode: match.code, localNumber: trimmed.slice(match.code.length).trim() };
  }
  return { callingCode: DEFAULT_CALLING_CODE, localNumber: trimmed.replace(/^\+/, '') };
}

/** Joins a calling code + local number into the combined value the `mobile` form field stores and submits. */
export function combinePhone(callingCode: string, localNumber: string): string {
  return `${callingCode}${localNumber.trim()}`;
}

/**
 * Brief §E2's own validation rule for the by-far most common case this
 * site serves (India): exactly 10 digits, starting 6-9. Other calling
 * codes fall back to `leadFormSchema`'s pre-existing general
 * length/character check (6-15 digits) — a full per-country digit-length
 * table was not built, since `src/server/leads/lead-schema.ts` (the real
 * `POST /api/leads` contract) is explicitly out of scope to change, and
 * this client-only refinement must never be stricter than what that
 * unchanged server regex actually accepts.
 */
export function isValidLocalNumber(callingCode: string, localNumber: string): boolean {
  const digits = localNumber.replace(/[\s-]/g, '');
  if (callingCode === '+91') {
    return /^[6-9]\d{9}$/.test(digits);
  }
  return /^\d{6,15}$/.test(digits);
}
