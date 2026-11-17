'use client';

import * as React from 'react';

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

/** Joins class strings WITHOUT tailwind-merge: the `enquiry-*` token classes are unknown to it and it would drop the wrong ones. */
export function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * The reference card's input box (reference match, 2026-11-17; see
 * design-review/enquiry-card/reference-spec.md §3.3): white, 1px line
 * border, 10px radius, 13px/19.5px ink text, red border + 3px soft ring on
 * focus, no transition. Cloned onto `Field`'s single child — a plain
 * input/textarea, or the `PhoneField`/`DateField` wrapper box.
 *
 * Invalid state (kept from the earlier brief, not in the reference): the
 * whole box turns red. `PhoneField`/`DateField`'s wrapper divs have no
 * `aria-invalid` of their own, so they carry `data-invalid="true"` instead.
 */
export const FIELD_BOX_CLASS =
  'rounded-10 border border-enquiry-line bg-white text-13 leading-[19.5px] text-enquiry-ink outline-none focus:border-enquiry-red focus:[box-shadow:var(--shadow-enquiry-focus)] aria-[invalid=true]:border-enquiry-red data-[invalid=true]:border-enquiry-red';

/** The inner padding of a text entry: 14px 15px at the reference size, never under 44px total height (see `--spacing-enquiry-field-y`). */
export const FIELD_PADDING_CLASS = 'px-3.75 py-enquiry-field-y';

/** A plain text input or textarea inside a `Field`. */
export const FIELD_INPUT_CLASS = `block w-full ${FIELD_PADDING_CLASS} placeholder:text-enquiry-placeholder`;

/**
 * `LeadModal.tsx`'s field chrome/error-wiring, extracted into its own
 * module — the `aria-describedby`/`className` clone below is the one
 * place that logic lives.
 *
 * New brief (2026-11-15, final corrections), item 6: "(Optional)" is back,
 * in red, as part of the real `<label>` text (not `aria-hidden`), so
 * `getByLabelText('City')`'s accessible name is `'City (Optional)'`.
 *
 * Reference match (2026-11-17): a block label (10px/15px, 700, 0.1em,
 * uppercase, muted) 7px above the box, a 9px red marker, and 17px below
 * every field. Vertical spacing uses the `enquiry-*` spacing tokens, which
 * shrink on short desktop screens (see `--enquiry-fit` in globals.css).
 */
export function Field({ label, htmlFor, error, className, children, required, optional }: FieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={joinClasses('mb-enquiry-17', className)}>
      <label
        htmlFor={htmlFor}
        className="mb-enquiry-7 block text-10 font-bold uppercase leading-[15px] tracking-th text-enquiry-muted"
      >
        {label}
        {required && <span className="text-9 leading-[1.5] text-enquiry-red"> *</span>}
        {optional && <span className="text-9 leading-[1.5] text-enquiry-red"> (Optional)</span>}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ className?: string; 'aria-describedby'?: string }>, {
            'aria-describedby': error ? errorId : undefined,
            className: joinClasses(
              (children as React.ReactElement<{ className?: string }>).props.className,
              FIELD_BOX_CLASS
            ),
          })
        : children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-enquiry-red">
          {error}
        </p>
      )}
    </div>
  );
}
