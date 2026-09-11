import Link from 'next/link';

import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * Export lines 563-578 (`isCustom` screen), product-spec §5.5.
 *
 * Server Component — nothing here is interactive. Mirrors `TourPackagesHero`'s
 * structure exactly (same gradient, same right-side photo mask, same
 * mobile-scaled heading/subtext convention, decorative Caveat accents hidden
 * below 1080px) since both are the same hero pattern applied to a different
 * page. SVGs are copied verbatim from the export, `aria-hidden="true"`.
 */
export function CustomizeToursHero() {
  return (
    <div
      className="relative overflow-hidden px-gx pb-[30px] pt-[26px]"
      style={{ background: 'linear-gradient(180deg,#faf8f7 0%,#f5f2f1 100%)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[54%] opacity-60 1080:block"
        style={{
          WebkitMaskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 24%,#000 60%)',
          maskImage: 'linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.5) 24%,#000 60%)',
        }}
      >
        <PhotoPlaceholder photoKey="Himalaya" alt="" className="h-full w-full items-start justify-end p-4 text-right" />
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none absolute left-[37%] top-[22px] hidden -rotate-[7deg] font-script text-29 leading-[1.14] text-gty-ink-soft 1080:block"
      >
        Dream
        <br />
        <span className="pl-[10px]">Plan</span>
        <br />
        <span className="pl-5">Travel</span>
        <br />
        <span className="pl-[30px]">Your Way</span>
        <span className="ml-8 mt-[2px] block h-[2px] w-[118px] rounded-[2px] bg-gty-primary" />
      </p>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute right-[calc(var(--gx)-4px)] top-[26px] hidden rotate-3 text-left font-script text-26 leading-[1.18] text-gty-white 1080:block"
        style={{ textShadow: '0 2px 10px rgba(0,0,0,.4)' }}
      >
        Same
        <br />
        Places
        <br />
        New
        <br />
        Stories
        <span className="mt-[2px] block h-[2px] w-[86px] rounded-[2px] bg-gty-primary" />
      </p>

      <div className="relative z-[2] flex max-w-[660px] flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-[6px] text-13-5 text-gty-subtle">
          <Link href="/" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-gty-ink-soft">
            Customized Tours
          </span>
        </nav>
        <h1 className="text-36 font-extrabold tracking-tighter text-gty-ink 760:text-52">
          Build Your <span className="text-gty-primary">Own Yatra</span>
        </h1>
        <p className="max-w-[520px] text-14 leading-[1.6] text-gty-body 760:text-15-5">
          Tell us what you love. We&rsquo;ll create a personalized journey, just for you.
        </p>

        <div className="flex flex-wrap gap-[14px] pt-[6px]">
          <HeroFeature label="Your Places">
            <path d="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
          </HeroFeature>
          <HeroFeature label="Your Pace">
            <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 5h-2v6l4.7 2.8 1-1.7-3.7-2.2z" />
          </HeroFeature>
          <HeroFeature label="Your People">
            <>
              <circle cx="9" cy="7.5" r="3" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M3 20c0-3.6 2.6-5.8 6-5.8s6 2.2 6 5.8H3zM16 20c0-2.4-.7-4.1-1.9-5.2 3.4-.6 6.9 1.1 6.9 5.2h-5z" />
            </>
          </HeroFeature>
          <HeroFeature label="Our Expertise">
            <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
          </HeroFeature>
        </div>
      </div>
    </div>
  );
}

function HeroFeature({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[10px]">
      <span
        aria-hidden="true"
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-pill bg-gty-red-150 text-gty-primary"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" className="flex-none">
          {children}
        </svg>
      </span>
      <span className="text-13-5 font-semibold text-gty-ink-soft">{label}</span>
    </span>
  );
}
