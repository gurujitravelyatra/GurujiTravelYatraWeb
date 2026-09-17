import type { Metadata } from 'next';

import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Guruji Travel Yatra handles the name, mobile number and email address you share through an enquiry or brochure request.',
  // Placeholder copy pending legal review — keep it out of search results
  // until the reviewed version replaces it.
  robots: { index: false, follow: true },
};

const GTY_EMAIL = 'info@gurujitravelyatra.com';
const GTY_PHONE_DISPLAY = '+91 90999 57658';
const GTY_ADDRESS = 'Ahmedabad, Gujarat, India';

/**
 * `/legal/privacy-policy` — the route `Footer`'s Support column already links
 * to (it used to 404 while the Enquiry/Brochure modals collected name, mobile
 * and email, which is the gap this page closes).
 *
 * Scope discipline: every clause below describes something the site visibly
 * does — the three fields the forms mark required/optional, and follow-up
 * contact by the GTY team. Nothing here names an analytics vendor, a CRM, a
 * cookie category or a retention window, because none of those exists in the
 * codebase yet. Sections are standard placeholder structure, clearly marked.
 */
const sections: LegalSection[] = [
  {
    heading: '1. Information We Collect',
    paragraphs: [
      // The original sentence ended "...and there is no login area on this
      // website." That became FALSE on 2026-09-17, when /admin/login shipped
      // (memory/project_gty_admin_reversal.md). This page is a legal statement
      // shown to real visitors, so a claim it makes has to stay true — and the
      // claim a visitor actually cares about (they are never asked to register)
      // still is. The staff area is named rather than omitted, because silently
      // dropping the sentence would leave the page quietly incomplete instead of
      // quietly wrong.
      'We collect information you choose to give us when you submit an enquiry or request a brochure on this site. We do not ask you to create an account, and there is nothing on this website for you to sign in to. The staff area used by our team to update tour listings is not part of your visit and collects nothing from you.',
    ],
    bullets: [
      'Name and mobile number — required, so that we can reach you about your enquiry.',
      'Email address — optional, used if you would rather we write to you.',
      'Trip details you choose to add — travel date, number of travellers, your city, and any message you write.',
      'The page you were on when you submitted the form, so we know which journey you were asking about.',
    ],
  },
  {
    heading: '2. How We Use Your Information',
    paragraphs: [
      'We use what you share to respond to you and to plan the trip you asked about. In practice that means one of our travel consultants contacting you to discuss dates, itinerary options and pricing.',
    ],
    bullets: [
      'To reply to your enquiry by phone, WhatsApp or email.',
      'To prepare an itinerary or quotation for the journey you asked about.',
      'To send the brochure or travel information you requested.',
      'To keep a record of our conversation with you so a colleague can pick it up if your consultant is unavailable.',
    ],
  },
  {
    heading: '3. What We Do Not Do',
    bullets: [
      'We do not sell your personal information.',
      'We do not share it with other travellers or publish it on this site.',
      'We do not use it for unrelated marketing without asking you first.',
    ],
  },
  {
    heading: '4. Sharing With Others',
    paragraphs: [
      'To actually deliver a trip, some details may need to be passed to the people providing it — for example hotels, transport operators or a local guide. Where that is needed, we share only what the booking requires.',
      'We may also disclose information if the law requires it, or to protect the safety of travellers on a journey.',
    ],
  },
  {
    heading: '5. Keeping Your Information',
    paragraphs: [
      'We keep enquiry details for as long as we are in touch with you about a trip, and for a reasonable period afterwards so we can help with follow-up questions or a repeat booking.',
      'A specific retention period will be stated here once this policy has been reviewed.',
    ],
  },
  {
    heading: '6. Your Choices',
    paragraphs: [
      'You can ask us at any time to tell you what enquiry details we hold about you, to correct them, or to stop contacting you. Use the contact details below and we will action the request.',
    ],
  },
  {
    heading: '7. Children',
    paragraphs: [
      'This site is intended for adults planning travel. We do not knowingly collect information directly from children. Where a child travels as part of a family booking, their details reach us from the adult making that booking.',
    ],
  },
  {
    heading: '8. Changes To This Policy',
    paragraphs: [
      'This page will be updated when the reviewed version of this policy is issued. Any material change will be reflected here.',
    ],
  },
  {
    heading: '9. Contact Us',
    paragraphs: ['If you have a question about this policy or about information you have shared with us, contact:'],
    bullets: [
      `Email: ${GTY_EMAIL}`,
      `Phone: ${GTY_PHONE_DISPLAY}`,
      `Guruji Travel Yatra, ${GTY_ADDRESS}`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      path="/legal/privacy-policy"
      intro={[
        'Guruji Travel Yatra (“GTY”, “we”, “us”) helps travellers plan and book journeys. This policy explains what we do with the details you share through the enquiry and brochure forms on this website.',
      ]}
      sections={sections}
    />
  );
}
