import Link from 'next/link';

import { cn } from '@/lib/utils';

// Every route in this list now resolves. These two used to be deliberate dead
// links backed by the branded 404 (BLOCKERS.md Decision G) — which is exactly
// the bug a visitor reported, since a 404 behind a PRIMARY NAV item reads as
// broken, not as "coming soon". Decision G2 reversed it and the pages were
// built. The hrefs never changed, so the churn Decision G was trying to avoid
// never happened.
const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Tour Packages', href: '/tour-packages' },
  { label: 'Group Tours', href: '/group-tours' },
  { label: 'Customized Tours', href: '/customize-tours' },
] as const;

export interface NavLinksProps {
  activePath: string;
}

/** "Redux" redesign (brief §2) — `lg:flex` desktop link row, `.link-grow` underline on hover/active. */
export function NavLinks({ activePath }: NavLinksProps) {
  return (
    <div className="hidden items-center gap-8 lg:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === activePath;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'link-grow text-[15px] font-semibold text-stone-700 transition-colors hover:text-redux-crimson',
              isActive && 'is-active text-redux-crimson'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
