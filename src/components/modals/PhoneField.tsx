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
 */
export function PhoneField({
  control,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: PhoneFieldProps) {
  const { field } = useController({ control, name: 'mobile' });
  const [{ callingCode, localNumber }, setParts] = useState(() => parsePhone(field.value));
  const codeSelectId = `${id}-code`;

  const update = (nextCode: string, nextNumber: string) => {
    setParts({ callingCode: nextCode, localNumber: nextNumber });
    field.onChange(combinePhone(nextCode, nextNumber));
  };

  const looksIncomplete = localNumber.length > 0 && !isValidLocalNumber(callingCode, localNumber);

  return (
    <div className={cn('flex items-stretch overflow-hidden', className)}>
      <label htmlFor={codeSelectId} className="sr-only">
        Country code
      </label>
      <select
        id={codeSelectId}
        value={callingCode}
        onChange={(event) => update(event.target.value, localNumber)}
        className="shrink-0 border-r border-stone-200 bg-stone-50 pl-2.5 pr-1 text-[13px] text-stone-900 focus-visible:outline-none"
      >
        {CALLING_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.flag} {entry.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        name={field.name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="00000 00000"
        value={localNumber}
        aria-invalid={ariaInvalid || looksIncomplete}
        aria-describedby={ariaDescribedBy}
        onBlur={field.onBlur}
        onChange={(event) => update(callingCode, event.target.value.replace(/[^\d\s-]/g, ''))}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-stone-900 focus-visible:outline-none"
      />
    </div>
  );
}
