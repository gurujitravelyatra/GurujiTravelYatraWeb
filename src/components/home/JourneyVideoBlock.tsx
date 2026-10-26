import Link from 'next/link';

import { safeVideoEmbedUrl } from '@/lib/video-embed';

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
 */
export function JourneyVideoBlock({ profileVideoUrl }: JourneyVideoBlockProps) {
  const embedUrl = safeVideoEmbedUrl(profileVideoUrl);

  return (
    <section
      id="journey-video"
      data-testid="section-5-8-journey-video"
      className="flex flex-wrap gap-[22px] border-t border-gty-border-6 px-gx py-[22px]"
    >
      <div className="flex w-full flex-col gap-3 760:w-[230px]">
        <p className="text-11 font-bold uppercase tracking-eyebrow-3 text-gty-primary">Explore Journeys</p>
        <h2 className="text-26 font-extrabold leading-[1.05] tracking-tightest text-gty-ink">
          Every Journey
          <br />
          Tells a Story
        </h2>
        <p className="text-11 leading-relaxed text-gty-subtle">
          We don&#39;t just plan trips,
          <br />
          we create lifetime memories.
        </p>
        <Link
          href="/tour-packages"
          className="inline-flex min-h-[42px] w-fit items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-5 py-3 text-11-5 font-bold tracking-btn text-gty-white shadow-gty-btn transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
        >
          Explore All Journeys <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="min-w-[280px] flex-1">
        {!embedUrl ? (
          <div
            data-testid="journey-video-empty"
            className="flex h-[230px] items-center justify-center overflow-hidden rounded-18 border-[1.5px] border-dashed border-gty-border-8 bg-gty-surface-3 px-6 text-center text-12 leading-relaxed text-gty-subtle 760:h-[420px]"
          >
            Our journey video is coming soon.
          </div>
        ) : (
          <div className="relative h-[230px] overflow-hidden rounded-18 bg-[#151312] shadow-gty-lift 760:h-[420px]">
            <iframe
              src={embedUrl}
              title="Guruji Travel Yatra — our journey"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </section>
  );
}
