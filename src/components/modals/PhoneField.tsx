'use client';

import { useState } from 'react';
import { type Control, useController } from 'react-hook-form';

import { CALLING_CODES, combinePhone, isValidLocalNumber, parsePhone } from '@/lib/calling-codes';
import { FIELD_PADDING_CLASS, joinClasses } from './Field';
import type { LeadFormValues } from './lead-form-schema';

export interface PhoneFieldProps {
  control: Control<LeadFormValues>;
  id: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Brief §E2 (2026-11-14): a country-code selector inside the phone input,
 * "+91" pre-filled, editable, the number typed after it — still writing
 * into the SAME `mobile` RHF field `leadFormSchema`/the server's
 * `POST /api/leads` contract already validate, so no schema changes
 * anywhere (standing rule). `combinePhone()` joins the two parts into
 * exactly the string those unchanged regexes expect
 * (`/^[+]?[\d\s-]{10,15}$/`): a leading `+`, the calling code's digits,
 * then the local number, spaces/hyphens allowed throughout.
 *
 * A native `<select>` for the code, not a custom combobox — it is already
 * keyboard-accessible and type-ahead "searchable" (the brief's own word)
 * with zero extra JS, for a list this short (8 entries).
 *
 * Rendered as `Field`'s single child in `LeadModal.tsx`, so `Field` clones
 * the bordered-box `className` and `aria-describedby` directly onto THIS
 * component's props (not onto a plain `<input>`) — both are read below and
 * applied where they actually belong: the box styling on the outer
 * wrapper, `aria-describedby`/`aria-invalid` on the real text entry.
 *
 * New brief (2026-11-15), item 2: "the phone field must look exactly like
 * the Name field — one full-width white bordered box of the SAME HEIGHT".
 * The wrapper has no padding of its own — the select/input inside carry the
 * same `FIELD_PADDING_CLASS` as the Name input (reference match,
 * 2026-11-17: 49.5px tall at the reference size, never under 44px) — so the
 * box is one continuous border, not a padded outer box around two
 * already-padded children.
 *
 * `ref={numberInputRef}` (destructured off `field.ref` below, rather than
 * read as `field.ref` at the JSX call site — the latter trips the newer
 * `react-hooks/refs` lint rule's conservative "ref-shaped value read during
 * render" heuristic on a plain react-hook-form callback ref) matters beyond
 * styling: it is what lets react-hook-form's own `shouldFocusError` (on by
 * default) actually move focus to this field when it is the first one with
 * an error — every other field in this form is a plain `register()`ed
 * `<input>`, which wires its `ref` automatically; this is the one
 * `useController` field, and without handing the ref back RHF has nothing
 * to call `.focus()` on.
 */
export function PhoneField({
  control,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: PhoneFieldProps) {
  const {
    field: { ref: numberInputRef, onBlur, name: fieldName, value: fieldValue, onChange: fieldOnChange },
  } = useController({ control, name: 'mobile' });
  const [{ callingCode, localNumber }, setParts] = useState(() => parsePhone(fieldValue));
  const codeSelectId = `${id}-code`;

  const update = (nextCode: string, nextNumber: string) => {
    setParts({ callingCode: nextCode, localNumber: nextNumber });
    fieldOnChange(combinePhone(nextCode, nextNumber));
  };

  const looksIncomplete = localNumber.length > 0 && !isValidLocalNumber(callingCode, localNumber);

  return (
    // `Field` normally puts its red keyboard-focus ring on the single input
    // it clones `className` onto directly (`:focus-visible` matches the
    // focused element itself) — this wrapper is never itself focused, so
    // `focus-within` is what has to carry that same red ring here, as an
    // addition alongside (not instead of) the cloned border/background.
    // No padding/height utilities here on purpose — the select/input below
    // carry the Name input's own padding, so the box is the same height and
    // one continuous border.
    <div
      // New brief (2026-11-15, final corrections), item 7: "the whole
      // bordered box turns red" — this plain `<div>` has no `aria-invalid`
      // of its own to key a CSS selector off (only the inner `<input>`
      // does, which is a real form control), so a `data-invalid` attribute
      // carries the same signal for `Field`'s `data-[invalid=true]:` rule.
      data-invalid={ariaInvalid || looksIncomplete || undefined}
      className={joinClasses(
        'flex items-stretch overflow-hidden focus-within:border-enquiry-red focus-within:[box-shadow:var(--shadow-enquiry-focus)]',
        className
      )}
    >
      <label htmlFor={codeSelectId} className="sr-only">
        Country code
      </label>
      <select
        id={codeSelectId}
        value={callingCode}
        onChange={(event) => update(event.target.value, localNumber)}
        className="shrink-0 border-r border-enquiry-line bg-stone-50 py-enquiry-field-y pl-3 pr-1.5 text-13 leading-[19.5px] text-enquiry-ink focus-visible:bg-enquiry-red/10 focus-visible:outline-none"
      >
        {CALLING_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.flag} {entry.code}
          </option>
        ))}
      </select>
      <input
        ref={numberInputRef}
        id={id}
        name={fieldName}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="00000 00000"
        value={localNumber}
        aria-invalid={ariaInvalid || looksIncomplete}
        aria-describedby={ariaDescribedBy}
        onBlur={onBlur}
        onChange={(event) => update(callingCode, event.target.value.replace(/[^\d\s-]/g, ''))}
        className={`min-w-0 flex-1 bg-transparent ${FIELD_PADDING_CLASS} text-13 leading-[19.5px] text-enquiry-ink placeholder:text-enquiry-placeholder focus-visible:outline-none`}
      />
    </div>
  );
}
