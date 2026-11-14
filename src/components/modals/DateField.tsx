'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type DateFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'min'>;

/**
 * New brief (2026-11-15, final corrections), item 8: "clicking anywhere on
 * the date box (not only the small calendar icon) must open the calendar."
 * A native `<input type="date">` only opens its picker on a direct click of
 * its own small calendar-icon affix — everywhere else in the box is a dead
 * click. This wraps the real input in a bordered box whose OWN click/key
 * handlers call the input's `showPicker()` explicitly, so the whole box
 * behaves like one control.
 *
 * `min` is always today — a travel date in the past is never a real
 * request.
 *
 * `showPicker()` is wrapped in try/catch (not every engine implements it,
 * and it throws if the document/element is not "in a user-activation
 * state" in some embeds) with a `.focus()` fallback — a focused native date
 * input is still directly editable via the keyboard even with no visible
 * picker.
 */
export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { className, onKeyDown, 'aria-invalid': ariaInvalid, ...props },
  forwardedRef
) {
  const localRef = React.useRef<HTMLInputElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    },
    [forwardedRef]
  );

  const openPicker = React.useCallback(() => {
    try {
      localRef.current?.showPicker();
    } catch {
      localRef.current?.focus();
    }
  }, []);

  // Today, in the `YYYY-MM-DD` a date input's `min` attribute requires.
  // Computed once per mount — a modal left open across midnight getting a
  // one-day-stale floor is not worth re-deriving on every render.
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div
      onClick={openPicker}
      // See `PhoneField.tsx`'s own comment on `data-invalid` — same reason:
      // this wrapper has no `aria-invalid` of its own for `Field`'s
      // `data-[invalid=true]:` rule to key off.
      data-invalid={ariaInvalid || undefined}
      className={cn(
        'flex min-h-[44px] w-full cursor-pointer items-center rounded-[10px] border border-[#eadfdb] bg-white px-4 py-[13px] text-[13px] text-stone-900',
        className
      )}
    >
      <input
        ref={setRefs}
        type="date"
        min={today}
        aria-invalid={ariaInvalid}
        className="w-full min-w-0 cursor-pointer border-none bg-transparent p-0 text-inherit outline-none"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            // Not preventDefault()ed — Space already opens the native
            // picker in some browsers, and calling `showPicker()` again
            // while it is already open is a harmless no-op there.
            openPicker();
          }
          onKeyDown?.(event);
        }}
        {...props}
      />
    </div>
  );
});
