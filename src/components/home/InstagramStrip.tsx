import { Instagram } from 'lucide-react';

import { Reveal } from './Reveal';

export interface InstagramStripProps {
  /** Resolved from `site.settings.instagramUrl` with a static fallback — see `resolveSiteContact`. */
  instagramUrl: string;
}

/** Pulls the handle out of a `instagram.com/<handle>/` URL for the "@handle" heading, without inventing one if the shape is unexpected. */
function instagramHandleFromUrl(url: string): string {
  const match = /instagram\.com\/([^/]+)/i.exec(url);
  return match ? match[1] : 'gurujitravelyatra';
}

/**
 * "Redux" redesign (brief §9, 2026-11-14) — postcard-style tiles replace
 * the old dashed "Image placeholder" boxes. Still no real Instagram API/CMS
 * integration (same as before — see the deleted comment this file used to
 * carry), so these stay obvious decorative art, not photos presented as
 * real posts; the brief's own fallback for this exact situation ("If real
 * Instagram photos are available in the CRM site images, use them instead")
 * does not apply — `GET /public/site`'s `images` has no Instagram slot at
 * all (`HERO_BACKGROUND`/`ABOUT`/`GALLERY`/`FOOTER` only), so there is
 * nothing to prefer over the postcard art.
 *
 * Caption copy ("Yatra diary", "Temple trails", …) is the brief's own
 * decorative placeholder set, not a claim about any specific real post.
 */
const POSTCARDS = [
  { caption: 'Yatra diary', bg: 'bg-redux-crimson-tint' },
  { caption: 'Temple trails', bg: 'bg-[#F5F0EB]' },
  { caption: 'Mountain air', bg: 'bg-redux-crimson-tint' },
  { caption: 'Group joy', bg: 'bg-[#F5F0EB]' },
  { caption: 'Roadside chai', bg: 'bg-redux-crimson-tint' },
  { caption: 'Darshan day', bg: 'bg-[#F5F0EB]' },
] as const;

export function InstagramStrip({ instagramUrl }: InstagramStripProps) {
  const handle = instagramHandleFromUrl(instagramUrl);

  return (
    <section data-testid="section-12-instagram" className="bg-redux-cream px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <h2 className="font-redux-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
              <em className="italic text-redux-crimson">@</em>
              {handle}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm font-bold text-redux-ink-soft transition-colors hover:text-redux-crimson"
            >
              Follow Our Journey
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                ↗
              </span>
            </a>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {POSTCARDS.map((postcard, index) => (
            <Reveal key={postcard.caption} delay={index * 0.06}>
              <div
                className={`group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/80 p-4 transition-all duration-400 hover:-rotate-2 hover:shadow-[0_20px_45px_-20px_rgba(127,18,22,0.4)] ${postcard.bg}`}
              >
                <div className="flex items-center justify-between">
                  <Instagram size={16} className="text-redux-crimson/70" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-7 rotate-3 place-items-center rounded-[3px] border border-dashed border-redux-crimson/40 bg-white/70 text-[9px] font-bold text-redux-crimson/60"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <span aria-hidden="true" className="self-center font-redux-display text-4xl font-semibold italic text-redux-crimson/25 group-hover:text-redux-crimson/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-redux-ink-mute">
                    Postcard {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="block font-redux-display text-lg italic leading-none text-redux-crimson/80">{postcard.caption}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
