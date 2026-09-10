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
 * Site-wide chrome shared by every in-scope route (`/`, `/tour-packages`,
 * `/tour-packages/[slug]`) — composes the global components tech spec §4.3
 * built in part 1. Deliberately NOT hoisted into `src/app/layout.tsx`:
 * `Navbar` needs an explicit `activePath`/`pageLabel` per route (no
 * `usePathname()`, per its own file header), and a server root layout has
 * no reliable way to compute those for every child route without doing so
 * itself. Each page composes `<SiteShell>` with its own real values instead.
 *
 * DOM order matters here: `MobileActionBar` is `position: sticky; bottom: 0`
 * (export lines 864-870) and relies on being the LAST element in the
 * document flow for the "sticky footer bar" trick to work — it must render
 * after the Footer/BottomContactStrip wrapper, not before it.
 */
export function SiteShell({ activePath, pageLabel, children }: SiteShellProps) {
  return (
    <div className="site relative w-full bg-gty-white">
      <Navbar activePath={activePath} pageLabel={pageLabel} />
      <main>{children}</main>
      <div className="relative">
        <BottomContactStrip />
        <Footer />
      </div>
      <MobileActionBar pageLabel={pageLabel} />
    </div>
  );
}
