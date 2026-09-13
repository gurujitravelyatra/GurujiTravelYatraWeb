'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { useModal, type ModalVariant } from './modal-context';

/**
 * Shown only while a modal's JS chunk is in flight — i.e. the few hundred
 * milliseconds between the first "Enquire Now" click and the real modal
 * mounting. Deliberately built from plain Tailwind tokens and NOT from
 * `LeadModal`'s `SendingStep`: that component lives inside the very chunk
 * being fetched (and pulls framer-motion), so reusing it would defeat the
 * split. The dashed track mirrors `SendingStep` so the placeholder reads as
 * the same modal it is about to become.
 *
 * No backdrop and `pointer-events-none` on purpose: if the chunk request ever
 * fails (offline, cache miss on a flaky connection) this must not leave the
 * page behind an un-dismissable overlay. It also carries no `role="dialog"`,
 * so anything waiting on the real dialog — including the Playwright specs —
 * keeps waiting for the real one rather than matching the placeholder.
 */
function ModalChunkFallback() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center px-gx py-8">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div
        aria-hidden="true"
        className="flex w-[440px] max-w-full flex-col items-center gap-3 rounded-22 bg-gty-white px-gx py-11 shadow-gty-modal"
      >
        <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Loading…</p>
        <div className="h-2 w-[200px] rounded-16 border-[1.5px] border-dashed border-gty-border-8 bg-gty-surface-3" />
      </div>
    </div>
  );
}

/*
 * `ssr: false` is correct here and is only legal from a Client Component
 * (`next/dynamic` errors on it in a Server Component, which `app/layout.tsx`
 * is — hence this file). Both modals are pure client-side overlays opened by
 * a user gesture: they render nothing until `openEnquiry()`/`openBrochure()`
 * fires, so there is no markup worth server-rendering and no SEO content to
 * lose.
 */
const EnquiryModal = dynamic(() => import('./EnquiryModal').then((mod) => mod.EnquiryModal), {
  ssr: false,
  loading: ModalChunkFallback,
});

const BrochureModal = dynamic(() => import('./BrochureModal').then((mod) => mod.BrochureModal), {
  ssr: false,
  loading: ModalChunkFallback,
});

/**
 * Mounts the lead modals lazily.
 *
 * Previously `app/layout.tsx` static-imported `<EnquiryModal />` and
 * `<BrochureModal />`, which dragged their whole dependency chain
 * (`LeadModal` → react-hook-form + zod + @hookform/resolvers,
 * `ModalShell` → framer-motion + @radix-ui/react-dialog) into the JS every
 * route shipped on first load — even on pages where no visitor ever opens a
 * modal. Here each modal is fetched on first open instead.
 *
 * Nothing about how modals are opened changes: `ModalProvider` and
 * `useModal()` stay eagerly loaded and are untouched, so every existing
 * trigger (Navbar, mobile action bar, hero CTAs, tour/departure cards, trip
 * builder, about CTA) keeps working with no call-site changes.
 *
 * Once a variant has been opened it stays mounted, rendering closed. That is
 * load-bearing, not laziness: `ModalShell` drives its close animation with
 * `AnimatePresence` + `forceMount`, which only runs the exit transition when
 * `open` flips true → false on a *mounted* subtree. Unmounting on close would
 * make the modal vanish instantly instead of fading out. A mounted-but-closed
 * modal renders `null`.
 */
export function ModalHost() {
  const { modal } = useModal();
  const [openedVariants, setOpenedVariants] = React.useState<readonly ModalVariant[]>([]);

  const activeVariant = modal?.variant;

  // Adjusted during render, not in an effect: this is React's documented way
  // to derive state from a changed input ("You Might Not Need an Effect").
  // React re-runs this component immediately, before the browser paints, so
  // the modal mounts in the same commit as the click that opened it. The
  // guard is what makes it terminate — after the first open of a variant the
  // condition is false forever.
  if (activeVariant && !openedVariants.includes(activeVariant)) {
    setOpenedVariants([...openedVariants, activeVariant]);
  }

  return (
    <>
      {openedVariants.includes('enquiry') && <EnquiryModal />}
      {openedVariants.includes('brochure') && <BrochureModal />}
    </>
  );
}
