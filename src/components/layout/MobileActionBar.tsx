'use client';

import { useModal } from '@/components/modals/modal-context';
import { trackEvent } from '@/lib/analytics';

const GTY_PHONE_TEL = '+919099957658';
const GTY_WHATSAPP_URL = 'https://wa.me/919099957658';

export interface MobileActionBarProps {
  pageLabel: string;
}

/**
 * Export lines 864-870, tech spec §4.2/§4.3. The export gates this with a JS
 * `isMobile` device flag; per tech spec §4.2 that pattern is replaced with a
 * plain CSS breakpoint (`760:hidden`) to avoid SSR/hydration mismatches —
 * visible only below 760px, sticky to the viewport bottom.
 */
export function MobileActionBar({ pageLabel }: MobileActionBarProps) {
  const { openEnquiry } = useModal();

  return (
    <div className="sticky bottom-0 z-40 flex border-t border-gty-border-6 bg-gty-white 760:hidden">
      <a
        href={`tel:${GTY_PHONE_TEL}`}
        onClick={() => trackEvent('call_click', { location: 'mobile-action-bar' })}
        className="flex flex-1 items-center justify-center gap-[9px] py-[15px] text-11-5 font-bold text-gty-ink"
      >
        <span aria-hidden="true">✆</span> Call
      </a>
      <a
        href={GTY_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('whatsapp_click', { location: 'mobile-action-bar' })}
        className="flex flex-1 items-center justify-center border-l border-gty-border-6 py-[15px] text-11-5 font-bold text-gty-ink"
      >
        WhatsApp
      </a>
      <button
        type="button"
        onClick={() => openEnquiry({ label: 'Page', value: pageLabel })}
        className="flex flex-[1.2] items-center justify-center bg-gty-primary py-[15px] text-11-5 font-bold text-gty-white"
      >
        Enquire
      </button>
    </div>
  );
}
