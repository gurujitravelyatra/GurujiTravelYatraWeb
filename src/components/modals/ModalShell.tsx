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
}

/**
 * `.mask` / `.modal` chrome — backdrop blur, rounded-22, shadow-gty-modal,
 * max-width 440px, max-height 90vh scrollable (tech spec §4.3). Wraps Radix
 * Dialog for the focus trap and Escape/backdrop-click-to-close, with
 * Framer Motion driving enter/exit (`forceMount` + `AnimatePresence` so the
 * exit animation gets to run before unmount).
 */
export function ModalShell({ open, onOpenChange, title, description, children }: ModalShellProps) {
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
            <div className="fixed inset-0 z-[60] flex items-center justify-center px-gx py-8">
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
                  className="max-h-[90vh] w-[440px] max-w-full overflow-auto rounded-22 bg-gty-white shadow-gty-modal focus:outline-none"
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
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
