import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL, GTY_WHATSAPP_URL } from '@/lib/gty-contact';

/**
 * Export lines 688-699. Server Component — plain `tel:`/`https://wa.me` links,
 * no client state needed, so it stays out of the trip-builder's client
 * boundary. Real contact details only, from `gty-contact.ts` (never re-typed).
 */
export function NeedHelpCard() {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-18 bg-gty-white p-[22px] shadow-gty-md">
      <span
        aria-hidden="true"
        className="flex h-[74px] w-[74px] flex-none items-center justify-center rounded-pill bg-gty-surface-5 text-gty-placeholder"
      >
        <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" className="flex-none">
          <path d="M12 3a8 8 0 0 0-8 8v5a2 2 0 0 0 2 2h2v-8H6v1a6 6 0 1 1 12 0v-1h-2v8h2a2 2 0 0 0 2-2v-5a8 8 0 0 0-8-8z" />
        </svg>
      </span>
      <div className="flex min-w-[190px] flex-1 flex-col gap-[7px]">
        <p className="text-11-5 font-extrabold uppercase tracking-eyebrow-3 text-gty-primary">Need help planning?</p>
        <p className="text-19 leading-[1.2] text-gty-ink">Talk to our travel expert</p>
        <p className="text-13 leading-[1.55] text-gty-muted">
          Get free guidance and a personalized itinerary from our team.
        </p>
        <div className="flex flex-wrap gap-[11px] pt-2">
          <a
            href={`tel:${GTY_PHONE_TEL}`}
            className="inline-flex items-center gap-[9px] rounded-pill border border-gty-red-300 bg-gty-white px-[18px] py-[11px] text-13 font-semibold text-gty-ink transition-colors duration-gty-fast ease-gty hover:bg-gty-red-150"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" className="flex-none text-gty-primary">
              <path d="M6.6 10.8c1.1 2.2 2.9 4 5.1 5.1l1.7-1.7c.2-.2.5-.3.8-.2 1 .3 2 .5 3.1.5.4 0 .8.3.8.8V18c0 .4-.3.8-.8.8C9.6 18.8 5.2 14.4 5.2 7.5c0-.4.3-.8.8-.8h2.7c.4 0 .8.3.8.8 0 1.1.2 2.1.5 3.1.1.3 0 .6-.2.8z" />
            </svg>
            {GTY_PHONE_DISPLAY}
          </a>
          <a
            href={GTY_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[9px] rounded-pill border border-gty-green-border bg-gty-white px-[18px] py-[11px] text-13 font-semibold text-gty-ink transition-colors duration-gty-fast ease-gty hover:bg-gty-green-bg"
          >
            <svg viewBox="0 0 32 32" width="19" height="19" fill="#25d366" aria-hidden="true" className="flex-none">
              <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
