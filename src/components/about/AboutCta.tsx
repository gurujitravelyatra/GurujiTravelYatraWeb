'use client';

import { useModal } from '@/components/modals/modal-context';
import { Button } from '@/components/ui/button';

/**
 * Closing CTA band — design export line 736, product-spec §5.8.
 *
 * "Start Your Journey →" opens the enquiry modal with
 * `{ label: 'Page', value: 'About Us' }` context. Per BLOCKERS.md Decision F
 * there is no fallback context value anywhere in this app, so the real page
 * label is passed explicitly here rather than left for the modal to guess
 * (the export's own `PACKS[0]` fallback is the bug that decision avoids).
 * `'use client'` only for `useModal()` — the rest of the band is static.
 */
export function AboutCta() {
  const { openEnquiry } = useModal();

  return (
    <section
      data-testid="section-about-cta"
      className="flex flex-wrap items-center gap-4 border-t border-gty-border-6 bg-gty-surface-3 px-gx py-8"
    >
      <h2 className="min-w-[220px] flex-1 text-18 font-extrabold text-gty-ink">Where will your journey take you?</h2>
      <Button type="button" variant="primary" onClick={() => openEnquiry({ label: 'Page', value: 'About Us' })}>
        Start Your Journey <span aria-hidden="true">→</span>
      </Button>
    </section>
  );
}
