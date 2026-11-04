import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
 * Design review 2026-11-01: the "Top Destinations" and "Support" columns
 * were removed completely — data and links, not just hidden. `SiteShell` no
 * longer fetches `GET /public/places` for this component at all (see its
 * own file header), and the old `SUPPORT_LINKS` array (Travel Tips,
 * Cancellation Policy, Terms & Conditions, Privacy Policy, Refund Policy) is
 * gone, not relocated — those pages remain reachable directly and via the
 * sitemap, just no longer linked from the footer. The remaining Brand /
 * Quick Links / Get In Touch columns were widened so the three-column
 * layout reads as intentional rather than leaving a gap where two columns
 * used to sit. `/legal/faqs` was never linked from here either way (it
 * stays a deliberate 404).
 *
 * Composition note: this does NOT render `<BottomContactStrip />` — see that
 * component's file header for the exact wiring contract it needs from
 * whatever renders both (root layout / page, out of scope in this pass).
 */
export function Footer({ contact }: FooterProps) {
  return (
    <footer className="relative overflow-hidden bg-gty-white">
      <MountainBand />
      <RedBand contact={contact} />
      <CopyrightBar />
    </footer>
  );
}

/** `.ftband` — export lines 744-749. Decorative mountain art, copied verbatim (not photography, no CMS dependency). */
function MountainBand() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[150px] overflow-hidden bg-[linear-gradient(180deg,#fafbfb_0%,#eceef0_100%)] 1300:h-[210px]"
    >
      <svg
        viewBox="0 0 1400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-50 860:opacity-100"
      >
        <path d="M0 260 L120 150 L210 205 L300 130 L420 260 Z" fill="#d3d7db" opacity="0.55" />
        <path d="M180 260 L300 118 L400 180 L470 138 L560 260 Z" fill="#c3c8cd" opacity="0.5" />
        <path d="M270 128 L300 112 L332 130 L316 134 L300 124 L286 134 Z" fill="#fff" />
        <path d="M900 260 L1010 140 L1090 196 L1180 120 L1290 260 Z" fill="#cfd3d7" opacity="0.5" />
        <path d="M1120 260 L1230 130 L1330 194 L1400 150 L1400 260 Z" fill="#c3c8cd" opacity="0.45" />
        <path d="M1200 140 L1230 124 L1262 142 L1246 146 L1230 136 L1216 146 Z" fill="#fff" />
        <path d="M300 62 q8 -7 16 0 q-8 -3 -16 0" fill="#9aa1a6" opacity="0.55" />
        <path d="M338 48 q8 -7 16 0 q-8 -3 -16 0" fill="#9aa1a6" opacity="0.55" />
        <path d="M362 68 q7 -6 14 0 q-7 -3 -14 0" fill="#9aa1a6" opacity="0.55" />
        <path d="M478 86 q7 -6 14 0 q-7 -3 -14 0" fill="#9aa1a6" opacity="0.5" />
      </svg>
      <svg viewBox="0 0 300 130" className="absolute right-[150px] top-6 h-20 w-[180px] opacity-50 860:opacity-100">
        <path d="M212 34 L232 50 L262 40 L242 58 L260 78 L232 70 L212 86 L216 60 Z" fill="#8f979d" opacity="0.75" />
        <path
          d="M6 118 C42 122 72 108 92 92 C118 70 148 62 180 66 C198 68 206 62 212 56"
          fill="none"
          stroke="#a8b0b6"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="1 8"
        />
      </svg>
      <p className="pointer-events-none absolute left-4 top-[14px] rotate-[-4deg] text-center font-script text-27 leading-[1.02] text-[#55595e] max-1300:hidden">
        Journeys
        <br />
        That Stay
        <br />
        Forever
        <span className="mx-auto mt-[5px] block h-[2px] w-[54px] rounded-[2px] bg-gty-primary" />
      </p>
      <p className="pointer-events-none absolute right-4 top-3 rotate-[-4deg] text-center font-script text-27 leading-[1.02] text-[#55595e] max-1300:hidden">
        Explore
        <br />
        Plan
        <br />
        Travel
        <br />
        Repeat
        <span className="mx-auto mt-[5px] block h-[2px] w-[54px] rounded-[2px] bg-gty-primary" />
      </p>
      <p className="pointer-events-none absolute right-[104px] top-[150px] rotate-[-6deg] font-script text-22 leading-[1.05] text-gty-primary">
        We&#39;re here
        <br />
        for you!
      </p>
    </div>
  );
}

/**
 * Faint pine-forest + mountain silhouette along the red band's bottom edge —
 * design review 2026-11-04, matching `Documents/Footer Reference.png`'s
 * "deep red mountain and forest" background. Sits behind the column content
 * (z-0, columns are `relative`), tinted with the band's own deep stop so it
 * reads as part of the gradient rather than a separate flat graphic.
 * Decorative only: `aria-hidden`, `pointer-events-none`.
 */
function ForestSilhouette() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1400 170"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[90px] w-full text-gty-footer-deep/55 860:h-[130px]"
    >
      <path d="M0 170 L90 70 L170 120 L260 50 L360 170Z" fill="currentColor" opacity="0.6" />
      <path d="M1040 170 L1140 60 L1230 118 L1340 40 L1400 90 L1400 170Z" fill="currentColor" opacity="0.6" />
      <path d="M0 170 L1400 170 L1400 150 C1150 110 1000 160 820 140 C600 115 420 160 220 140 C130 128 60 150 0 150 Z" fill="currentColor" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 40 + i * 44;
        return (
          <path
            key={i}
            d={`M${x} 170 L${x + 11} 128 L${x + 7} 128 L${x + 17} 96 L${x + 13} 96 L${x + 24} 66 L${x + 35} 96 L${x + 31} 96 L${x + 41} 128 L${x + 37} 128 L${x + 48} 170 Z`}
            fill="currentColor"
            opacity="0.5"
          />
        );
      })}
      {Array.from({ length: 7 }, (_, i) => {
        const x = 1000 + i * 44;
        return (
          <path
            key={i}
            d={`M${x} 170 L${x + 11} 128 L${x + 7} 128 L${x + 17} 96 L${x + 13} 96 L${x + 24} 66 L${x + 35} 96 L${x + 31} 96 L${x + 41} 128 L${x + 37} 128 L${x + 48} 170 Z`}
            fill="currentColor"
            opacity="0.5"
          />
        );
      })}
    </svg>
  );
}

/** Dashed flight trail + airplane + two birds, top-right of the red band — matches the reference image's corner motif. Decorative, `aria-hidden`. */
function FooterFlightPath() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 120"
      className="pointer-events-none absolute right-6 top-4 z-0 h-16 w-36 text-gty-white/30 860:h-20 860:w-44"
    >
      <path
        d="M4 70 C50 84 90 56 118 36 C140 20 170 8 210 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path d="M202 2 L224 0 L232 10 L214 13 L219 24 L208 22 L200 13 L186 16 L189 9 Z" fill="currentColor" />
      <path d="M30 36 q8 -8 16 0 q-8 -4 -16 0" fill="currentColor" opacity="0.8" />
      <path d="M64 50 q7 -7 14 0 q-7 -3 -14 0" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/**
 * `.ftrred` — export lines 752-823. Red band with the wave-divider SVG and
 * the footer columns. Design review 2026-11-01: down to 3 columns (Brand,
 * Quick Links, Get In Touch) after Top Destinations/Support were removed —
 * widened (`flex-[1.6...]` vs. the original `flex-[1...]`) so they fill the
 * row evenly instead of leaving a gap where 5 narrower columns used to sit.
 * Design review 2026-11-04: added `ForestSilhouette`/`FooterFlightPath`
 * (both `z-0`, behind the `relative` column content) and extra bottom
 * padding on mobile so `MobileActionBar`'s sticky bar never sits flush
 * against the last line of copy. Also fixed a pre-existing <1080px wrap bug:
 * "Get In Touch" had no <1080px override (unlike `FooterColumn`, which
 * already switched to `flex-[1_1_44%]` there), so at exactly the brief's own
 * 768/1024px check widths it wrapped onto an orphaned row under Brand
 * instead of sitting evenly next to Quick Links — giving "Get In Touch" the
 * same `max-1080:flex-[1_1_44%]` only moved the orphan (Brand + Quick Links
 * still fit on one row together below 1080px, pushing Get In Touch alone
 * onto its own row regardless). Brand now also switches to full width below
 * 1080px, so the tablet layout is a clean "Brand full-width, Quick Links +
 * Get In Touch as two even columns underneath" instead of an uneven wrap.
 */
function RedBand({ contact }: { contact: SiteContact }) {
  return (
    <div
      className="relative overflow-hidden px-gx pb-7 pt-11"
      style={{
        background:
          'linear-gradient(180deg, var(--color-gty-footer-glow) 0%, var(--color-gty-footer-mid) 55%, var(--color-gty-footer-deep) 100%)',
      }}
    >
      <svg
        viewBox="0 0 1400 110"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-full block h-20 w-full"
      >
        <path
          d="M0 110 L0 44 C220 -6 430 4 700 46 C960 86 1180 66 1400 22 L1400 110 Z"
          className="fill-gty-footer-glow"
        />
      </svg>

      <ForestSilhouette />
      <FooterFlightPath />

      <div className="relative z-10 flex flex-wrap items-start gap-x-0 gap-y-[22px]">
        <div className="flex min-w-[250px] flex-[2_1_300px] flex-col gap-[14px] pr-[26px] max-1080:flex-[1_1_100%] max-1080:pr-0">
          <div className="flex items-center gap-4">
            <span className="block h-[74px] w-[82px] flex-none">
              <Image
                src="/logo/gty-logo-mark.webp"
                alt="Guruji Travel Yatra"
                width={82}
                height={82}
                className="h-[82px] w-[82px] object-contain"
              />
            </span>
            <p className="leading-[1.05] text-gty-white">
              <span className="block font-marker text-27 leading-[1.1] tracking-wide">Guruji</span>
              <span className="block text-15 font-extrabold tracking-wider">TRAVEL YATRA</span>
            </p>
          </div>
          <p className="pl-[2px] text-13-5 leading-[1.4] tracking-nudge text-gty-white">Keep Guessing, Where&#39;s Next Trip?</p>
          <p className="max-w-[340px] text-14-5 leading-[1.55] text-gty-white">
            Creating journeys that touch your soul
            <br />
            and memories that last a lifetime.
          </p>
          <SocialRow instagramUrl={contact.instagramUrl} whatsappUrl={contact.whatsappUrl} />
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-script text-24 rotate-[-4deg] text-gty-white">
              Follow Our Journey
            </span>
            <span aria-hidden="true" className="flex-none rotate-[-32deg] text-21 text-gty-white">
              ↗
            </span>
          </div>
        </div>

        <FooterColumn title="Quick Links" widthClassName="flex-[1.6_1_220px]">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-block py-[3px] text-14-5 text-gty-white hover:underline 860:py-0"
            >
              {link.label}
            </Link>
          ))}
        </FooterColumn>

        <div className="flex min-w-[220px] flex-[1.6_1_240px] flex-col border-l border-gty-white/26 pl-[22px] max-1080:min-w-[180px] max-1080:flex-[1_1_44%] max-1080:border-l-0 max-1080:pl-0">
          <h3 className="whitespace-nowrap text-12 font-extrabold uppercase tracking-eyebrow-3 text-gty-white">
            Get In Touch
          </h3>
          <span aria-hidden="true" className="my-[7px] mb-4 block h-[2px] w-[38px] bg-gty-white/50" />
          <div className="flex flex-col items-start gap-[13px]">
            <ContactRow label={contact.phoneDisplay} href={`tel:${contact.phoneTel}`}>
              <path d="M6.6 10.8c1.1 2.2 2.9 4 5.1 5.1l1.7-1.7c.2-.2.5-.3.8-.2 1 .3 2 .5 3.1.5.4 0 .8.3.8.8V18c0 .4-.3.8-.8.8C9.6 18.8 5.2 14.4 5.2 7.5c0-.4.3-.8.8-.8h2.7c.4 0 .8.3.8.8 0 1.1.2 2.1.5 3.1.1.3 0 .6-.2.8z" />
            </ContactRow>
            <ContactRow label={contact.email} href={`mailto:${contact.email}`}>
              <path d="M3 5h18a1 1 0 0 1 1 1v.4l-10 6.1L2 6.4V6a1 1 0 0 1 1-1zm-1 3.9 10 6.1 10-6.1V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
            </ContactRow>
            <ContactRow label={contact.address}>
              <path d="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
            </ContactRow>
          </div>
          <p className="mt-5 origin-top-left rotate-[-5deg] font-script text-25 leading-[1.05] text-gty-white">
            Good
            <br />
            Trips
            <br />
            Brighter
            <br />
            Lives
          </p>
        </div>
      </div>
    </div>
  );
}

function FooterColumn({
  title,
  children,
  widthClassName = 'flex-[1_1_140px]',
}: {
  title: string;
  children: ReactNode;
  /** Overrides the default flex-basis so columns can be rebalanced when the footer has fewer of them. */
  widthClassName?: string;
}) {
  return (
    <div className={`flex min-w-[132px] ${widthClassName} flex-col border-l border-gty-white/26 pl-[22px] max-1080:min-w-[180px] max-1080:flex-[1_1_44%] max-1080:border-l-0 max-1080:pl-0`}>
      <h3 className="whitespace-nowrap text-12 font-extrabold uppercase tracking-eyebrow-3 text-gty-white">{title}</h3>
      <span aria-hidden="true" className="my-[7px] mb-[14px] block h-[2px] w-[38px] bg-gty-white/50" />
      <div className="flex flex-col items-start gap-[11px]">{children}</div>
    </div>
  );
}

function ContactRow({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  const content = (
    <>
      <span className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-pill bg-gty-white text-gty-primary">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          {children}
        </svg>
      </span>
      <span className="text-14-5 leading-[1.4] text-gty-white">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-[14px] py-[3px] hover:underline 860:py-0">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-[14px] py-[3px] 860:py-0">{content}</div>
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
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" stroke="none" />
  </svg>
);

const WHATSAPP_ICON = (
  <svg viewBox="0 0 32 32" width="21" height="21" fill="#fff" aria-hidden="true">
    <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
  </svg>
);

function SocialRow({ instagramUrl, whatsappUrl }: { instagramUrl: string; whatsappUrl: string }) {
  const socials = [
    {
      label: 'Instagram',
      href: instagramUrl,
      className: 'bg-[linear-gradient(135deg,#f9ce34,#ee2a7b_48%,#6228d7)]',
      icon: INSTAGRAM_ICON,
    },
    {
      label: 'WhatsApp',
      href: whatsappUrl,
      className: 'bg-gty-whatsapp',
      icon: WHATSAPP_ICON,
    },
  ];

  return (
    <div className="flex flex-nowrap gap-[10px] pt-[2px]">
      {socials.map((social) => {
        // Only a confirmed profile is a real outbound link; the unconfirmed
        // `#` stubs must not open a blank tab.
        const href = social.href;
        const isExternal = href.startsWith('http');
        return (
          <a
            key={social.label}
            href={href}
            aria-label={social.label}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className={`flex h-[46px] w-[46px] flex-none items-center justify-center rounded-pill shadow-gty-ring ${social.className}`}
          >
            {social.icon}
          </a>
        );
      })}
    </div>
  );
}

/**
 * `.r` copyright bar — export lines 825-828. The year is computed, never
 * hardcoded as the export's literal `2026` was.
 *
 * `Footer` is a Server Component and every route here is statically
 * prerendered, so this resolves at build time: the year is correct as of each
 * deploy rather than as of whenever someone last edited this file. A site
 * that is not rebuilt for over a year would still show the build's year —
 * accepted deliberately, because the alternatives (forcing these pages
 * dynamic, or computing the year on the client) cost either static rendering
 * or a hydration mismatch for a single line of chrome.
 */
function CopyrightBar() {
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] bg-gty-footer-deep px-gx py-4 pb-[62px] text-13-5 text-gty-white 760:pb-4">
      <span>© {year} Guruji Travel Yatra. All Rights Reserved.</span>
      <span className="flex items-center gap-2">
        Designed with <span className="text-17 text-[#ff6b5e]">❤</span> for travellers
      </span>
    </div>
  );
}
