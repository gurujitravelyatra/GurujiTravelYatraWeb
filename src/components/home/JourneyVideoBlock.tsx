import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { safeVideoEmbedUrl } from '@/lib/video-embed';
import { Reveal } from './Reveal';

export interface JourneyVideoBlockProps {
  /** `site.settings.profileVideoUrl` from `GET /public/site` — a single embeddable URL, or `null` until the Owner sets one. */
  profileVideoUrl: string | null;
}

/**
 * CRM-migration Step 2: this used to cycle through several fixture-only trip
 * captions with no real video behind any of them. The CRM contract offers
 * exactly one video — `site.settings.profileVideoUrl`, a single embed URL —
 * so this is now a single embed block, not a carousel. `null` renders the
 * same honest "coming soon" state the old empty-videos-array case did,
 * rather than fabricating a caption for a video that may not exist yet.
 *
 * "Redux" redesign (brief §7, owner fix 4, 2026-11-14):
 * - `id="story"` (was `journey-video`) so `HeroCtas`'s "Watch Our Story"
 *   anchor matches the brief's own id; `scroll-mt-[60px]` gives the
 *   brief's "offset -60" without a manual scroll handler.
 * - `aspect-video` (16:9) replaces the old fixed-height box, and the video
 *   column is now the LARGER share of the row (`grid-cols-[0.8fr_1.2fr]`,
 *   `xl:grid-cols-[0.7fr_1.3fr]`) — both owner fix 4 asks for directly.
 *
 * Deliberately did NOT switch to a native `<video poster controls
 * playsInline>` (the brief's literal mechanism): `profileVideoUrl` is an
 * ALLOWLISTED YOUTUBE/VIMEO EMBED URL (`isSafeVideoEmbedUrl`), not a direct
 * video file — a raw `<video src>` cannot play a `youtube.com/embed/...` or
 * `player.vimeo.com/video/...` URL at all, and there is no poster-image
 * field anywhere in the CRM contract to show before it. Changing what this
 * field means or adding a new one would be a contract/data-fetching change,
 * which this round's rules explicitly forbid ("do NOT touch src/server/crm,
 * the contract... or any data fetching"). The `<iframe>` embed keeps its
 * own platform-provided thumbnail and click-to-play affordance; only the
 * frame's SIZE/SHAPE/chrome around it changed.
 */
export function JourneyVideoBlock({ profileVideoUrl }: JourneyVideoBlockProps) {
  const embedUrl = safeVideoEmbedUrl(profileVideoUrl);

  return (
    <section id="story" data-testid="section-5-8-journey-video" className="relative overflow-hidden bg-redux-cream py-16 scroll-mt-[60px] sm:py-24">
      <p
        aria-hidden="true"
        className="pointer-events-none absolute -top-1 right-6 hidden rotate-2 font-redux-display text-2xl italic text-redux-crimson/40 lg:block"
      >
        memories that last a lifetime
      </p>
      <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:px-10 xl:grid-cols-[0.7fr_1.3fr]">
        <Reveal>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest2 text-redux-crimson">
            <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-redux-crimson" />
            Explore journeys
          </span>
          <h2 className="mt-3 font-redux-display text-4xl font-medium leading-[1.12] tracking-tight text-stone-900 sm:text-5xl lg:text-5xl">
            Every Journey
            <br />
            Tells a <em className="italic text-redux-crimson">Story</em>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-redux-ink-soft">
            We don&#39;t just plan trips, we create lifetime memories.
          </p>
          <Link
            href="/tour-packages"
            className="btn-shine group mt-7 inline-flex items-center gap-2.5 rounded-full bg-redux-crimson px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_40px_-12px_rgba(220,38,38,0.75)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark"
          >
            Explore All Journeys
            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <Reveal delay={0.15}>
          {!embedUrl ? (
            <div
              data-testid="journey-video-empty"
              className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[2rem] border border-stone-200 bg-stone-100"
            >
              <span className="absolute left-5 top-5 rounded-full border border-stone-900/15 bg-white/70 px-4 py-1.5 text-xs font-bold tracking-wide text-stone-600 backdrop-blur-md">
                Video coming soon
              </span>
              <p className="px-6 text-center text-sm leading-relaxed text-stone-500">
                Our journey video is coming soon.
              </p>
            </div>
          ) : (
            <div className="group relative block aspect-video w-full overflow-hidden rounded-[2rem] border border-stone-200 bg-[#151312] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.5)]">
              <iframe
                src={embedUrl}
                title="Guruji Travel Yatra — our journey"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
