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
  /** Red " *" appended to the label — item 6's own audited-required fields only (Name, Mobile Number). */
  required?: boolean;
  /** Red " (Optional)" appended to the label — every other field, per the same audit. */
  optional?: boolean;
}

/**
 * `LeadModal.tsx`'s field chrome/error-wiring, extracted into its own
 * module — the `aria-describedby`/`className` clone below is the one
 * place that logic lives.
 *
 * New brief (2026-11-15, final corrections), item 6: "(Optional)" is back,
 * in red, as part of the real `<Label>` text (not `aria-hidden`) — this
 * DOES change `getByLabelText('City')`'s accessible name to
 * `'City (Optional)'`, which is exactly the earlier round's own documented
 * reason for dropping it. That tradeoff is accepted explicitly this time:
 * every test asserting on one of these labels was updated to the new name
 * rather than this component working around the brief a second time.
 */
export function Field({ label, htmlFor, error, className, children, required, optional }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={cn('flex flex-col gap-[clamp(4px,1vh,7px)]', className)}>
      <Label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-[0.1em] text-redux-ink-mute">
        {label}
        {required && <span className="text-[#d92d32]"> *</span>}
        {optional && <span className="text-[#d92d32]"> (Optional)</span>}
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
            //
            // New brief (2026-11-15, final corrections), item 7: the whole
            // bordered box turns red on an invalid field, including the
            // `PhoneField`/`DateField` wrapper DIVs that have no
            // `aria-invalid` of their own to key off (only their inner
            // `<input>` does) — those two instead carry a plain
            // `data-invalid="true"` attribute for exactly this selector to
            // catch; `Input`/`Textarea` already set real `aria-invalid`
            // themselves, so `aria-[invalid=true]:` covers them for free.
            className:
              'min-h-[clamp(32px,6vh,44px)] rounded-[10px] border-[#eadfdb] bg-white text-[13px] text-stone-900 focus-visible:border-[#d92d32] focus-visible:ring-[3px] focus-visible:ring-[#d92d32]/[0.08] aria-[invalid=true]:border-[#d92d32] data-[invalid=true]:border-[#d92d32]',
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
