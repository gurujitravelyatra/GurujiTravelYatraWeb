import { getPlaces, getSite } from '@/server/crm/client';
import { resolveSiteContact } from '@/lib/site-contact';
import { Navbar } from './Navbar';
import { MobileActionBar } from './MobileActionBar';
import { BottomContactStrip } from './BottomContactStrip';
import { Footer } from './Footer';

export interface SiteShellProps {
  /** e.g. "/" | "/tour-packages" — drives `Navbar`'s active-link state. */
  activePath: string;
  /** Real page/package label — the Enquire CTA's context-chip value when opened from the header/mobile bar (BLOCKERS.md Decision F). */
  pageLabel: string;
  children: React.ReactNode;
}

/**
 * Site-wide chrome shared by every route — composes the global components
 * every public page renders through.
 *
 * CRM-migration Step 2: now an async Server Component. It is the ONE place
 * that fetches `GET /public/site` and `GET /public/places` for the chrome
 * (contact info, the Footer's "Top Destinations" column) — every page
 * composing `<SiteShell>` gets them for free instead of re-fetching, and
 * every contact-info consumer (`Navbar`/`Footer`/`BottomContactStrip`/
 * `MobileActionBar`) reads the SAME resolved values, so they cannot drift
 * the way four separately-imported constants once did.
 *
 * If either CRM call fails, this throws and Next's nearest `error.tsx`
 * handles it — site-wide chrome failing closed is the right default for a
 * CRM that is now the single source of truth; there is no fixture catalogue
 * left to fall back to silently.
 *
 * DOM order matters here: `MobileActionBar` is `position: sticky; bottom: 0`
 * and relies on being the LAST element in the document flow for the "sticky
 * footer bar" trick to work — it must render after the Footer/BottomContactStrip
 * wrapper, not before it.
 */
export async function SiteShell({ activePath, pageLabel, children }: SiteShellProps) {
  const [site, places] = await Promise.all([getSite(), getPlaces()]);
  const contact = resolveSiteContact(site.settings);

  return (
    <div className="site relative w-full bg-gty-white">
      <Navbar activePath={activePath} pageLabel={pageLabel} contact={contact} />
      <main>{children}</main>
      <div className="relative">
        <BottomContactStrip contact={contact} />
        <Footer contact={contact} places={places} />
      </div>
      <MobileActionBar pageLabel={pageLabel} contact={contact} />
    </div>
  );
}
