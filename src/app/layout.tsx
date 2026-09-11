import type { Metadata, Viewport } from 'next';
import { Archivo, Caveat } from 'next/font/google';
import './globals.css';

import { ModalProvider } from '@/components/modals/modal-context';
import { EnquiryModal } from '@/components/modals/EnquiryModal';
import { BrochureModal } from '@/components/modals/BrochureModal';

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${caveat.variable}`}>
      <body>
        {/*
          Mounted once at the root (tech spec §4.3): any Server Component
          tree can open the Enquiry/Brochure modal via useModal() without
          prop-drilling. Both modal components read their own open/variant
          state from context and render null when not the active variant.
        */}
        <ModalProvider>
          {children}
          <EnquiryModal />
          <BrochureModal />
        </ModalProvider>
      </body>
    </html>
  );
}
