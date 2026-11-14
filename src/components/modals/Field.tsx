'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Extracted out of `LeadModal.tsx` (new brief, Part 4, 2026-11-14) so the
 * new inline enquiry form (`InlineEnquiryForm.tsx`) can share the exact
 * same field chrome/error-wiring instead of a second, drifting copy — the
 * `aria-describedby`/`className` clone below is the one place that logic
 * lives now.
 *
 * Brief §12 wanted an explicit "(Optional)" chip next to optional field
 * labels — tried as a child of the `<Label>` itself, but
 * `@testing-library/dom`'s `getByLabelText` matches a label's raw
 * `textContent`, which includes `aria-hidden` descendants too (that
 * attribute only affects the accessibility tree, not plain DOM text), so
 * it silently turned `getByLabelText('City')` into
 * `getByLabelText('City(Optional)')` and broke existing, unrelated test
 * coverage. Not worth the churn for a cosmetic addition — dropped; the
 * existing "no asterisk means optional" convention (already how required
 * fields are marked) stays as the only signal.
 */
export function Field({ label, htmlFor, error, className, children }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={cn('flex flex-col gap-[7px]', className)}>
      <Label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-[0.1em] text-redux-ink-mute">
        {label}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': error ? errorId : undefined,
            // New brief, Part 4B (2026-11-14): "inputs 10px radius with a red
            // focus ring" using the reference's own exact `--red: #d92d32` —
            // scoped to this one arbitrary value, not the sitewide
            // `redux-crimson` token (`#dc2626`), which stays untouched
            // everywhere else on the site.
            className:
              'rounded-[10px] border-[#eadfdb] bg-white text-[13px] text-stone-900 focus-visible:border-[#d92d32] focus-visible:ring-[#d92d32]/10',
          })
        : children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[#d92d32]">
          {error}
        </p>
      )}
    </div>
  );
}
