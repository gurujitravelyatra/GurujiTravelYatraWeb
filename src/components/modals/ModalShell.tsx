'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';

/** Motion, verbatim from globals.css tokens — never a spring, never another duration. */
const MODAL_TRANSITION = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const };

export interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Used only for the accessible (visually hidden) Dialog title/description — visible chrome is rendered by children. */
  title: string;
  description: string;
  children: React.ReactNode;
  /**
   * New brief (2026-11-15), item 4's success toast — rendered as a SIBLING
   * of the dialog card, inside the SAME `DialogPortal`, not alongside
   * `children` inside `DialogContent`. Two reasons it cannot live anywhere
   * else:
   *  1. Radix hides every element outside the Dialog's own portaled subtree
   *     from the accessibility tree while open (`aria-hidden`, so assistive
   *     tech ignores background content) — a toast rendered as a sibling
   *     of `<ModalShell>` itself, elsewhere in the page, gets caught by
   *     that and silently becomes unannounceable/unqueryable.
   *  2. `DialogContent`'s own wrapping `motion.div` animates a CSS
   *     `transform` (`scale`/`y`) while open, which creates a new
   *     containing block for any `position: fixed` descendant — a toast
   *     nested INSIDE it would be positioned relative to that animated box
   *     instead of the viewport, not stay pinned to the bottom of the screen.
   */
  toast?: React.ReactNode;
}

/**
 * `.mask` / `.modal` chrome — backdrop blur (tech spec §4.3). Wraps Radix
 * Dialog for the focus trap and Escape/backdrop-click-to-close, with
 * Framer Motion driving enter/exit (`forceMount` + `AnimatePresence` so
 * the exit animation gets to run before unmount).
 *
 * New brief (2026-11-15), item 2: the card chrome now matches the
 * reference popup exactly — a WHITE card, 32px radius, 1px `#eadfdb`
 * border, the reference's own shadow recipe, ~560px max-width. This is
 * the only consumer of `ModalShell` (both lead-modal variants), so these
 * are scoped arbitrary values rather than a sitewide token change — the
 * site's own `rounded-22`/`shadow-gty-modal`/`bg-gty-white` tokens this
 * used to carry stay defined and in use elsewhere (buttons, cards) and are
 * untouched.
 *
 * Newest brief (2026-11-15, "horizontal card"): the card is now
 * `min(1120px, 100vw - 64px)` wide from 781px up, with NO scrollbar at all
 * at that width (the content inside is sized with `clamp()`/`vh` units —
 * see `LeadModal.tsx` — to fit the required height budgets on its own,
 * rather than this shell clipping/scrolling it). Below 781px it goes back
 * to a near-full-width card with an 18px margin, where scrolling IS
 * allowed — but with its scrollbar hidden (`scrollbar-width`/
 * `::-webkit-scrollbar`), since the brief asks for scroll behaviour
 * without a visible scrollbar specifically on mobile. 781px is this
 * component's own breakpoint (arbitrary Tailwind variant), not the
 * sitewide `--gx` gutter's 760px one — that token drives page gutters
 * elsewhere and was not changed for this one component's needs.
 */
export function ModalShell({ open, onOpenChange, title, description, children, toast }: ModalShellProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogOverlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-[rgba(28,26,25,0.55)] backdrop-blur-[2px]"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={MODAL_TRANSITION}
              />
            </DialogOverlay>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-[18px] min-[781px]:p-8">
              {/*
                Radix's own onCloseAutoFocus restore is disabled here because
                focus restoration is owned explicitly by modal-context.tsx
                (BLOCKERS.md §4) — the modal is opened imperatively from
                arbitrary trigger components, not a co-located
                `DialogTrigger`, so Radix has no reliable trigger ref to
                return to, and forceMount + AnimatePresence changes Content's
                unmount timing relative to Radix's own close lifecycle.
              */}
              <DialogContent asChild forceMount onCloseAutoFocus={(event) => event.preventDefault()}>
                <motion.div
                  // New brief (2026-11-15, final corrections), item 1: the
                  // rounding bug was `overflow-visible` at desktop — with
                  // nothing clipping it, `FormStep`/`DoneStep`'s own
                  // edge-to-edge white background (square corners, no
                  // radius of its own) sat flush on top of this element's
                  // rounded one and fully hid it. `overflow-hidden` (never
                  // `-auto`/`-visible`) is what actually makes `rounded-*`
                  // visible on an element with a background-filling child —
                  // the height-budget work is what makes `hidden` safe here
                  // (nothing is expected to overflow this box at the
                  // measured desktop viewports to begin with).
                  className="w-full min-[781px]:w-[min(1120px,calc(100vw-64px))] max-h-[calc(100dvh-36px)] overflow-y-auto min-[781px]:max-h-none min-[781px]:overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-[24px] border border-[#eadfdb] bg-white shadow-[0_35px_80px_-48px_rgba(100,20,20,0.45)] focus:outline-none min-[781px]:rounded-[32px]"
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                  transition={MODAL_TRANSITION}
                >
                  <DialogTitle className="sr-only">{title}</DialogTitle>
                  <DialogDescription className="sr-only">{description}</DialogDescription>
                  {children}
                </motion.div>
              </DialogContent>
            </div>
            {toast}
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
