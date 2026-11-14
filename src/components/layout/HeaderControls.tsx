'use client';

import { ArrowRight, Menu, Phone, X } from 'lucide-react';

import { useModal } from '@/components/modals/modal-context';
import { trackEvent } from '@/lib/analytics';
import { useMobileMenu } from './mobile-menu-context';

export interface HeaderControlsProps {
  pageLabel: string;
  /** Resolved by `SiteShell` from `GET /public/site` (with a static fallback) — see `resolveSiteContact`. */
  phoneTel: string;
}

/** "Redux" redesign (brief §2) — right-hand cluster of the floating pill header. */
export function HeaderControls({ pageLabel, phoneTel }: HeaderControlsProps) {
  const { openEnquiry } = useModal();
  const { open, toggle } = useMobileMenu();

  return (
    <div className="flex items-center gap-2.5">
      {/*
        Brief §13 ("ACCEPTANCE") requires every tap target >= 44px. The
        brief's own literal §2 spec ("p-2.5" around a 16px icon) computes to
        ~36px — `h-11 w-11` (44px) + `grid place-items-center` guarantees the
        floor regardless of the icon's own size, overriding that one literal
        value in favour of the brief's own stated acceptance bar.
      */}
      <a
        href={`tel:${phoneTel}`}
        onClick={() => trackEvent('call_click', { location: 'header' })}
        aria-label="Call Guruji Travel Yatra"
        className="hidden h-11 w-11 place-items-center rounded-full bg-redux-crimson text-white shadow-[0_10px_22px_-8px_rgba(220,38,38,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark sm:grid"
      >
        <Phone size={16} />
      </a>
      <button
        type="button"
        onClick={() => openEnquiry({ label: 'Page', value: pageLabel })}
        className="btn-shine hidden min-h-11 items-center gap-2 rounded-full bg-redux-crimson px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(220,38,38,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark sm:inline-flex"
      >
        Enquire
        <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 text-stone-800 transition-colors hover:border-redux-crimson/40 hover:text-redux-crimson lg:hidden"
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
    </div>
  );
}
