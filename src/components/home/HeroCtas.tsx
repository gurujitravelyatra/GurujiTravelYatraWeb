'use client';

import { useModal } from '@/components/modals/modal-context';

/**
 * The Hero's two CTAs (export lines 167-168). Split out from `Hero.tsx` so
 * the rest of the section stays a Server Component — only these buttons
 * need client interactivity (`useModal()`).
 *
 * "Watch Our Story" scrolls to the `JourneyVideoBlock` below (tech spec
 * §4.4 row 2: "opens the video block") via a plain in-page anchor — it does
 * NOT cycle the video, that behavior lives entirely in the video block's
 * own play button (§4.5: "JourneyVideoBlock's play button/video-switch" is
 * the only client state for video cycling).
 */
export function HeroCtas() {
  const { openEnquiry } = useModal();

  return (
    <div className="flex flex-wrap gap-[14px] pt-1">
      <button
        type="button"
        onClick={() => openEnquiry({ label: 'Page', value: 'Home' })}
        className="inline-flex min-h-[54px] items-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-7 py-[15px] text-12-5 font-bold tracking-btn text-gty-white shadow-[0_8px_22px_rgba(255,255,255,.35)] transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
      >
        Start Your Journey <span aria-hidden="true">→</span>
      </button>
      <a
        href="#journey-video"
        className="inline-flex min-h-[54px] items-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] border-gty-border-9 bg-gty-white/92 px-[26px] py-[15px] text-12-5 font-bold tracking-btn text-gty-ink shadow-[0_8px_20px_rgba(255,255,255,.3)] transition-colors duration-gty-fast ease-gty hover:border-gty-primary hover:text-gty-primary"
      >
        <span aria-hidden="true">▶</span> Watch Our Story
      </a>
    </div>
  );
}
