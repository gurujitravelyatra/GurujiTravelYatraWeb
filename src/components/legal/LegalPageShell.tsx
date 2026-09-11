import Link from 'next/link';

import { SiteShell } from '@/components/layout/SiteShell';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalPageShellProps {
  /** e.g. "Privacy Policy" — used for the <h1>, the breadcrumb and Navbar's pageLabel. */
  title: string;
  /** The route this page lives at, for Navbar active state. */
  path: string;
  /** One or two lines under the heading, before the numbered sections. */
  intro: string[];
  sections: LegalSection[];
}

/**
 * Shared layout for the `/legal/*` policy pages. Reuses `SiteShell` (Navbar /
 * BottomContactStrip / Footer / MobileActionBar) and the same container,
 * breadcrumb and typography scale as `/tour-packages/[slug]`, so these read as
 * part of the site rather than as bare unstyled documents.
 *
 * Server Component: pure presentation, no interaction, no client bundle.
 *
 * Every page built on this shell renders `<PlaceholderNotice />` at the top.
 * That notice is NOT decoration and must not be removed by a later copy pass:
 * the body text below it is generic boilerplate written by the build, not
 * reviewed by a lawyer, and the site's enquiry forms do not yet submit
 * anywhere (`NotImplementedLeadAdapter`, BLOCKERS.md §1a / Decision A). Both
 * facts are disclosed rather than papered over.
 *
 * Deliberately NOT modelled: effective/last-updated dates, a governing-law
 * jurisdiction, a named data-protection officer, retention periods, or any
 * list of third-party processors. Each of those is a factual legal claim GTY
 * has not made yet, and inventing one is worse than omitting it.
 */
export function LegalPageShell({ title, path, intro, sections }: LegalPageShellProps) {
  return (
    <SiteShell activePath={path} pageLabel={title}>
      <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-gx py-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-[6px] text-13 text-gty-subtle">
          <Link href="/" className="transition-colors duration-gty-fast ease-gty hover:text-gty-primary">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-gty-ink-soft">
            {title}
          </span>
        </nav>

        <h1 className="text-29 font-extrabold leading-[1.15] tracking-tightest text-gty-ink 760:text-36">{title}</h1>

        <PlaceholderNotice />

        <div className="flex flex-col gap-[10px]">
          {intro.map((line) => (
            <p key={line} className="text-15 leading-[1.6] text-gty-body">
              {line}
            </p>
          ))}
        </div>

        <div className="h-px bg-gty-border-4" />

        <div className="flex flex-col gap-7">
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-[10px]">
              <h2 className="text-18 font-extrabold leading-[1.2] text-gty-ink">{section.heading}</h2>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-14 leading-[1.6] text-gty-body">
                  {paragraph}
                </p>
              ))}

              {section.bullets && (
                <ul className="flex list-disc flex-col gap-[6px] pl-5 text-14 leading-[1.6] text-gty-body">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

/**
 * The mandatory "this is not final" banner. Uses the same dashed-placeholder
 * treatment the rest of the site uses for not-yet-real content (the modal's
 * done-step box, the empty-filter state), so it reads as provisional at a
 * glance, not as fine print.
 */
function PlaceholderNotice() {
  return (
    <div
      role="note"
      data-testid="legal-placeholder-notice"
      className="flex flex-col gap-2 rounded-16 border-[1.5px] border-dashed border-gty-border-8 bg-gty-surface-3 p-4"
    >
      <p className="text-11 font-extrabold uppercase tracking-eyebrow-3 text-gty-primary">Placeholder — not final</p>
      <p className="text-13-5 leading-[1.6] text-gty-body">
        This is placeholder legal copy pending review by GTY&#39;s legal counsel — do not treat as final. It describes
        how the enquiry forms on this site are intended to work and has not been checked against Indian data-protection
        or consumer law.
      </p>
      <p className="text-13-5 leading-[1.6] text-gty-body">
        The enquiry and brochure forms are also not yet connected to a live submission service, so nothing submitted
        through them is stored or sent anywhere today.
      </p>
    </div>
  );
}
