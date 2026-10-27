import type { Metadata } from 'next';

import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The terms that apply when you browse Guruji Travel Yatra or submit an enquiry for a tour package.',
  // Placeholder copy pending legal review — keep it out of search results
  // until the reviewed version replaces it.
  robots: { index: false, follow: true },
};

/**
 * Build-time static prerendering fix (2026-10-27) — this page's own code
 * reads no CRM data, but it renders `<LegalPageShell>` → `<SiteShell>`,
 * which does (`getSite()`/`getPlaces()`) — route segment config applies
 * to the WHOLE route's render, not only this file's own fetches, so this
 * export is what actually removes this route from `next build`'s
 * "Generating static pages" phase. CONFIRMED TRADEOFF: `force-dynamic`
 * also disables fetch-level (Data Cache) caching for this route, not only
 * the static-HTML cache, so `SiteShell`'s `revalidate: 60` is not honoured
 * here anymore — accepted deliberately. Full reasoning, re-verified
 * against this Next version's own docs rather than assumed, lives on
 * `src/app/page.tsx`'s identical export — read it there.
 */
export const dynamic = 'force-dynamic';

const GTY_EMAIL = 'info@gurujitravelyatra.com';
const GTY_PHONE_DISPLAY = '+91 90999 57658';
const GTY_ADDRESS = 'Ahmedabad, Gujarat, India';

/**
 * `/legal/terms-and-conditions` — the exact route `Footer`'s "Terms &
 * Conditions" Support link points at (it previously 404'd).
 *
 * Scope discipline, same as the privacy page: this states only what the site
 * itself demonstrates. Notably §3 says plainly that prices and itineraries
 * shown here are indicative and confirmed on enquiry — which is the honest
 * position given `Package.pricingUnverified` is set on several records and
 * the `TODO(pricing-confirm)` comments in `packages.fixture.ts` are still
 * open. No cancellation table, refund percentage, payment schedule or
 * governing-law clause is invented; `/legal/cancellation-policy` and
 * `/legal/refund-policy` remain unwritten and are out of this round's scope.
 */
const sections: LegalSection[] = [
  {
    heading: '1. About These Terms',
    paragraphs: [
      'These terms apply to your use of the Guruji Travel Yatra website. By browsing the site or submitting an enquiry, you accept them. If you do not accept them, please do not use the site.',
    ],
  },
  {
    heading: '2. What This Website Does',
    paragraphs: [
      'This website presents tour packages and lets you send us an enquiry or request a brochure. It is not a booking engine: submitting a form does not create a booking, hold a seat, or take any payment.',
      'A trip is confirmed only when we have spoken with you, agreed the itinerary and price in writing, and you have completed the booking steps we set out at that time.',
    ],
  },
  {
    heading: '3. Prices, Itineraries and Availability',
    paragraphs: [
      'Prices, durations and routes shown on this site are indicative and are confirmed with you at the time of enquiry. They may change with season, group size, availability and supplier rates.',
      'Photographs, illustrations and sample itineraries are shown to give a sense of a journey and may not depict the exact hotels, vehicles or routes used on your trip.',
    ],
  },
  {
    heading: '4. Using This Site',
    bullets: [
      'Use the site only for planning genuine travel.',
      'Give accurate contact details when you enquire, so that we can actually reach you.',
      'Do not attempt to disrupt, scrape, overload or gain unauthorised access to the site.',
      'Do not copy site content for commercial use without our written permission.',
    ],
  },
  {
    heading: '5. Your Enquiry',
    paragraphs: [
      'When you submit an enquiry or brochure request, you are asking us to contact you about travel. We handle the details you share as described in our Privacy Policy.',
      'You can ask us to stop contacting you at any time.',
    ],
  },
  {
    heading: '6. Travel Documents and Eligibility',
    paragraphs: [
      'You are responsible for holding valid identification, passports, visas and any permits or medical clearances your journey requires. Some of our journeys involve high-altitude or physically demanding travel; please tell us about health conditions when you enquire so we can advise honestly on suitability.',
    ],
  },
  {
    heading: '7. Bookings, Cancellations and Refunds',
    paragraphs: [
      'Cancellation and refund terms are agreed in writing at the time of booking and are set out in your booking confirmation. Detailed cancellation and refund policies will be published on this site once they have been reviewed.',
    ],
  },
  {
    heading: '8. Content and Trademarks',
    paragraphs: [
      'The Guruji Travel Yatra name, logo and the content of this site belong to us or to our licensors. Third-party names and marks that appear on the site belong to their respective owners.',
    ],
  },
  {
    heading: '9. Limitation of Liability',
    paragraphs: [
      'We take care to keep this site accurate, but it is offered on an “as is” basis. To the extent permitted by law, we are not liable for loss arising from reliance on indicative information published here before it has been confirmed with you directly.',
      'Nothing in these terms limits any liability that cannot lawfully be limited.',
    ],
  },
  {
    heading: '10. Changes To These Terms',
    paragraphs: [
      'We may update these terms. The version published on this page at the time you use the site is the one that applies.',
    ],
  },
  {
    heading: '11. Contact Us',
    paragraphs: ['Questions about these terms can be sent to:'],
    bullets: [
      `Email: ${GTY_EMAIL}`,
      `Phone: ${GTY_PHONE_DISPLAY}`,
      `Guruji Travel Yatra, ${GTY_ADDRESS}`,
    ],
  },
];

export default function TermsAndConditionsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      path="/legal/terms-and-conditions"
      intro={[
        'These terms cover your use of the Guruji Travel Yatra website and the enquiries you send through it. They are not your booking contract — that is agreed separately in writing when a trip is confirmed.',
      ]}
      sections={sections}
    />
  );
}
