import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL, GTY_WHATSAPP_URL } from '@/lib/gty-contact';

const BENEFITS = [
  {
    label: 'Quick Response',
    path: 'M13 2L4 14h6l-1 8 9-12h-6z',
  },
  {
    label: 'Personalized Assistance',
    path: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 10a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM18.5 10a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM6 20c0-4 2.7-6 6-6s6 2 6 6z M0.5 20c0-3 1.8-4.6 4.5-4.8V20z M23.5 20c0-3-1.8-4.6-4.5-4.8V20z',
  },
  {
    label: 'Get Itinerary & Quotes',
    path: 'M6 2h8l5 5v15H6z',
  },
  {
    label: 'Travel Consultation',
    path: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z',
  },
] as const;

/**
 * `.wacard` — export lines 830-858, tech spec §4.3.
 *
 * IMPORTANT (composition contract): this component is `position: absolute`
 * and relies on its NEAREST `position: relative` ancestor for the "overlap
 * the footer's top edge" effect. Render it as a preceding sibling of
 * `<Footer />` inside a shared `<div className="relative">` wrapper, e.g.:
 *
 *   <div className="relative">
 *     <BottomContactStrip />
 *     <Footer />
 *   </div>
 *
 * Because it is absolutely positioned, it takes no layout space — `Footer`
 * renders immediately at the top of that wrapper, and this card's `top`
 * offset then lands inside Footer's mountain band, matching the export
 * exactly. (Not wired into `src/app/layout.tsx` in this pass — pages/layout
 * composition is out of scope here; see handoff notes.)
 */
export function BottomContactStrip() {
  return (
    <div className="absolute left-1/2 top-[60px] z-[3] w-[92%] -translate-x-1/2 rounded-18 bg-gty-white p-[18px] shadow-gty-wacard 860:top-[44px] 860:p-4 860:px-5 1300:top-[74px] 1300:w-[min(860px,70%)]">
      <div className="flex flex-wrap items-center gap-[18px]">
        <div className="flex min-w-[250px] flex-[1.15] items-center gap-[14px]">
          {/*
            The WhatsApp icon was a plain <span>: this card invited the visitor
            to "Chat with us on WhatsApp" and gave desktop users no way to do
            it — only `MobileActionBar` (hidden ≥760px) carried a real wa.me
            link. Same URL, from the same shared constant, so the two can't
            drift apart again.
          */}
          <a
            href={GTY_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Guruji Travel Yatra on WhatsApp"
            className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-pill bg-gty-whatsapp shadow-gty-whatsapp transition-transform duration-gty-fast ease-gty hover:-translate-y-px"
          >
            <svg viewBox="0 0 32 32" width="34" height="34" fill="#fff" aria-hidden="true">
              <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
            </svg>
          </a>
          <div className="flex flex-col items-start gap-[6px]">
            <p className="text-16-5 font-extrabold leading-[1.15] text-gty-ink">Let&#39;s Plan Your Next Journey!</p>
            <a
              href={GTY_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-12-5 text-gty-body underline-offset-2 hover:underline"
            >
              Chat with us on WhatsApp
            </a>
            <a href={`tel:${GTY_PHONE_TEL}`} className="pt-px text-22 font-extrabold leading-[1.1] text-gty-ink">
              {GTY_PHONE_DISPLAY}
            </a>
          </div>
        </div>

        <span aria-hidden="true" className="hidden min-h-[78px] w-[1.5px] flex-none self-stretch bg-gty-red-400 860:block" />

        <div className="flex min-w-[260px] flex-[1.35] justify-around gap-2">
          {BENEFITS.map((benefit) => (
            <div key={benefit.label} className="flex min-w-[80px] flex-1 flex-col items-center gap-[7px] text-center">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-gty-red-200 text-gty-primary">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
                  <path d={benefit.path} />
                </svg>
              </span>
              <span className="text-11-5 leading-[1.3] text-gty-ink-soft">{benefit.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
