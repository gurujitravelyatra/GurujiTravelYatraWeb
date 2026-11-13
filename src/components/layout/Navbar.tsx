'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
 * "Redux" redesign (brief §2, 2026-11-14) — replaces the old `.hdrwrap`/
 * `.hdrbar` sticky pill bar with the reference's floating, blurred pill
 * header. Now a Client Component (was a server shell) because the
 * scroll-based shadow and the `motion.header` entrance both need the
 * browser; `NavLinks` stays a plain server component underneath (no hooks
 * of its own), `HeaderControls`/`MobileMenu` were already client.
 *
 * `position: fixed` (not `sticky`) means this no longer takes up document
 * flow space — intentional, so the home page's dark hero can run full-bleed
 * behind it (see `Hero.tsx`'s own top padding). Every OTHER page used to get
 * that space back for free from the old `sticky` bar; `SiteShell` now adds
 * compensating top padding to `<main>` on every route except `/` so this
 * change doesn't hide page content under the floating header there.
 */
export function Navbar({ activePath, pageLabel, contact }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <MobileMenuProvider>
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-10"
      >
        <nav
          data-testid="site-navbar"
          className={`mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 rounded-full border bg-white/90 pl-4 pr-3 backdrop-blur-xl transition-shadow duration-300 sm:pl-5 sm:pr-4 ${
            scrolled
              ? 'border-stone-200 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.4)]'
              : 'border-stone-200/70 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.3)]'
          }`}
        >
          <Logo />
          <NavLinks activePath={activePath} />
          <HeaderControls pageLabel={pageLabel} phoneTel={contact.phoneTel} />
        </nav>
      </motion.header>
      <MobileMenu pageLabel={pageLabel} phoneTel={contact.phoneTel} />
    </MobileMenuProvider>
  );
}

function Logo() {
  return (
    <Link href="/" className="relative z-[2] flex flex-none items-center gap-[11px]">
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden">
        <Image
          src="/logo/gty-icon-red.webp"
          alt="Guruji Travel Yatra"
          width={44}
          height={44}
          className="h-10 w-10 object-contain"
          priority
        />
      </span>
      <span className="hidden flex-col leading-none 760:flex">
        <span className="whitespace-nowrap text-[15px] font-extrabold tracking-[0.06em] text-stone-900">
          GURUJI TRAVEL YATRA
        </span>
        <span className="mt-1.5 whitespace-nowrap text-[9px] font-bold tracking-[0.22em] text-redux-crimson">
          KEEP GUESSING, WHERE&#39;S NEXT TRIP?
        </span>
      </span>
    </Link>
  );
}
