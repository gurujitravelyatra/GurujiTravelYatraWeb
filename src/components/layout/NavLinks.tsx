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

/** `.hdrnav` — desktop nav row, visible only ≥1180px (tech spec §4.2/§4.3). */
export function NavLinks({ activePath }: NavLinksProps) {
  return (
    <div className="hidden min-w-0 flex-1 justify-center gap-[30px] 1180:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === activePath;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-[2.5px] border-transparent pb-[9px] pt-[5px] text-14-5 font-medium text-gty-ink-soft transition-colors duration-gty-fast ease-gty hover:text-gty-primary',
              isActive && 'border-gty-primary font-semibold text-gty-primary'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
