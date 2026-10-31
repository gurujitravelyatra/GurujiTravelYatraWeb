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
 * `.ftrred` — export lines 752-823. Red band with the wave-divider SVG and
 * the footer columns. Design review 2026-11-01: down to 3 columns (Brand,
 * Quick Links, Get In Touch) after Top Destinations/Support were removed —
 * widened (`flex-[1.6...]` vs. the original `flex-[1...]`) so they fill the
 * row evenly instead of leaving a gap where 5 narrower columns used to sit.
 */
function RedBand({ contact }: { contact: SiteContact }) {
  return (
    <div className="relative bg-gty-primary px-gx pb-7 pt-11">
      <svg
        viewBox="0 0 1400 110"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-full block h-20 w-full"
      >
        <path
          d="M0 110 L0 44 C220 -6 430 4 700 46 C960 86 1180 66 1400 22 L1400 110 Z"
          className="fill-gty-primary"
        />
      </svg>

      <div className="relative flex flex-wrap items-start gap-x-0 gap-y-[22px]">
        <div className="flex min-w-[250px] flex-[2_1_300px] flex-col gap-[14px] pr-[26px]">
          <div className="flex items-center gap-4">
            <span className="block h-[74px] w-[82px] flex-none overflow-hidden rounded-10">
              <Image
                src="/logo/gty-logo.png"
                alt="Guruji Travel Yatra"
                width={82}
                height={82}
                className="h-[82px] w-[82px] max-w-none object-cover object-[center_22%]"
              />
            </span>
            <p className="text-21 font-extrabold leading-[1.08] tracking-tiny text-gty-white">
              GURUJI
              <br />
              TRAVEL YATRA
            </p>
          </div>
          <p className="pl-[2px] text-12-5 tracking-nudge text-gty-white/95">Keep Guessing, Where&#39;s Next Trip?</p>
          <p className="max-w-[340px] text-14 leading-[1.5] text-gty-white">
            Creating journeys that touch your soul
            <br />
            and memories that last a lifetime.
          </p>
          <SocialRow instagramUrl={contact.instagramUrl} />
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
            <Link key={link.href} href={link.href} className="text-13-5 text-gty-white/95 hover:text-gty-white hover:underline">
              {link.label}
            </Link>
          ))}
        </FooterColumn>

        <div className="flex min-w-[220px] flex-[1.6_1_240px] flex-col border-l border-gty-white/26 pl-[22px]">
          <h3 className="whitespace-nowrap text-11-5 font-extrabold uppercase tracking-eyebrow-3 text-gty-white">
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
      <h3 className="whitespace-nowrap text-11-5 font-extrabold uppercase tracking-eyebrow-3 text-gty-white">{title}</h3>
      <span aria-hidden="true" className="my-[7px] mb-[14px] block h-[2px] w-[38px] bg-gty-white/50" />
      <div className="flex flex-col items-start gap-[9px]">{children}</div>
    </div>
  );
}

function ContactRow({ label, href, children }: { label: string; href?: string; children: ReactNode }) {
  const content = (
    <>
      <span className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-pill bg-gty-white text-gty-primary">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          {children}
        </svg>
      </span>
      <span className="text-13-5 text-gty-white">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-[14px] hover:underline">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-[14px]">{content}</div>
  );
}

/**
 * Instagram's `href` is passed in per-render (`contact.instagramUrl`, from
 * `GET /public/site` with a static fallback); every other handle below is
 * still unconfirmed — TODO(social-links).
 */
const OTHER_SOCIAL_LINKS = [
  {
    label: 'YouTube',
    href: '#',
    className: 'bg-[#ff0000]',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
        <path d="M9.5 8.2v7.6l6.5-3.8z" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: '#',
    className: 'bg-[#1877f2]',
    icon: (
      <span aria-hidden="true" className="font-serif-editorial text-20 font-extrabold text-gty-white">
        f
      </span>
    ),
  },
  {
    label: 'X (Twitter)',
    href: '#',
    className: 'bg-[#141414]',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff" aria-hidden="true">
        <path d="M17.6 3h3.2l-6.9 7.9L21.5 21h-5.3l-4.2-5.5L7 21H3.8l7.3-8.3L3 3h5.4l3.9 5.2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    className: 'bg-[#0a66c2]',
    icon: (
      <span aria-hidden="true" className="text-16 font-extrabold text-gty-white">
        in
      </span>
    ),
  },
] as const;

const INSTAGRAM_ICON = (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" stroke="none" />
  </svg>
);

function SocialRow({ instagramUrl }: { instagramUrl: string }) {
  const socials = [
    {
      label: 'Instagram',
      href: instagramUrl,
      className: 'bg-[linear-gradient(135deg,#f9ce34,#ee2a7b_48%,#6228d7)]',
      icon: INSTAGRAM_ICON,
    },
    ...OTHER_SOCIAL_LINKS,
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
    <div className="flex flex-wrap items-center justify-between gap-[10px] bg-gty-primary-darker px-gx py-4 text-12-5 text-gty-white/94">
      <span>© {year} Guruji Travel Yatra. All Rights Reserved.</span>
      <span className="flex items-center gap-2">
        Designed with <span className="text-17 text-[#ff6b5e]">❤</span> for travellers
      </span>
    </div>
  );
}
