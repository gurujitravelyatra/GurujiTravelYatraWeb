import { FileText, Phone, UserRound, Zap } from 'lucide-react';

import type { SiteContact } from '@/lib/site-contact';
import { Reveal } from './Reveal';

export interface WhatsAppCtaSectionProps {
  contact: SiteContact;
}

const PERKS = [
  { icon: <Zap size={17} aria-hidden="true" />, label: 'Quick Response' },
  { icon: <UserRound size={17} aria-hidden="true" />, label: 'Personalized Assistance' },
  { icon: <FileText size={17} aria-hidden="true" />, label: 'Get Itinerary & Quotes' },
  { icon: <Phone size={17} aria-hidden="true" />, label: 'Travel Consultation' },
] as const;

const WHATSAPP_ICON = (
  <svg viewBox="0 0 32 32" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
  </svg>
);

/**
 * "Redux" redesign (brief §10, 2026-11-14) — a standalone, full-width
 * WhatsApp CTA section in the home page's normal flow.
 *
 * This is the SAME real content `BottomContactStrip` already renders —
 * same heading, same phone/WhatsApp CTAs, same 4 perks (Quick Response,
 * Personalized Assistance, Get Itinerary & Quotes, Travel Consultation) —
 * not a second, independently-worded card. Showing both on the SAME page
 * would duplicate it; `SiteShell` now skips rendering `BottomContactStrip`
 * specifically on `/` for exactly that reason (see its own header), while
 * leaving `BottomContactStrip` itself fully unchanged for every other
 * route, where it still renders as shared chrome overlapping the footer.
 */
export function WhatsAppCtaSection({ contact }: WhatsAppCtaSectionProps) {
  return (
    <section className="bg-white px-4 py-16 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[2.5rem] border border-stone-200/80 bg-redux-cream shadow-[0_40px_80px_-45px_rgba(127,18,22,0.45)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 400 300"
            className="pointer-events-none absolute right-0 top-0 hidden h-full w-1/2 text-redux-crimson/10 lg:block"
          >
            <path
              d="M410 250C300 270 220 210 210 140 202 80 260 30 400 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="1 9"
              strokeLinecap="round"
            />
          </svg>
          <p aria-hidden="true" className="pointer-events-none absolute left-7 top-6 hidden -rotate-3 font-redux-display text-2xl italic text-redux-crimson/50 lg:block">
            Journeys that stay forever
          </p>
          <p aria-hidden="true" className="pointer-events-none absolute bottom-6 right-9 hidden rotate-2 font-redux-display text-2xl italic text-redux-crimson lg:block">
            We&#39;re here for you!
          </p>

          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#25D366]/15 text-[#1DAA55]">{WHATSAPP_ICON}</span>
              <h2 className="mt-5 font-redux-display text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl">
                Let&#39;s Plan Your <em className="italic text-redux-crimson">Next Journey!</em>
              </h2>
              <p className="mt-3 text-[15px] font-medium text-redux-ink-mute">
                Chat with us on WhatsApp — itineraries, quotes &amp; answers in minutes.
              </p>
              <a
                href={`tel:${contact.phoneTel}`}
                className="mt-3 block font-redux-display text-2xl font-semibold text-stone-900 transition-colors hover:text-redux-crimson sm:text-3xl"
              >
                {contact.phoneDisplay}
              </a>
              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <a
                  href={contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-shine group inline-flex items-center gap-2.5 rounded-full bg-[#25D366] px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_35px_-12px_rgba(37,211,102,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1DA851]"
                >
                  {WHATSAPP_ICON}
                  Chat on WhatsApp
                </a>
                <a
                  href={`tel:${contact.phoneTel}`}
                  className="inline-flex items-center gap-2.5 rounded-full border border-stone-300 bg-white px-6 py-3.5 text-[15px] font-bold text-stone-900 transition-all duration-300 hover:-translate-y-0.5 hover:border-redux-crimson/50 hover:text-redux-crimson"
                >
                  <Phone size={16} aria-hidden="true" />
                  Call Us
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {PERKS.map((perk) => (
                <div
                  key={perk.label}
                  className="rounded-2xl border border-stone-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-redux-crimson/30 hover:shadow-[0_18px_35px_-20px_rgba(127,18,22,0.35)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-redux-crimson-tint text-redux-crimson">{perk.icon}</span>
                  <p className="mt-3 text-[13px] font-bold leading-snug text-stone-800">{perk.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
