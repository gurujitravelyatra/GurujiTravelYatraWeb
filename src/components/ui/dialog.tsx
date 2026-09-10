'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/utils';

/**
 * Thin, unstyled-motion wrapper around Radix Dialog primitives. Visual
 * chrome (`.mask`/`.modal` — backdrop blur, rounded-22, shadow-gty-modal) and
 * enter/exit animation live in `ModalShell.tsx` (Framer Motion, gated by
 * `useReducedMotion()`), not here — this file only supplies the accessible
 * primitives (focus trap, Escape/backdrop-click-to-close, portal) so they
 * can be composed with `forceMount` + `AnimatePresence`.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn(className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn(className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogTitle, DialogDescription };
export const DialogOverlay = DialogPrimitive.Overlay;
export const DialogContent = DialogPrimitive.Content;
