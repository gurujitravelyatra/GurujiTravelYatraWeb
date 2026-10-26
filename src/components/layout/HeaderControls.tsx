'use client';

import { useModal } from '@/components/modals/modal-context';
import { trackEvent } from '@/lib/analytics';
import { useMobileMenu } from './mobile-menu-context';

export interface HeaderControlsProps {
  pageLabel: string;
  /** Resolved by `SiteShell` from `GET /public/site` (with a static fallback) — see `resolveSiteContact`. */
  phoneTel: string;
}

/**
 * Right-hand cluster of the header pill bar — export lines 131-142. Call
 * button + divider are ≥760px only; the burger is <1180px only.
 */
export function HeaderControls({ pageLabel, phoneTel }: HeaderControlsProps) {
  const { openEnquiry } = useModal();
  const { open, toggle } = useMobileMenu();

  return (
    <div className="relative z-[2] ml-auto flex flex-none items-center gap-[14px]">
      <a
        href={`tel:${phoneTel}`}
        onClick={() => trackEvent('call_click', { location: 'header' })}
        aria-label="Call Guruji Travel Yatra"
        className="relative hidden h-10 w-10 flex-none items-center justify-center rounded-pill bg-gty-primary text-gty-white shadow-gty-red-lg transition-colors duration-gty-fast ease-gty hover:bg-gty-primary-deep 760:flex"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M6.6 10.8c1.1 2.2 2.9 4 5.1 5.1l1.7-1.7c.2-.2.5-.3.8-.2 1 .3 2 .5 3.1.5.4 0 .8.3.8.8V18c0 .4-.3.8-.8.8C9.6 18.8 5.2 14.4 5.2 7.5c0-.4.3-.8.8-.8h2.7c.4 0 .8.3.8.8 0 1.1.2 2.1.5 3.1.1.3 0 .6-.2.8z" />
        </svg>
      </a>
      <span aria-hidden="true" className="hidden h-[26px] w-px flex-none bg-gty-border-2 760:block" />
      <button
        type="button"
        onClick={() => openEnquiry({ label: 'Page', value: pageLabel })}
        className="flex flex-none items-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-6 py-[14px] text-13 font-bold tracking-btn text-gty-white shadow-gty-red-lg transition-[background-color,box-shadow,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
      >
        <span className="hidden 760:inline">Enquire Now</span>
        <span className="760:hidden">Enquire</span>
        <span aria-hidden="true">→</span>
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="hidden h-[38px] w-[38px] flex-none items-center justify-center rounded-pill border border-gty-border-3 text-gty-primary transition-colors duration-gty-fast ease-gty hover:border-gty-primary max-1180:flex"
      >
        ☰
      </button>
    </div>
  );
}
