import type { ReactNode } from 'react';

export interface WhyGtyBandProps {
  /** `site.settings.yearsExperienceLabel` from `GET /public/site` — rendered verbatim, `null` until the Owner sets it. */
  yearsExperienceLabel: string | null;
}

/**
 * Export lines 259-313, tech spec §4.4 (unnumbered row, "Why Travel With
 * GTY?" band). This is where product-spec §5.1 step 4's "Trust strip"
 * content actually renders (tech spec row 4: the export places this content
 * here, not near the top, and the export is layout's source of truth).
 *
 * Design review 2026-11-04: icon treatment redrawn to match
 * `Documents/Why Travel With GTY SECTION Above.png` — illustrated, multi-tone
 * SVGs on a plain pale-peach circle (no gold ring) instead of the previous
 * single-tone (`currentColor`) line icons inside a conic-gradient ring. Each
 * icon keeps the SAME underlying shape as before (temple+flag, 3
 * people+star, headset+"24/7", thali+steam, shield+tick already matched the
 * reference's subjects) — only the fill treatment changed, per the brief's
 * own "use the repo's existing assets if any match" instruction.
 */
const WHY_ICONS: readonly ReactNode[] = [
  // Curated Yatras — temple with a saffron flag.
  <svg key="curated-yatras" viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path d="M32 4 L39 7 L32 10 Z" fill="var(--color-gty-primary)" />
    <rect x="31" y="4" width="1.6" height="12" fill="var(--color-gty-navy)" />
    <path d="M32 15 C25 15 22 22 22 27 L42 27 C42 22 39 15 32 15 Z" fill="var(--color-gty-gold-deep)" />
    <rect x="20" y="27" width="24" height="3" fill="var(--color-gty-gold-deep)" />
    <rect x="23" y="31" width="3.4" height="16" fill="var(--color-gty-navy)" />
    <rect x="30.3" y="31" width="3.4" height="16" fill="var(--color-gty-navy)" />
    <rect x="37.6" y="31" width="3.4" height="16" fill="var(--color-gty-navy)" />
    <rect x="17" y="47" width="30" height="3.6" fill="var(--color-gty-navy)" opacity="0.85" />
    <rect x="13" y="51.5" width="38" height="3.6" fill="var(--color-gty-navy)" opacity="0.65" />
    <rect x="9" y="56" width="46" height="4" fill="var(--color-gty-navy)" opacity="0.45" />
  </svg>,
  // Trusted Since 8+ Years — three travellers with a gold star above.
  <svg key="trusted-since" viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
      d="M32 4 L35.2 12.4 L44 12.9 L37.1 18.4 L39.4 27 L32 22.1 L24.6 27 L26.9 18.4 L20 12.9 L28.8 12.4 Z"
      fill="var(--color-gty-gold)"
      stroke="var(--color-gty-gold-deep)"
      strokeWidth="0.8"
    />
    <circle cx="32" cy="34" r="7" fill="var(--color-gty-primary)" />
    <circle cx="17" cy="38" r="5.6" fill="var(--color-gty-gold-deep)" />
    <circle cx="47" cy="38" r="5.6" fill="var(--color-gty-gold-deep)" />
    <path d="M18 58 C18 47 24 43 32 43 C40 43 46 47 46 58 Z" fill="var(--color-gty-primary)" />
    <path d="M3 58 C3 49 8.5 45 16 44.6 L16 58 Z" fill="var(--color-gty-gold-deep)" />
    <path d="M61 58 C61 49 55.5 45 48 44.6 L48 58 Z" fill="var(--color-gty-gold-deep)" />
  </svg>,
  // 24/7 Travel Support — headset.
  <svg key="travel-support" viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
      d="M32 8 C18.7 8 8 18.7 8 32 L8 37 L14 37 L14 32 C14 22 22 14 32 14 C42 14 50 22 50 32 L50 37 L56 37 L56 32 C56 18.7 45.3 8 32 8 Z"
      fill="var(--color-gty-primary)"
    />
    <path d="M5 34 L15 34 C16.1 34 17 34.9 17 36 L17 48 C17 49.1 16.1 50 15 50 L5 50 C3.9 50 3 49.1 3 48 L3 36 C3 34.9 3.9 34 5 34 Z" fill="var(--color-gty-navy)" />
    <path d="M49 34 L59 34 C60.1 34 61 34.9 61 36 L61 48 C61 49.1 60.1 50 59 50 L49 50 C47.9 50 47 49.1 47 48 L47 36 C47 34.9 47.9 34 49 34 Z" fill="var(--color-gty-navy)" />
    <path d="M52 50 L55 50 L55 54 C55 56.8 52.8 59 50 59 L34 59 L34 56 L50 56 C51.1 56 52 55.1 52 54 Z" fill="var(--color-gty-navy)" />
    <text x="32" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
      24/7
    </text>
  </svg>,
  // Pure Veg Meals — thali plate with steam.
  <svg key="pure-veg" viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path d="M24.5 6.5 C21.5 9 26 12 23.5 15 L22 13.7 C24 11.4 19.8 8.6 23.2 5.4 Z" fill="var(--color-gty-primary)" opacity="0.75" />
    <path d="M32.5 4 C29.5 7 34 10.5 31.5 14 L30 12.6 C32 10 27.8 6.7 31.2 3 Z" fill="var(--color-gty-primary)" opacity="0.75" />
    <path d="M40.5 6.5 C37.5 9 42 12 39.5 15 L38 13.7 C40 11.4 35.8 8.6 39.2 5.4 Z" fill="var(--color-gty-primary)" opacity="0.75" />
    <circle cx="32" cy="19" r="2.6" fill="var(--color-gty-green-text)" />
    <path d="M8 38 C8 26 18.7 20.4 32 20.4 C45.3 20.4 56 26 56 38 Z" fill="var(--color-gty-gold)" />
    <rect x="5" y="39.5" width="54" height="5" rx="2.5" fill="var(--color-gty-gold-deep)" />
    <rect x="13" y="47" width="38" height="4" rx="2" fill="var(--color-gty-navy)" opacity="0.7" />
  </svg>,
  // Safe & Comfortable — shield with a tick.
  <svg key="safe-comfortable" viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path
      d="M32 4 L55 12 L55 31 C55 45.5 45.4 54.8 32 60 C18.6 54.8 9 45.5 9 31 L9 12 Z"
      fill="var(--color-gty-primary)"
      stroke="var(--color-gty-gold)"
      strokeWidth="1.6"
    />
    <path d="M21 31.5 L25.5 27 L29.5 31 L39.5 21 L44 25.5 L29.5 40 Z" fill="#fff" />
  </svg>,
];

const TRUST_DESCRIPTION = 'Group yatras and family journeys across India and beyond';

/**
 * CRM-migration Step 2: "Trusted Since X Years" now reads
 * `yearsExperienceLabel` straight from the CRM (the same field `StatsBar`
 * reads) instead of the old fixture's `isPlaceholder`-marked guess. A value
 * the CRM Owner actually typed needs no asterisk — the whole
 * mark-as-unconfirmed mechanism this band used to carry is retired along
 * with the `pricingUnverified` gate (CRM-migration decision 1). `null`
 * (not yet set) omits the number rather than guessing one.
 *
 * Design review 2026-11-04: the reference image's second card instead reads
 * "Trusted For Years" — the Owner explicitly asked to KEEP this wording (a
 * real CRM-sourced number beats the reference's vaguer phrase), so this stays
 * unchanged. See the round's report for the question/answer.
 */
function buildWhyItems(yearsExperienceLabel: string | null) {
  return [
    { title: 'Curated Yatras', description: 'Handpicked spiritual journeys & destinations' },
    {
      title: yearsExperienceLabel ? `Trusted Since ${yearsExperienceLabel} Years` : 'Trusted For Years',
      description: TRUST_DESCRIPTION,
    },
    { title: '24/7 Travel Support', description: "We're with you at every step of your journey" },
    { title: 'Pure Veg Meals', description: 'Hygienic & delicious food on all tours' },
    { title: 'Safe & Comfortable', description: 'Well-planned trips with safety & comfort' },
  ];
}

/**
 * Decorative pine-cluster silhouette for the card's bottom corners — same
 * visual language as `Footer`'s `MountainBand`, tinted to sit on a light
 * card instead of a light-gray one. Purely decorative, `aria-hidden`.
 */
function PineCluster({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 70" className={className}>
      <path d="M18 70 L30 40 L24 40 L34 18 L28 18 L40 0 L52 18 L46 18 L56 40 L50 40 L62 70 Z" fill="#f3d9d6" opacity="0.5" />
      <path d="M-4 70 L6 46 L1 46 L10 28 L30 28 L39 46 L34 46 L44 70 Z" fill="#f7e5e3" opacity="0.5" />
    </svg>
  );
}

/** Faint mountain silhouette running the full width of the card's bottom edge — echoes `Footer`'s mountain motif, very low contrast per the brief. */
function FaintMountainBand() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1400 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full text-gty-primary/[0.07] 760:h-14"
    >
      <path d="M0 90 L140 36 L230 64 L330 20 L470 90Z" fill="currentColor" />
      <path d="M900 90 L1020 30 L1130 62 L1260 14 L1400 48 L1400 90Z" fill="currentColor" />
    </svg>
  );
}

/** Dashed flight-trail + airplane glyph, top-right corner — matches the reference image's corner motif. */
function FlightTrail() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 70" className="absolute right-4 top-4 h-10 w-16 text-gty-primary/35 860:h-12 860:w-20">
      <path
        d="M2 50 C30 56 48 40 58 26 C66 15 80 8 100 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path d="M96 4 L112 2 L118 10 L104 12 L108 20 L100 19 L94 12 L84 14 L86 9 Z" fill="currentColor" />
    </svg>
  );
}

/** Soft sunburst of short radiating ticks behind each icon's pale-peach circle — matches the reference's "radiating ticks" treatment. */
function RadiatingTicks() {
  const ticks = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[#f0b9a6]">
      {ticks.map((i) => (
        <line
          key={i}
          x1="50"
          y1="3"
          x2="50"
          y2="13"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
          transform={`rotate(${(i / ticks.length) * 360} 50 50)`}
        />
      ))}
    </svg>
  );
}

/** Pale-peach circle + radiating ticks behind each icon — the reference's icon treatment, replacing the old gold conic-gradient ring. */
function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex h-[66px] w-[66px] flex-none items-center justify-center 760:h-[86px] 760:w-[86px]">
      <RadiatingTicks />
      <span
        aria-hidden="true"
        className="absolute inset-[8%] rounded-pill"
        style={{ background: 'radial-gradient(circle,#fde3da 0%,#fbd0c2 55%,rgba(251,208,194,0) 78%)' }}
      />
      <span className="relative flex h-[62%] w-[62%] items-center justify-center">{children}</span>
    </span>
  );
}

export function WhyGtyBand({ yearsExperienceLabel }: WhyGtyBandProps) {
  const whyItems = buildWhyItems(yearsExperienceLabel);

  return (
    <section
      data-testid="section-why-gty-trust-strip"
      className="flex flex-col items-center gap-4 border-t border-gty-border-6 bg-gty-surface-5 px-gx py-[30px] 760:py-[34px]"
    >
      <div className="flex items-center gap-[10px]">
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
        <p className="text-10 font-bold uppercase tracking-label text-gty-navy">
          Why Travel With <span className="text-gty-primary">GTY</span>?
        </p>
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
      </div>

      {/*
        Mobile (<760px): the old `flex-wrap` + `flex-[1_0_44%]` layout
        collapsed into a tall, orphaned 2-column grid below 760px (the exact
        bug the brief calls out). Replaced with a horizontal scroll-snap row
        — ~2.3 columns visible at once (a deliberate peek of the next card),
        thin per-item dividers, dot row below. `tabIndex=0` + `role="group"`
        makes the row a focusable scroll region so arrow keys work, matching
        native browser behaviour for scrollable containers — no client JS
        needed for the scrolling itself. The 5 dots below are a plain
        "swipeable, 5 items" indicator, NOT scroll-position-synced (that would
        need a Client Component); left uniform rather than faking an active
        state. At 760px and up this becomes the original static 5-column row.
      */}
      <div
        className="relative w-full overflow-hidden rounded-24 shadow-gty-card"
        style={{
          background: 'radial-gradient(120% 150% at 50% -10%,#ffffff 0%,#fdf8f6 55%,#faf1ee 100%)',
        }}
      >
        <PineCluster className="pointer-events-none absolute -bottom-2 left-0 z-10 h-14 w-24 860:h-16 860:w-28" />
        <PineCluster className="pointer-events-none absolute -bottom-2 right-0 z-10 h-14 w-24 scale-x-[-1] 860:h-16 860:w-28" />
        <FaintMountainBand />
        <FlightTrail />

        <div
          role="group"
          aria-label="Why travel with GTY"
          tabIndex={0}
          className="relative flex w-full snap-x snap-mandatory overflow-x-auto no-scrollbar 760:flex-nowrap 760:overflow-visible"
        >
          {whyItems.map((item, index) => (
            <div
              key={item.title}
              className="relative flex w-[44%] flex-none snap-start flex-col items-center gap-3 px-3 py-[26px] text-center 760:w-auto 760:flex-1 760:gap-4 760:px-5 760:py-[38px]"
            >
              {index > 0 && (
                <span aria-hidden="true" className="absolute left-0 top-[18%] h-[64%] w-px bg-gty-border-6" />
              )}
              <IconBadge>{WHY_ICONS[index]}</IconBadge>
              <p className="text-16 font-extrabold leading-[1.2] tracking-nudge text-gty-navy">{item.title}</p>
              <p className="max-w-[215px] text-13-5 leading-[1.55] text-gty-body">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative page-dot row — mobile only, hints the row is swipeable without claiming to track scroll position. */}
      <div aria-hidden="true" className="flex items-center gap-[6px] 760:hidden">
        {whyItems.map((item) => (
          <span key={item.title} className="h-[6px] w-[6px] rounded-pill bg-gty-border-8" />
        ))}
      </div>
    </section>
  );
}
