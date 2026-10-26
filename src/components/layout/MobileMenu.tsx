'use client';

import Link from 'next/link';

import { useModal } from '@/components/modals/modal-context';
import { trackEvent } from '@/lib/analytics';
import { useMobileMenu } from './mobile-menu-context';

const MENU_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Tour Packages', href: '/tour-packages' },
  { label: 'Group Tours', href: '/group-tours' },
  { label: 'Customized Tours', href: '/customize-tours' },
  { label: 'About Us', href: '/about-us' },
] as const;

export interface MobileMenuProps {
  pageLabel: string;
  /** Resolved by `SiteShell` from `GET /public/site` (with a static fallback) — see `resolveSiteContact`. */
  phoneTel: string;
}

/** Slide-down panel below the header bar — export lines 145-155, tech spec §4.3. Rendered as a sibling of `.hdrwrap`, below it. */
export function MobileMenu({ pageLabel, phoneTel }: MobileMenuProps) {
  const { open, close } = useMobileMenu();
  const { openEnquiry } = useModal();

  if (!open) {
    return null;
  }

  return (
    <div id="mobile-menu-panel" className="relative z-[29] flex flex-col border-b border-gty-border-6 bg-gty-white">
      {MENU_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={close}
          className="flex items-center justify-between border-b border-gty-border-5 px-4 py-[14px] text-13 font-bold text-gty-ink-soft"
        >
          {item.label}
          <span aria-hidden="true" className="text-gty-primary">
            →
          </span>
        </Link>
      ))}
      <div className="flex gap-[10px] bg-gty-surface-3 p-4">
        <a
          href={`tel:${phoneTel}`}
          onClick={() => {
            trackEvent('call_click', { location: 'mobile-menu' });
            close();
          }}
          className="flex flex-1 items-center justify-center gap-[9px] rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-11-5 font-bold text-gty-white"
        >
          <span aria-hidden="true">✆</span> Call GTY
        </a>
        <button
          type="button"
          onClick={() => {
            openEnquiry({ label: 'Page', value: pageLabel });
            close();
          }}
          className="flex flex-1 items-center justify-center rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-11-5 font-bold text-gty-white"
        >
          Enquire Now
        </button>
      </div>
    </div>
  );
}
