import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';

import type { SiteContact } from '@/lib/site-contact';

export interface FooterProps {
  /** Resolved by `SiteShell` from `GET /public/site` (with a static fallback) — see `resolveSiteContact`. */
  contact: SiteContact;
}

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Tour Packages', href: '/tour-packages' },
  { label: 'Group Tours', href: '/group-tours' },
  { label: 'Customized Tours', href: '/customize-tours' },
  { label: 'About Us', href: '/about-us' },
] as const;

/**
 * `.ftrwrap`/`.ftr` — export lines 742-829, tech spec §4.3. Server
 * component: pure presentation, no interaction.
 *
 * "Redux" redesign (brief §11, 2026-11-14) — full visual replacement:
 * `bg-gradient-to-b from-crimson-deep to-[#5E0C0F]` single band (the old
 * light-gray `MountainBand` + sunset-gradient `RedBand` two-band structure
 * is gone), a dotted flight path + plane in place of the old
 * forest/mountain silhouette, and a 3-column `grid-cols-[1.3fr_0.8fr_1.2fr]`
 * layout instead of flex-wrap + per-breakpoint basis overrides.
 *
 * Still true from the 2026-11-01/04 rounds, unchanged by this pass:
 * - "Top Destinations"/"Support" columns stay removed entirely (data and
 *   links, not just hidden) — `Footer` still takes no `places` prop.
 * - `/legal/faqs` stays unlinked from here (a deliberate 404).
 * - Only Instagram and WhatsApp social links render — the only two the
 *   business actually uses, both resolving to a real URL via
 *   `resolveSiteContact`.
 *
 * Composition note: the WhatsApp contact box (`WhatsAppCtaSection`) is a
 * separate section `SiteShell` renders directly above this footer.
 */
export function Footer({ contact }: FooterProps) {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-redux-crimson-deep to-[#5e0c0f] text-white">
      <FooterDecor />

      <div className="relative mx-auto grid max-w-[1320px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.3fr_0.8fr_1.2fr] lg:px-10">
        <div>
          <Link href="/" className="flex items-center gap-[11px]">
            <span className="block h-[58px] w-[58px] flex-none">
              <Image src="/logo/gty-logo-mark.webp" alt="Guruji Travel Yatra" width={58} height={58} className="h-[58px] w-[58px] object-contain" />
            </span>
            <p className="leading-[1.05] text-white">
              <span className="block font-marker text-22 leading-[1.1] tracking-wide">Guruji</span>
              <span className="block text-13 font-extrabold tracking-wider">TRAVEL YATRA</span>
            </p>
          </Link>
          <p className="mt-5 font-redux-display text-xl italic text-red-200">Keep Guessing, Where&#39;s Next Trip?</p>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/70">
            Creating journeys that touch your soul and memories that last a lifetime.
          </p>
          <SocialRow instagramUrl={contact.instagramUrl} whatsappUrl={contact.whatsappUrl} />
          <a
            href={contact.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white"
          >
            Follow Our Journey
          </a>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Quick Links</h3>
          <ul className="mt-5 space-y-3">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="group inline-flex items-center gap-0 text-[15px] font-medium text-white/85 transition-all duration-300 hover:gap-2 hover:text-white">
                  <span aria-hidden="true" className="h-px w-0 bg-red-300 transition-all duration-300 group-hover:w-4" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 font-redux-display text-2xl italic leading-snug text-red-200">
            Good Trips,
            <br />
            Brighter Lives
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">Get In Touch</h3>
          <ul className="mt-5 space-y-4">
            <ContactRow label={contact.phoneDisplay} href={`tel:${contact.phoneTel}`}>
              <path d="M6.6 10.8c1.1 2.2 2.9 4 5.1 5.1l1.7-1.7c.2-.2.5-.3.8-.2 1 .3 2 .5 3.1.5.4 0 .8.3.8.8V18c0 .4-.3.8-.8.8C9.6 18.8 5.2 14.4 5.2 7.5c0-.4.3-.8.8-.8h2.7c.4 0 .8.3.8.8 0 1.1.2 2.1.5 3.1.1.3 0 .6-.2.8z" />
            </ContactRow>
            <ContactRow label={contact.email} href={`mailto:${contact.email}`}>
              <path d="M3 5h18a1 1 0 0 1 1 1v.4l-10 6.1L2 6.4V6a1 1 0 0 1 1-1zm-1 3.9 10 6.1 10-6.1V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
            </ContactRow>
            <ContactRow
              label={contact.address}
              href={contact.addressMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Open our office location in Google Maps"
            >
              <path d="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
            </ContactRow>
          </ul>
        </div>
      </div>

      <CopyrightBar />
    </footer>
  );
}

/** Dotted flight path + small plane, top-right — the brief's own footer corner motif. Decorative, `aria-hidden`. */
function FooterDecor() {
  return (
    <svg aria-hidden="true" viewBox="0 0 420 300" className="pointer-events-none absolute right-0 top-0 w-[420px] text-white/10">
      <path
        d="M410 60C320 40 240 70 210 130 182 186 110 210 10 190"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="1 9"
        strokeLinecap="round"
      />
      <path d="M392 38 L414 36 L420 46 L402 49 L407 60 L396 58 L388 49 L374 52 L377 45 Z" fill="currentColor" />
    </svg>
  );
}

function ContactRow({
  label,
  href,
  target,
  rel,
  ariaLabel,
  children,
}: {
  label: string;
  href?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" className="text-white">
          {children}
        </svg>
      </span>
      <span className="pt-2 text-[15px] font-medium text-white/85">{label}</span>
    </>
  );
  return (
    <li className="group flex items-start gap-3.5">
      {href ? (
        <a href={href} target={target} rel={rel} aria-label={ariaLabel} className="group flex items-start gap-3.5 hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
    </li>
  );
}

/**
 * Design review 2026-11-04: YouTube, X (Twitter) and LinkedIn were removed
 * completely — imports, config and all — because none of them were ever
 * real links (every one pointed at a bare `#` stub; see the removed
 * `TODO(social-links)` this file used to carry). Facebook was never backed
 * by a CRM field either, so it goes too. Instagram (`contact.instagramUrl`)
 * and WhatsApp (`contact.whatsappUrl`) are the only two the business
 * actually uses, and both already resolve to a real URL via
 * `resolveSiteContact` (CRM value, falling back to the confirmed
 * `gty-contact` constant) — nothing invented.
 */
const INSTAGRAM_ICON = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" stroke="none" />
  </svg>
);

const WHATSAPP_ICON = (
  <svg viewBox="0 0 32 32" width="19" height="19" fill="#fff" aria-hidden="true">
    <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
  </svg>
);

function SocialRow({ instagramUrl, whatsappUrl }: { instagramUrl: string; whatsappUrl: string }) {
  const socials = [
    { label: 'Instagram', href: instagramUrl, icon: INSTAGRAM_ICON },
    { label: 'WhatsApp', href: whatsappUrl, icon: WHATSAPP_ICON },
  ];

  return (
    <div className="mt-6 flex items-center gap-3">
      {socials.map((social) => (
        <a
          key={social.label}
          href={social.href}
          aria-label={social.label}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/20"
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
}

/**
 * `.r` copyright bar — export lines 825-828. The year is computed, never
 * hardcoded.
 *
 * `Footer` is a Server Component and every route here is statically
 * prerendered, so this resolves at build time: the year is correct as of each
 * deploy rather than as of whenever someone last edited this file.
 *
 * Mobile-only bottom padding (design review 2026-11-04) so `MobileActionBar`'s
 * sticky bar never sits flush against the last line of copy.
 */
function CopyrightBar() {
  const year = new Date().getFullYear();

  return (
    <div className="relative border-t border-white/15">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-6 pb-[70px] text-[13px] text-white/60 sm:px-6 sm:pb-6 lg:px-10">
        <span>© {year} Guruji Travel Yatra. All Rights Reserved.</span>
        <span className="flex items-center gap-2">
          Designed with <Heart size={13} className="fill-red-300 text-red-300" /> for travellers
        </span>
      </div>
    </div>
  );
}
