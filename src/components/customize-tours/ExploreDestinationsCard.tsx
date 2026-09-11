import Link from 'next/link';

/**
 * Export lines 701-708. Server Component — a plain internal `<Link>`, no
 * client state needed.
 */
export function ExploreDestinationsCard() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-18 bg-gty-surface-4 p-[22px]">
      <span
        aria-hidden="true"
        className="flex h-[78px] w-[78px] flex-none items-center justify-center rounded-pill bg-gty-white text-gty-gold-deep shadow-gty-soft"
      >
        <svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor" className="flex-none">
          <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
        </svg>
      </span>
      <div className="flex min-w-[190px] flex-1 flex-col gap-[7px]">
        <p className="text-19 leading-[1.2] text-gty-ink">Not sure where to go?</p>
        <p className="text-13 leading-[1.55] text-gty-muted">
          Explore our popular destinations and get inspired to plan your own journey.
        </p>
        <Link
          href="/tour-packages"
          className="mt-2 inline-flex items-center gap-[10px] self-start rounded-pill border-[1.5px] border-gty-primary bg-gty-white px-5 py-[11px] text-13-5 font-bold text-gty-primary transition-colors duration-gty-fast ease-gty hover:bg-gty-primary hover:text-gty-white"
        >
          Explore Destinations <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
