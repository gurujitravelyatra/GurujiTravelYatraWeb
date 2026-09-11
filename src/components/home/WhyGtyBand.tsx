import type { ReactNode } from 'react';

import { whyItems } from '@/content/fixtures/whys.fixture';

/**
 * Export lines 259-313, tech spec §4.4 (unnumbered row, "Why Travel With
 * GTY?" band). This is where product-spec §5.1 step 4's "Trust strip"
 * content actually renders (tech spec row 4: the export places this content
 * here, not near the top, and the export is layout's source of truth).
 *
 * Icon markup is copied verbatim, element-for-element, from the export
 * (decorative line art, not photography — no CMS dependency) and zipped
 * positionally with `whyItems` (both are the same 5-item list, same order,
 * transcribed from the same `whys` export constant).
 */
const WHY_ICONS: readonly ReactNode[] = [
  // Curated Yatras — export line 266
  <svg key="curated-yatras" viewBox="0 0 64 64" width="46" height="46" fill="currentColor" aria-hidden="true">
    <path d="M32 4 L39 7 L32 10 Z" />
    <rect x="31" y="4" width="1.6" height="12" />
    <path d="M32 15 C25 15 22 22 22 27 L42 27 C42 22 39 15 32 15 Z" />
    <rect x="20" y="27" width="24" height="3" />
    <rect x="23" y="31" width="3.4" height="16" />
    <rect x="30.3" y="31" width="3.4" height="16" />
    <rect x="37.6" y="31" width="3.4" height="16" />
    <rect x="17" y="47" width="30" height="3.6" />
    <rect x="13" y="51.5" width="38" height="3.6" />
    <rect x="9" y="56" width="46" height="4" />
  </svg>,
  // Trusted Since 8+ Years — export line 276
  <svg key="trusted-since" viewBox="0 0 64 64" width="46" height="46" fill="currentColor" aria-hidden="true">
    <path d="M32 4 L35.2 12.4 L44 12.9 L37.1 18.4 L39.4 27 L32 22.1 L24.6 27 L26.9 18.4 L20 12.9 L28.8 12.4 Z" />
    <circle cx="32" cy="34" r="7" />
    <circle cx="17" cy="38" r="5.6" />
    <circle cx="47" cy="38" r="5.6" />
    <path d="M18 58 C18 47 24 43 32 43 C40 43 46 47 46 58 Z" />
    <path d="M3 58 C3 49 8.5 45 16 44.6 L16 58 Z" />
    <path d="M61 58 C61 49 55.5 45 48 44.6 L48 58 Z" />
  </svg>,
  // 24/7 Travel Support — export line 286
  <svg key="travel-support" viewBox="0 0 64 64" width="48" height="48" fill="currentColor" aria-hidden="true">
    <path d="M32 8 C18.7 8 8 18.7 8 32 L8 37 L14 37 L14 32 C14 22 22 14 32 14 C42 14 50 22 50 32 L50 37 L56 37 L56 32 C56 18.7 45.3 8 32 8 Z" />
    <path d="M5 34 L15 34 C16.1 34 17 34.9 17 36 L17 48 C17 49.1 16.1 50 15 50 L5 50 C3.9 50 3 49.1 3 48 L3 36 C3 34.9 3.9 34 5 34 Z" />
    <path d="M49 34 L59 34 C60.1 34 61 34.9 61 36 L61 48 C61 49.1 60.1 50 59 50 L49 50 C47.9 50 47 49.1 47 48 L47 36 C47 34.9 47.9 34 49 34 Z" />
    <path d="M52 50 L55 50 L55 54 C55 56.8 52.8 59 50 59 L34 59 L34 56 L50 56 C51.1 56 52 55.1 52 54 Z" />
  </svg>,
  // Pure Veg Meals — export line 296
  <svg key="pure-veg" viewBox="0 0 64 64" width="46" height="46" fill="currentColor" aria-hidden="true">
    <path d="M24.5 6.5 C21.5 9 26 12 23.5 15 L22 13.7 C24 11.4 19.8 8.6 23.2 5.4 Z" />
    <path d="M32.5 4 C29.5 7 34 10.5 31.5 14 L30 12.6 C32 10 27.8 6.7 31.2 3 Z" />
    <path d="M40.5 6.5 C37.5 9 42 12 39.5 15 L38 13.7 C40 11.4 35.8 8.6 39.2 5.4 Z" />
    <circle cx="32" cy="19" r="2.6" />
    <path d="M8 38 C8 26 18.7 20.4 32 20.4 C45.3 20.4 56 26 56 38 Z" />
    <rect x="5" y="39.5" width="54" height="5" rx="2.5" />
    <rect x="13" y="47" width="38" height="4" rx="2" />
  </svg>,
  // Safe & Comfortable — export line 306
  <svg key="safe-comfortable" viewBox="0 0 64 64" width="46" height="46" fill="currentColor" aria-hidden="true">
    <path d="M32 4 L55 12 L55 31 C55 45.5 45.4 54.8 32 60 C18.6 54.8 9 45.5 9 31 L9 12 Z" />
    <path d="M21 31.5 L25.5 27 L29.5 31 L39.5 21 L44 25.5 L29.5 40 Z" fill="#fff" />
  </svg>,
];

/**
 * Ties the asterisk to its footnote for assistive tech — see `StatsBar`, whose
 * `stats-placeholder-note` pairing this mirrors exactly.
 *
 * The band previously rendered the asterisk `aria-hidden` (correct on its own:
 * a lone "*" announced next to a heading is noise) but gave the footnote NO
 * `id`, so there was nothing for an `aria-describedby` to point at and nothing
 * did. Net effect for a screen-reader user: the marker was suppressed and the
 * explanation was never associated with the figure — strictly worse than
 * having no marker at all, because the unconfirmed number read as settled
 * fact. The `id` below and the `aria-describedby` on the card group close
 * that; the asterisk stays visible on screen and `aria-hidden` to AT, exactly
 * as in `StatsBar`.
 */
const PLACEHOLDER_NOTE_ID = 'why-placeholder-note';

export function WhyGtyBand() {
  // "Trusted Since 8+ Years" quotes the canonical years-of-service stat, which
  // is not confirmed (stats.fixture.ts). Marked here with the same asterisk +
  // footnote treatment the stats bar uses, so the same number is never settled
  // fact in one band and a placeholder in another.
  const hasPlaceholder = whyItems.some((item) => item.isPlaceholder);

  return (
    <section
      data-testid="section-why-gty-trust-strip"
      className="flex flex-col items-center gap-4 border-t border-gty-border-6 bg-gty-surface-5 px-gx py-[30px] 760:py-[34px]"
    >
      <div className="flex items-center gap-[10px]">
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
        <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">Why Travel With GTY?</p>
        <span aria-hidden="true" className="h-[1.5px] w-[26px] bg-gty-primary" />
      </div>

      <div
        role="group"
        aria-label="Why travel with GTY"
        aria-describedby={hasPlaceholder ? PLACEHOLDER_NOTE_ID : undefined}
        className="flex w-full flex-wrap rounded-24 shadow-[0_0_30px_6px_rgba(255,90,70,.22),0_22px_48px_rgba(198,0,0,.3)] 760:flex-nowrap"
        style={{ background: 'radial-gradient(130% 150% at 50% -10%,#f5442f 0%,#e51612 42%,#c60000 100%)' }}
      >
        {whyItems.map((item, index) => (
          <div
            key={item.title}
            className="flex flex-1 flex-[1_0_44%] flex-col items-center gap-4 border-l border-gty-white/26 px-3 py-[26px] text-center 760:flex-1 760:px-5 760:py-[38px]"
          >
            <span className="relative flex h-[86px] w-[86px] flex-none items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute -inset-4 rounded-pill"
                style={{
                  background:
                    'radial-gradient(circle,rgba(255,214,130,.6) 0%,rgba(255,176,72,.22) 46%,rgba(255,176,72,0) 72%)',
                }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 flex rounded-pill p-1"
                style={{
                  background: 'conic-gradient(from 205deg,#f8d787,#c2842a,#fdeeb8,#a3661c,#f8d787)',
                }}
              >
                <span className="relative flex flex-1 items-center justify-center rounded-pill bg-gty-white text-gty-primary">
                  {WHY_ICONS[index]}
                  {index === 2 && (
                    <span className="absolute left-0 right-0 top-[47%] -translate-y-1/2 text-12-5 font-extrabold tracking-tightest text-gty-primary">
                      24/7
                    </span>
                  )}
                </span>
              </span>
            </span>
            <p className="text-16 font-extrabold leading-[1.2] tracking-nudge text-gty-white">
              {item.title}
              {item.isPlaceholder && (
                <span
                  aria-hidden="true"
                  data-testid={`why-placeholder-marker-${item.title}`}
                  className="align-super text-11 font-bold text-gty-white/70"
                >
                  *
                </span>
              )}
            </p>
            <p className="max-w-[215px] text-13-5 leading-[1.55] text-gty-white/92">{item.description}</p>
          </div>
        ))}
      </div>

      {hasPlaceholder && (
        <p id={PLACEHOLDER_NOTE_ID} data-testid="why-placeholder-note" className="text-11 text-gty-subtle">
          *These figures are pending confirmation and are shown as placeholders.
        </p>
      )}
    </section>
  );
}
