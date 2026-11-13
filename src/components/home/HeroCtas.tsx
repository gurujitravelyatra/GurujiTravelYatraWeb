'use client';

import { ArrowRight, Play } from 'lucide-react';

import { useModal } from '@/components/modals/modal-context';

/**
 * "Redux" redesign (brief §3 point 5) — primary + ghost CTA pair.
 *
 * "Watch Our Story" scrolls to the `JourneyVideoBlock` below (tech spec
 * §4.4 row 2: "opens the video block") via a plain in-page anchor — it does
 * NOT cycle the video, that behavior lives entirely in the video block's
 * own play button (§4.5: "JourneyVideoBlock's play button/video-switch" is
 * the only client state for video cycling). `#story` matches
 * `JourneyVideoBlock`'s `id` (brief §7); `scroll-margin-top` there gives the
 * "offset -60" the brief asks for without needing a manual scroll handler.
 */
export function HeroCtas() {
  const { openEnquiry } = useModal();

  return (
    <div className="mt-9 flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={() => openEnquiry({ label: 'Page', value: 'Home' })}
        className="btn-shine group inline-flex items-center gap-2.5 rounded-full bg-redux-crimson px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_40px_-12px_rgba(220,38,38,0.75)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark"
      >
        Start Your Journey
        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
      </button>
      <a
        href="#story"
        className="group inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 py-3 pl-5 pr-7 text-[15px] font-bold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-redux-crimson text-white transition-transform duration-300 group-hover:scale-110">
          <Play size={13} className="ml-0.5 fill-current" />
        </span>
        Watch Our Story
      </a>
    </div>
  );
}
