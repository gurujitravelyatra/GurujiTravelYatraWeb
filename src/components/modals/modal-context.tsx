'use client';

import * as React from 'react';

/**
 * Real page context for the lead modal's context chip (product-spec §4:
 * "context is never re-asked"). Per BLOCKERS.md Decision F, there is
 * deliberately no fallback value here — a component that has no real
 * context to offer must omit it, never invent one (the export's own
 * `PACKS[0]` fallback is the bug being avoided).
 */
export interface ModalContext {
  label: string;
  value: string;
}

/**
 * Exported so `ModalHost` can key its "which variants have been opened at
 * least once" bookkeeping off the same union — type-only, no runtime cost.
 */
export type ModalVariant = 'enquiry' | 'brochure';

interface OpenModalState {
  variant: ModalVariant;
  context?: ModalContext;
}

interface ModalContextApi {
  modal: OpenModalState | null;
  openEnquiry: (context?: ModalContext) => void;
  openBrochure: (context?: ModalContext) => void;
  close: () => void;
}

const ModalStateContext = React.createContext<ModalContextApi | null>(null);

/**
 * Mount once near the app root (layout-level). Any Server Component tree can
 * render a small client "trigger" that calls `useModal()` without prop-
 * drilling modal state through every page — tech spec §4.3.
 */
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<OpenModalState | null>(null);
  // BLOCKERS.md §4: focus must be captured on open and restored on close —
  // required explicitly because the modal is opened imperatively from
  // arbitrary trigger components, not from a co-located `DialogTrigger`.
  const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);

  const openModal = React.useCallback((variant: ModalVariant, context?: ModalContext) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setModal({ variant, context });
  }, []);

  const close = React.useCallback(() => {
    setModal(null);
    const elementToRefocus = lastFocusedElementRef.current;
    lastFocusedElementRef.current = null;
    // Deferred one tick so it runs after Radix's own unmount/focus handling.
    if (elementToRefocus) {
      requestAnimationFrame(() => elementToRefocus.focus());
    }
  }, []);

  const value = React.useMemo<ModalContextApi>(
    () => ({
      modal,
      openEnquiry: (context) => openModal('enquiry', context),
      openBrochure: (context) => openModal('brochure', context),
      close,
    }),
    [modal, openModal, close]
  );

  return <ModalStateContext.Provider value={value}>{children}</ModalStateContext.Provider>;
}

export function useModal(): ModalContextApi {
  const ctx = React.useContext(ModalStateContext);
  if (!ctx) {
    throw new Error('useModal must be used within a <ModalProvider>');
  }
  return ctx;
}
