/**
 * @jest-environment node
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * H2 — ADMIN COPY THAT DESCRIBES A PHASE THAT HAS SHIPPED.
 *
 * The dashboard told the admin, in Phase A's words and for two phases after
 * they stopped being true, that "Image and brochure uploads are the next phase",
 * that the fields "are disabled", and that "nothing selected in them is stored".
 * Uploads shipped in Phase C. The tour list carried the matching claim in a
 * comment — "No cover images exist yet — uploads are Phase C" — above a
 * hard-coded emoji where the real thumbnail should have been.
 *
 * Nothing caught either one, and nothing could have: `tsc` does not read prose,
 * and no test asserts on a sentence nobody thought to assert on. That is the
 * whole of `memory/feedback_qg_stale-invariant-after-fix` — "a comment that
 * describes behaviour is a test that never runs".
 *
 * ## So this IS that test, and it is deliberately a source scan
 *
 * The property is universal over the admin surface, and the failure being
 * guarded against is a sentence in a file nobody wrote a test for. A rendering
 * test can only cover the screens someone remembered. This walks every file.
 *
 * ## What it can and cannot do
 *
 * It catches the EXACT claims that were found stale, plus the phase-name
 * vocabulary ("Phase C") that is the tell-tale for this class. It cannot catch
 * a new false sentence phrased differently, and pretending otherwise would be
 * its own kind of dishonesty — the general fix is the one applied to the
 * dashboard panel itself, which now DERIVES its claim from
 * `isCloudinaryConfigured()` instead of asserting one.
 */

const ADMIN_APP_ROOT = join(__dirname, '..');
const ADMIN_COMPONENT_ROOT = join(__dirname, '..', '..', '..', 'components', 'admin');

/**
 * Each pattern is a claim that was TRUE when written and is FALSE now, or the
 * vocabulary that produces such claims. Keyed by what went wrong, so a failure
 * names the defect rather than the regex.
 */
const STALE_CLAIMS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /uploads? (?:are|is) the next phase/i,
    why: 'Uploads shipped in Phase C. They are not "the next phase".',
  },
  {
    pattern: /nothing selected in them is stored/i,
    why: 'Uploads store to Cloudinary and to the tour row. This was Phase A/B copy.',
  },
  {
    pattern: /Phase [A-E]\b/,
    why:
      'Phase names are build-time vocabulary and mean nothing to an admin. They also date the copy, ' +
      'which is how it goes stale without anyone noticing. Describe the current state, or derive it.',
  },
  {
    pattern: /no cover images exist/i,
    why: 'Cover images exist and are rendered — the list shows the real thumbnail.',
  },
  {
    pattern: /not built yet/i,
    why:
      'The dashboard said this about uploads for two phases after they were built. If something really ' +
      'is unbuilt, say what it is and why, and expect to have to delete it.',
  },
];

/**
 * Source with COMMENTS REMOVED — i.e. roughly what an admin can read on screen.
 *
 * The distinction is load-bearing, not a convenience. A comment that says
 * *"this panel used to claim uploads were the next phase, and that was the
 * bug"* is the record of the fix and must survive; the same words in rendered
 * copy are the bug. Scanning raw source cannot tell those apart and would force
 * every explanation of this defect to be written in euphemism — which is how a
 * project loses the ability to describe its own history.
 *
 * Block comments go first, which also removes JSX comments (`{/* … *\/}`) since
 * those are block comments wearing braces. Line comments are only stripped when
 * `//` starts the line, so a `https://` inside a rendered string is untouched.
 */
function visibleCopy(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

function sourceFiles(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // The scan is about copy shipped to an admin. Test files talk ABOUT the
      // stale strings (this one quotes all of them), so they are excluded —
      // otherwise this file fails itself, which would be a memorable but
      // useless result.
      if (entry.name === '__tests__') continue;
      sourceFiles(path, collected);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      collected.push(path);
    }
  }
  return collected;
}

describe('no admin screen carries copy from a phase that has shipped', () => {
  const files = [...sourceFiles(ADMIN_APP_ROOT), ...sourceFiles(ADMIN_COMPONENT_ROOT)];

  it('finds the admin sources at all', () => {
    /**
     * GUARD THE GUARD, with a literal floor — `feedback_qg_vacuous-guard-test`
     * discipline 2. A walk that returned [] would make every assertion below
     * pass while checking nothing, and it would do so silently the first time
     * someone moves a directory.
     */
    expect(files.length).toBeGreaterThan(10);

    const names = files.map((path) => relative(ADMIN_APP_ROOT, path).split(sep).join('/'));
    expect(names).toEqual(
      expect.arrayContaining(['page.tsx', 'tours/page.tsx', 'tours/[id]/edit/page.tsx'])
    );
  });

  it.each(STALE_CLAIMS.map((claim) => [claim.pattern.source, claim] as const))(
    'no file matches /%s/',
    (_source, claim) => {
      const offenders = files
        .filter((path) => claim.pattern.test(visibleCopy(readFileSync(path, 'utf8'))))
        .map((path) => relative(ADMIN_APP_ROOT, path).split(sep).join('/'));

      expect({ why: claim.why, offenders }).toEqual({ why: claim.why, offenders: [] });
    }
  );

  it('can actually fail, and strips only comments', () => {
    /**
     * Proves the scan reads real file contents rather than reporting on an
     * empty set — the defect this whole file exists to catch, applied to
     * itself — and proves `visibleCopy` is not so aggressive that it would
     * swallow the rendered copy along with the comments.
     */
    const dashboard = visibleCopy(readFileSync(join(ADMIN_APP_ROOT, 'page.tsx'), 'utf8'));

    expect(dashboard.length).toBeGreaterThan(500);
    // Rendered copy survives stripping...
    expect(dashboard).toContain('Guruji Travel Yatra');
    // ...and a planted stale sentence in rendered position is still caught.
    expect(/uploads? (?:are|is) the next phase/i.test(visibleCopy('<p>Uploads are the next phase.</p>'))).toBe(
      true
    );
    // ...while the same sentence inside a comment is not.
    expect(
      /uploads? (?:are|is) the next phase/i.test(visibleCopy('/* Uploads are the next phase. */'))
    ).toBe(false);
  });
});

describe('the dashboard describes uploads by asking, not by asserting', () => {
  it('reads isCloudinaryConfigured rather than hard-coding a state', () => {
    /**
     * The structural half of the fix. The copy tests above forbid the specific
     * sentences that went stale; this one requires the mechanism that stops the
     * NEXT sentence going stale — a panel whose claim is derived from the
     * environment cannot drift from it.
     */
    const dashboard = readFileSync(join(ADMIN_APP_ROOT, 'page.tsx'), 'utf8');

    expect(dashboard).toContain('isCloudinaryConfigured');
    // And it names the consequence an admin will otherwise hit head-first.
    expect(dashboard).toContain('cover image is required to publish');
  });

  it('the tour list renders the real cover thumbnail', () => {
    const list = readFileSync(join(ADMIN_APP_ROOT, 'tours', 'page.tsx'), 'utf8');

    // Routed through the same component every public card uses, so the admin
    // sees what a visitor would rather than a proxy for it.
    expect(list).toContain('PhotoPlaceholder');
    expect(list).toContain('coverImageUrl');
  });
});
