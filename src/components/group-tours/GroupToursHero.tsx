import Link from 'next/link';

import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * Export `.dc.html` lines 482-494 (`isGroup` screen, `.gphero` block).
 *
 * Ported close to 1:1 with `TourPackagesHero` (same gradient band, same
 * masked photo treatment, same breadcrumb pattern) — the export reuses that
 * layout language for every catalogue-style hero. Differences from
 * `TourPackagesHero` are the export's own: a single rotated script accent
 * ("Good People / Great Places / Bigger Memories") instead of two, a second
 * red Caveat line ("Travel Together") sitting inside the content column
 * rather than absolutely positioned, and the four white trust-pill chips
 * (lines 491) which `TourPackagesHero` does not have.
 *
 * The trust-pill SVG icons are copied verbatim from the export — decorative
 * line art, not photography, so `aria-hidden="true"` on each.
 *
 * `text-40` and the mask/positioning percentages below have no matching
 * token in `globals.css` (only this one screen uses 40px Caveat text), so
 * they are arbitrary Tailwind values rather than an invented token — see
 * globals.css's own rule against approximating to a Tailwind default; an
 * arbitrary exact-value class is not an approximation.
 *
 * `<h1>`/supporting copy pick up the same mobile-first ramp `TourPackagesHero`
 * uses (36px -> 52px, 14px -> 15.5px at the `760:` breakpoint) rather than the
 * export's fixed desktop-only 52px/15.5px — the export has no mobile variant
 * for this screen at all, and matching the sibling hero's responsive
 * behavior keeps the page usable at phone width per the responsiveness
 * requirement.
 */
export function GroupToursHero() {
  return (
    <div
      className="relative overflow-hidden px-gx pb-16 pt-[26px]"
      style={{ background: 'linear-gradient(180deg,#faf8f7 0%,#f7f4f2 100%)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] opacity-[.62] 1080:block"
        style={{
          WebkitMaskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 22%,#000 58%)',
          maskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 22%,#000 58%)',
        }}
      >
        <PhotoPlaceholder photoKey="Himalaya" alt="" className="h-full w-full items-start justify-end p-4 text-right" />
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none absolute right-[16%] top-[20px] hidden -rotate-6 font-script text-29 leading-[1.2] text-gty-ink-soft 1080:block"
      >
        Good People
        <br />
        <span className="pl-[10px]">Great Places</span>
        <br />
        <span className="pl-5">Bigger Memories</span>
        <span className="ml-[22px] mt-[3px] block h-[2px] w-[130px] rounded-[2px] bg-gty-primary" />
      </p>

      <div className="relative z-[2] flex max-w-[640px] flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-[6px] text-13 text-gty-subtle">
          <Link href="/" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-gty-ink-soft">
            Group Tours
          </span>
        </nav>

        <p className="-rotate-2 font-script text-[40px] leading-none text-gty-primary">Travel Together</p>

        <h1 className="mt-[-4px] text-36 font-extrabold leading-[1.02] tracking-tighter text-gty-ink 760:text-52">
          Group Tours
        </h1>

        <p className="max-w-[520px] text-14 leading-[1.6] text-gty-body 760:text-15-5">
          Fixed departures, great company and unforgettable journeys.
          <br className="hidden 760:block" />
          Join a group of like-minded travellers and explore more, together.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <TrustPill label="Fixed Departures">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M7 2h2v2h6V2h2v2h2a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1h2V2zM3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zm3 3v2h2v-2H6zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H6zm4 0v2h2v-2h-2z" />
            </svg>
          </TrustPill>
          <TrustPill label="Trusted Tour Manager">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="7.5" r="3" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M3 20c0-3.6 2.6-5.8 6-5.8s6 2.2 6 5.8H3zM16 20c0-2.4-.7-4.1-1.9-5.2 3.4-.6 6.9 1.1 6.9 5.2h-5z" />
            </svg>
          </TrustPill>
          <TrustPill label="Pure Veg Meals">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M8 3v7a3 3 0 0 0 2 2.8V21h2V12.8A3 3 0 0 0 14 10V3h-1.4v6h-1.2V3H10v6H8.8V3H8zm8 0c-1.4 1.3-2 3.4-2 5.6 0 1.9.7 3.2 2 3.7V21h1.6V3H16z" />
            </svg>
          </TrustPill>
          <TrustPill label="Safe & Comfortable">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M12 3l8 2.6v6c0 5-3.4 8.5-8 9.9-4.6-1.4-8-4.9-8-9.9v-6L12 3zm-1 11.7l5-5-1.4-1.4L11 11.9 9.4 10.3 8 11.7l3 3z" />
            </svg>
          </TrustPill>
        </div>
      </div>
    </div>
  );
}

function TrustPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[9px] rounded-pill border border-gty-border-7 bg-gty-white py-[9px] pl-2.5 pr-4 shadow-gty-sm">
      <span aria-hidden="true" className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-pill bg-gty-red-150 text-gty-primary">
        {children}
      </span>
      <span className="whitespace-nowrap text-12-5 font-semibold text-gty-ink-soft">{label}</span>
    </span>
  );
}
