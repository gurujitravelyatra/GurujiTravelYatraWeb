import Link from 'next/link';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Tour Packages', href: '/tour-packages' },
  // Decision G: these two routes don't exist yet this sprint — they still
  // render as real <Link>s (branded 404 handles the landing) rather than
  // being hidden, per pixel-accuracy and to avoid churn when Sprints 3-6
  // add the real routes.
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
