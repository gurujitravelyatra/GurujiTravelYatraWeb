import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';

/**
 * "Our Story" band — design export `GTY Wireframe Prototype.dc.html` lines
 * 726-729 (the `isAbout` screen), product-spec §5.8.
 *
 * The eyebrow ("Our Story") and the headline are the only real copy the
 * export provides for this screen. Everything else about GTY's founding,
 * mission or history is rendered by the export as two grey `.ln` skeleton
 * bars (line 727) — literal loading-skeleton markup, not placeholder prose.
 * Product-spec §5.8 is two lines long and states no story copy either.
 * Writing a founder's note or origin story here would mean inventing brand
 * voice for a real business (BLOCKERS.md Decision H), so the skeleton is
 * replaced with an explicit, honest notice instead — same visual language as
 * `LegalPageShell`'s `PlaceholderNotice` (dashed border, "Placeholder — not
 * final" eyebrow), scoped to what's actually missing here.
 *
 * The photo panel (export line 728, `ph.rishikesh`) is a real export photo
 * slot with no confirmed image asset yet, so it renders exactly like any
 * other pending-photo slot on the site (`PackageCard`, `Hero`) — plain
 * `PhotoPlaceholder`, no dashed "obviously placeholder" border, since the
 * slot itself is real.
 */
export function AboutStory() {
  return (
    <section
      data-testid="section-about-story"
      className="flex flex-wrap items-center gap-5 bg-gty-surface-3 px-gx py-[26px]"
    >
      <div className="flex min-w-[260px] flex-1 flex-col gap-3">
        <p className="text-10 font-bold uppercase tracking-label text-gty-primary">Our Story</p>
        <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tightest text-gty-ink">
          We don&#39;t plan trips,
          <br />
          we create lifetime
          <br />
          memories.
        </h1>
        <BrandStoryPlaceholderNotice />
      </div>

      <PhotoPlaceholder photoKey="Rishikesh" alt="Rishikesh" className="h-[230px] min-w-[240px] flex-1 rounded-16" />
    </section>
  );
}

/**
 * Stands in for the export's two `.ln` skeleton bars. Same dashed-placeholder
 * treatment as `LegalPageShell`'s `PlaceholderNotice` — see that component's
 * doc comment for why the pattern exists — but placed on `bg-gty-white` for
 * contrast against this section's `bg-gty-surface-3` band (the legal shell's
 * page background is white already, so it didn't need that distinction).
 */
function BrandStoryPlaceholderNotice() {
  return (
    <div
      role="note"
      data-testid="about-story-placeholder-notice"
      className="flex max-w-[380px] flex-col gap-2 rounded-16 border-[1.5px] border-dashed border-gty-border-8 bg-gty-white p-4"
    >
      <p className="text-11 font-extrabold uppercase tracking-eyebrow-3 text-gty-primary">Placeholder — not final</p>
      <p className="text-13-5 leading-[1.6] text-gty-body">
        GTY&#39;s brand story is not yet written. The source design shows this space as two
        skeleton loading bars with no copy behind them, and no founder note, mission statement or
        company history has been provided to write from.
      </p>
    </div>
  );
}
