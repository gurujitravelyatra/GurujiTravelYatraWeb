'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

import { useModal } from '@/components/modals/modal-context';
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

/**
 * "Redux" redesign (brief §2) — floating panel below the pill header,
 * `AnimatePresence` fade+scale per the reference. The reference's panel
 * carries a single "Enquire Now" CTA, not a split Call+Enquire row like the
 * old panel had — dropping Call here is not a functionality loss, since
 * `MobileActionBar`'s persistent sticky bar already gives every mobile page
 * view an always-reachable Call button regardless of this menu's state.
 * `phoneTel` is kept on the props contract (unused here) only because
 * `Navbar` still threads it through uniformly to every header child.
 */
export function MobileMenu({ pageLabel }: MobileMenuProps) {
  const { open, close } = useMobileMenu();
  const { openEnquiry } = useModal();

  return (
    <div className="fixed inset-x-0 top-[76px] z-40 px-3 sm:top-[88px] sm:px-10">
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu-panel"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mx-auto mt-2 max-w-[1320px] rounded-3xl border border-stone-200 bg-white/95 p-4 shadow-xl backdrop-blur-xl lg:hidden"
          >
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="block rounded-2xl px-4 py-3 text-[15px] font-semibold text-stone-800 transition-colors hover:bg-redux-crimson-tint hover:text-redux-crimson"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                openEnquiry({ label: 'Page', value: pageLabel });
                close();
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-redux-crimson px-5 py-3 text-[15px] font-bold text-white"
            >
              Enquire Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
