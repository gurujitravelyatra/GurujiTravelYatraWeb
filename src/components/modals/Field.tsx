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
 * `LeadModal.tsx`'s field chrome/error-wiring, extracted into its own
 * module — the `aria-describedby`/`className` clone below is the one
 * place that logic lives.
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
    <div className={cn('flex flex-col gap-[clamp(4px,1vh,7px)]', className)}>
      <Label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-[0.1em] text-redux-ink-mute">
        {label}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': error ? errorId : undefined,
            // New brief, Part 4B (2026-11-14), refined 2026-11-15: "inputs
            // 10px radius with a red focus ring (border #d92d32 + 3px
            // rgba(217,45,50,.08))" — the reference's own exact `--red:
            // #d92d32`, scoped to this one arbitrary value, not the
            // sitewide `redux-crimson` token (`#dc2626`), which stays
            // untouched everywhere else on the site.
            //
            // New brief (2026-11-15, "horizontal card"): `min-h-[...]`
            // overrides `Input`'s own fixed 44px / `Textarea`'s own fixed
            // 56px (tailwind-merge lets this later value win) with a `vh`-
            // scaled one instead — part of the height budget `FormStep`'s
            // own header explains; at a normal-height viewport it clamps
            // right back up near 44px, so nothing changes there.
            className:
              'min-h-[clamp(32px,6vh,44px)] rounded-[10px] border-[#eadfdb] bg-white text-[13px] text-stone-900 focus-visible:border-[#d92d32] focus-visible:ring-[3px] focus-visible:ring-[#d92d32]/[0.08]',
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
