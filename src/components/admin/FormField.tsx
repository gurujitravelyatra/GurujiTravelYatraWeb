'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label: string;
  /** Rendered under the label — the place to say WHY a field exists. */
  hint?: string;
  error?: string;
  /** Marks the field as required to PUBLISH, which is not the same as required to save. */
  requiredToPublish?: boolean;
  children: React.ReactNode;
}

/**
 * One labelled control with its hint and error — the admin forms' field slot.
 *
 * The accessibility wiring is the reason this is a component rather than markup
 * repeated thirty times. `memory/feedback_qg_unenforced-safety-flag.md` variant
 * 3 is an entire class of defect where a message was rendered visibly and never
 * associated with anything, so a screen-reader user got the input with none of
 * the explanation. Centralising it means every field gets the same treatment and
 * no individual field can be the one that forgot:
 *
 *  - `aria-describedby` points at the hint AND the error when both exist, so
 *    neither suppresses the other;
 *  - the error carries `role="alert"` so it is announced when it appears, not
 *    only when the input is next focused;
 *  - `aria-invalid` is set on the control itself via the render prop, because a
 *    described error is not the same as a field marked invalid.
 */
export function FormField({ id, label, hint, error, requiredToPublish, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {requiredToPublish && (
          <>
            {' '}
            <span className="font-normal normal-case tracking-normal text-gty-faint">
              — required to publish
            </span>
          </>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-12 leading-relaxed text-gty-subtle">
          {hint}
        </p>
      )}

      {/*
        The control is cloned so the wiring cannot be forgotten at the call site:
        a caller passing a bare <Input> still gets id, aria-describedby and
        aria-invalid. This is what stops the "correct on paper" version of this
        component, where each field is expected to set them itself.
      */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        : children}

      {error && (
        <p id={errorId} role="alert" className="text-12-5 font-semibold text-gty-primary">
          {error}
        </p>
      )}
    </div>
  );
}
