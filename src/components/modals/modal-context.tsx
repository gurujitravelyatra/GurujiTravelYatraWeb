'use client';

import * as React from 'react';

import { EMPTY_TRIP_LABEL, tripRouteSummary, type LeadDetails, type LeadTripStop } from './lead-details';

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
  /**
   * The `formType`-tagged payload context. ABSENT for the two generic openers
   * — `LeadModal` derives `enquiry`/`brochure` from `variant` + `context` in
   * that case, which is exactly what those forms mean. Present only when a
   * trigger has richer structured context to transmit than a display string.
   */
  details?: LeadDetails;
}

/** Everything `TripBuilder` has collected. Named for the builder's own state so the mapping is one-to-one. */
export interface CustomTripContext {
  stops: readonly LeadTripStop[];
  travelStyle?: LeadTripStopStyle;
  travelMonth?: string;
  adults?: number;
  childrenCount?: number;
  notes?: string;
}

type LeadTripStopStyle = Extract<LeadDetails, { formType: 'custom-trip' }>['travelStyle'];

export interface GroupReservationContext {
  departureName: string;
  /** `GroupDeparture.dateRangeLabel` — required; the server's tag is built from it. */
  batchDate: string;
}

interface ModalContextApi {
  modal: OpenModalState | null;
  openEnquiry: (context?: ModalContext) => void;
  openBrochure: (context?: ModalContext) => void;
  /**
   * "Reserve a Seat". Opens the SAME enquiry modal it always has — the visitor
   * still has to supply name/mobile somewhere and the card collects none — but
   * tags the submission `group-tour-reservation` and carries the batch date,
   * which previously reached no payload at all.
   */
  openGroupReservation: (departure: GroupReservationContext) => void;
  /**
   * "Get My Custom Quote". Same modal, same chip, but the trip itself now
   * travels with it instead of being flattened to a route string and dropped.
   */
  openCustomTrip: (trip: CustomTripContext) => void;
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

  const openModal = React.useCallback((variant: ModalVariant, context?: ModalContext, details?: LeadDetails) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setModal({ variant, context, details });
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
      // Both of these open the `'enquiry'` VARIANT deliberately: variant picks
      // the modal's copy and field set, `formType` picks the payload. The two
      // were the same thing only because there were only ever two of each.
      openGroupReservation: ({ departureName, batchDate }) =>
        openModal(
          'enquiry',
          { label: 'Group Tour', value: departureName },
          { formType: 'group-tour-reservation', batchDate, departureName }
        ),
      openCustomTrip: ({ stops, travelStyle, travelMonth, adults, childrenCount, notes }) =>
        openModal(
          'enquiry',
          // Chip derived from the same `stops` that get submitted, via the
          // shared helper — so what the visitor reads and what GTY receives
          // cannot describe two different trips.
          { label: 'Custom trip', value: stops.length ? tripRouteSummary(stops) : EMPTY_TRIP_LABEL },
          { formType: 'custom-trip', stops, travelStyle, travelMonth, adults, childrenCount, notes }
        ),
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
