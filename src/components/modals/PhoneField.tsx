'use client';

import { useState } from 'react';
import { type Control, useController } from 'react-hook-form';

import { CALLING_CODES, combinePhone, isValidLocalNumber, parsePhone } from '@/lib/calling-codes';
import { cn } from '@/lib/utils';
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
 * The wrapper carries `min-h-[44px]` (Name's own `Input` component's
 * min-height) with no padding of its own — the select/input inside carry
 * `Input`'s own padding instead — so the box is one continuous border, not
 * a padded outer box around two already-padded children.
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
    // No padding/height utilities here on purpose — `min-h-[44px]` pins the
    // box to the exact same height as the Name field's `Input`, and the
    // select/input below carry `Input`'s own `px-4 py-[13px]` instead of the
    // wrapper, so the border is one continuous box rather than a padded
    // outer box around two already-padded children.
    <div
      // New brief (2026-11-15, final corrections), item 7: "the whole
      // bordered box turns red" — this plain `<div>` has no `aria-invalid`
      // of its own to key a CSS selector off (only the inner `<input>`
      // does, which is a real form control), so a `data-invalid` attribute
      // carries the same signal for `Field`'s `data-[invalid=true]:` rule.
      data-invalid={ariaInvalid || looksIncomplete || undefined}
      className={cn(
        'flex min-h-[44px] items-stretch overflow-hidden focus-within:border-[#d92d32] focus-within:ring-[3px] focus-within:ring-[#d92d32]/[0.08]',
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
        className="shrink-0 border-r border-[#eadfdb] bg-stone-50 pl-3 pr-1.5 py-[13px] text-[13px] text-stone-900 focus-visible:bg-[#d92d32]/10 focus-visible:outline-none"
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
        className="min-w-0 flex-1 bg-transparent px-4 py-[13px] text-[13px] text-stone-900 focus-visible:outline-none"
      />
    </div>
  );
}
