import Image from 'next/image';
import Link from 'next/link';

import type { SiteContact } from '@/lib/site-contact';
import { NavLinks } from './NavLinks';
import { HeaderControls } from './HeaderControls';
import { MobileMenu } from './MobileMenu';
import { MobileMenuProvider } from './mobile-menu-context';

export interface NavbarProps {
  /** e.g. "/" | "/tour-packages" — drives `NavLinks` active state. */
  activePath: string;
  /** e.g. "Home" | "Tour Packages" — the Enquire CTA's context-chip value when opened from the header (BLOCKERS.md Decision F: real page label, never a fabricated fallback). */
  pageLabel: string;
  /** Resolved once by `SiteShell` from `GET /public/site`, threaded down so every contact consumer agrees. */
  contact: SiteContact;
}

/**
 * `.hdrwrap`/`.hdrbar` — export lines 115-155, tech spec §4.3.
 *
 * Server shell: renders the static chrome (backdrop, pill bar, logo, decor)
 * and delegates every interactive bit to client children (`NavLinks` is
 * server too — active state comes from the `activePath` prop, no
 * `usePathname()` needed; `HeaderControls`/`MobileMenu` are client).
 * `MobileMenuProvider` lets the burger (inside the pill bar) and the panel
 * (a sibling below it) share open/close state without lifting it further.
 */
export function Navbar({ activePath, pageLabel, contact }: NavbarProps) {
  return (
    <MobileMenuProvider>
      <div
        data-testid="site-navbar"
        className="sticky top-0 z-30 px-gx pb-[10px] pt-4 max-760:pb-2 max-760:pt-[10px]"
        style={{
          background:
            'linear-gradient(180deg, var(--color-gty-surface) 0%, var(--color-gty-surface) 62%, transparent 100%)',
        }}
      >
        <div className="relative flex flex-nowrap items-center gap-4 overflow-hidden rounded-44 bg-gty-white py-[14px] pl-[22px] pr-4 shadow-gty-header max-760:rounded-30 max-760:py-[10px] max-760:pl-[14px] max-760:pr-3">
          <DecorativeHeaderArt />
          <Logo />
          <NavLinks activePath={activePath} />
          <HeaderControls pageLabel={pageLabel} phoneTel={contact.phoneTel} />
        </div>
      </div>
      <MobileMenu pageLabel={pageLabel} phoneTel={contact.phoneTel} />
    </MobileMenuProvider>
  );
}

function Logo() {
  return (
    <Link href="/" className="relative z-[2] flex flex-none items-center gap-[11px]">
      <span className="block h-[56px] w-[74px] flex-none overflow-hidden">
        <Image
          src="/logo/gty-logo.png"
          alt="Guruji Travel Yatra"
          width={74}
          height={74}
          className="h-[74px] w-[74px] object-cover object-top"
          priority
        />
      </span>
      <span className="hidden flex-col items-start gap-[5px] 760:flex">
        <span className="whitespace-nowrap text-20 font-extrabold leading-none tracking-nudge text-gty-ink">
          GURUJI TRAVEL YATRA
        </span>
        <span className="whitespace-nowrap text-9 uppercase tracking-widest-gty text-gty-subtle">
          Keep Guessing, Where&#39;s Next Trip?
        </span>
      </span>
    </Link>
  );
}

/** Decorative art only (export lines 117-118) — copied verbatim, hidden <760px per `.hdrart{display:none}`. */
function DecorativeHeaderArt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 max-760:hidden">
      <svg viewBox="0 0 520 90" preserveAspectRatio="none" className="absolute left-[26%] right-[14%] top-0 h-full w-full opacity-50">
        <circle cx="46" cy="34" r="17" fill="#f9c9c4" opacity="0.5" />
        <path d="M0 90 L58 42 L96 90 Z" fill="#cfd3d6" opacity="0.55" />
        <path d="M52 90 L118 30 L184 90 Z" fill="#b9bfc4" opacity="0.6" />
        <path d="M104 30 L118 40 L132 30 L118 22 Z" fill="#ffffff" />
        <path d="M150 90 L206 46 L258 90 Z" fill="#d6dade" opacity="0.5" />
        <path d="M118 22 L104 32 L112 34 L118 29 L124 34 L132 32 Z" fill="#fff" />
        <path d="M168 18 q6 -5 12 0 q-6 -2 -12 0" fill="#9aa1a6" opacity="0.6" />
        <path d="M196 12 q6 -5 12 0 q-6 -2 -12 0" fill="#9aa1a6" opacity="0.6" />
        <path d="M214 24 q5 -4 10 0 q-5 -2 -10 0" fill="#9aa1a6" opacity="0.6" />
      </svg>
      <svg viewBox="0 0 200 90" className="absolute right-[19%] top-0 h-[90px] w-[200px]">
        <path d="M150 22 L166 34 L188 26 L172 40 L186 56 L164 50 L150 62 L152 42 Z" fill="#f6a9a1" opacity="0.85" />
        <path
          d="M8 78 C34 82 52 74 66 62 C82 48 100 44 122 46 C136 47 146 44 152 40"
          fill="none"
          stroke="#f6bdb6"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
      </svg>
    </div>
  );
}
