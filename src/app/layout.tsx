import type { Metadata, Viewport } from 'next';
import { Archivo, Caveat, Permanent_Marker, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

import { ModalProvider } from '@/components/modals/modal-context';
import { ModalHost } from '@/components/modals/ModalHost';
import { getSite } from '@/server/crm/client';
import { toSiteStatsSummary } from '@/lib/site-stats';

/**
 * Typography, per the design export's font loading:
 *   family=Caveat:wght@600;700 & family=Archivo:wght@400;600;800
 *
 * The export also uses weights 500 and 700 of Archivo in inline styles
 * (`.nav` is 500, several labels are 700), so those are requested here too.
 *
 * next/font self-hosts both families at build time - the raw <link> to
 * fonts.googleapis.com used by the prototype is intentionally NOT ported
 * (avoids a render-blocking third-party request and a FOUT).
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-caveat',
  display: 'swap',
});

/**
 * Design review 2026-11-01 — footer wordmark ("Guruji") only, per
 * Documents/GTY Logo side text.png: a bold brush-marker script, which
 * Caveat (a thinner handwriting style, already used for every OTHER script
 * accent on the site) does not match. Permanent Marker ships a single
 * weight (400) on Google Fonts, so that is all that's requested here.
 * Self-hosted via next/font/google like every other family on this site —
 * no runtime request to fonts.googleapis.com. License: SIL Open Font
 * License 1.1 (free, including commercial use) — see
 * https://fonts.google.com/specimen/Permanent+Marker/license.
 */
const permanentMarker = Permanent_Marker({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-permanent-marker',
  display: 'swap',
});

/**
 * Design review 2026-11-14 ("Redux" home-page/header/footer redesign) —
 * self-hosted via next/font/google, same as every family above. Requested
 * weight/style is a superset of the brief's "500, 600, 700, italic 500/600":
 * next/font/google generates one weight×style grid per call, and Playfair
 * Display has a real italic 700 on Google Fonts, so requesting it too (never
 * used in this round's italic headings) is simpler and cheaper than a second
 * font instance just to omit one unused italic cut. License: SIL Open Font
 * License 1.1 (free, including commercial use).
 */
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair-display',
  display: 'swap',
});

/** License: SIL Open Font License 1.1 (free, including commercial use). */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

/**
 * Base origin every relative URL in a `metadata` export resolves against —
 * required for `/tour-packages`'s `alternates.canonical` to emit a real
 * absolute canonical instead of Next's `http://localhost:3000` default.
 *
 * NOT hardcoded to a guessed production domain: no live origin for this site
 * is confirmed anywhere in the source material (the design export gives a
 * phone number and an email, not a website URL). Deployment supplies
 * `NEXT_PUBLIC_SITE_URL`; until it does, this resolves exactly as Next already
 * did, so nothing regresses and nothing is invented.
 */
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Guruji Travel Yatra — Keep Guessing, Where's Next Trip?",
    template: '%s · Guruji Travel Yatra',
  },
  description:
    'Curated spiritual yatras, group tours, customized holidays and destination experiences across India and beyond.',
  openGraph: {
    title: "Guruji Travel Yatra — Keep Guessing, Where's Next Trip?",
    description:
      'Curated spiritual yatras, group tours, customized holidays and destination experiences across India and beyond.',
    siteName: 'Guruji Travel Yatra',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#d80000',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // New brief (2026-11-15, "horizontal card"): the popup's proof pill needs
  // the real `happyTravellersLabel` CRM figure, but `ModalHost`/`LeadModal`
  // are mounted here, at the root, outside any one page's own `SiteShell`
  // call — so this is the one additional `getSite()` read needed to reach
  // them. Next's automatic fetch request memoization (separate from, and
  // unaffected by, `force-dynamic`'s Data-Cache opt-out on individual pages)
  // dedupes this against the SAME call `SiteShell`/`page.tsx` already make
  // for the very same request within one render pass — this does not add a
  // second real network round-trip per page view. Never throws either way:
  // `getSite()`'s own `withFallbackAlways()` degrades to the safe `null`
  // shape on a CRM outage, same as everywhere else that reads it.
  const site = await getSite();
  const happyTravellersLabel = toSiteStatsSummary(site.settings).happyTravellers ?? null;

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${caveat.variable} ${permanentMarker.variable} ${playfairDisplay.variable} ${plusJakartaSans.variable}`}
    >
      <body>
        {/*
          Mounted once at the root (tech spec §4.3): any Server Component
          tree can open the Enquiry/Brochure modal via useModal() without
          prop-drilling. Both modal components read their own open/variant
          state from context and render null when not the active variant.

          ModalProvider stays eagerly loaded — it is just context plus
          open/close state, and every trigger on the site calls into it. The
          modal bodies behind it are code-split by ModalHost so their
          dependency chain (react-hook-form, zod, framer-motion, Radix
          Dialog) is fetched on first open rather than on every page load.
        */}
        <ModalProvider>
          {children}
          <ModalHost happyTravellersLabel={happyTravellersLabel} />
        </ModalProvider>
      </body>
    </html>
  );
}
