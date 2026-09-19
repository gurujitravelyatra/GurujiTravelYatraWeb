/**
 * @jest-environment node
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * NO RAW HTML RENDERING, ANYWHERE IN `src/` — Phase D.
 *
 * ## Why this blunt test exists alongside the nuanced one
 *
 * `src/app/tour-packages/__tests__/stored-xss-render.test.tsx` proves that the
 * pages which exist TODAY render admin-authored text inertly. It cannot prove
 * anything about the page somebody adds next month.
 *
 * This one can, because it asserts the property that makes React safe in the
 * first place. React escapes every string it renders as a child; the ONLY way to
 * opt out is `dangerouslySetInnerHTML`. So "this repository contains no
 * `dangerouslySetInnerHTML`" is equivalent to "no string in this repository is
 * rendered as markup", and that is a single, checkable fact rather than a
 * property that has to be re-established per component.
 *
 * The audit this test was written from found ZERO occurrences across `src/` —
 * the stored-XSS exposure at the end of Phase C was therefore latent rather than
 * live. This test is what keeps that true: a future pass that reaches for
 * `dangerouslySetInnerHTML` to render, say, a rich-text tour description gets a
 * failing test that names the decision it is making, instead of quietly
 * inheriting an archive of admin-authored text written under plain-text rules.
 *
 * ## If you are here because this test failed
 *
 * It is not a rule that can never be broken — it is a rule that cannot be broken
 * SILENTLY. To render HTML you must:
 *
 *   1. sanitize the value on the way IN, with an allow-list that names the tags
 *      you are permitting (`sanitize-tour-text.ts` has the strip-everything
 *      configuration to start from, and the note on why there is no
 *      "allow bold and italics" variant of it);
 *   2. re-audit every stored row written before that change, because the
 *      existing archive was written under plain-text rules and never sanitized
 *      for a renderer that interprets tags;
 *   3. add the file to `ALLOWED` below with a comment saying which of these was
 *      done.
 */

const SOURCE_ROOT = join(__dirname, '..');

/**
 * Empty, and that is the finding. An entry here is a deliberate, reviewed
 * exception — see the header. `next/script`, JSON-LD and analytics snippets are
 * the usual legitimate reasons, and none of them exists in this project.
 */
const ALLOWED: string[] = [];

/** The renderer opt-outs. `innerHTML`/`outerHTML` are included because a direct */
/** DOM write bypasses React's escaping just as completely. */
const FORBIDDEN = ['dangerouslySetInnerHTML', '.innerHTML', '.outerHTML', 'document.write'];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function sourceFiles(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(path, collected);
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      collected.push(path);
    }
  }
  return collected;
}

describe('React escaping is never opted out of', () => {
  /**
   * The test files themselves are excluded from the OCCURRENCE scan but not from
   * discovery, because this very file names all four strings and would otherwise
   * fail on itself. A test file cannot render anything to a visitor.
   */
  const files = sourceFiles(SOURCE_ROOT).filter(
    (path) => !path.includes(`${sep}__tests__${sep}`) && !path.includes('.test.')
  );

  it('finds source files to check at all', () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(FORBIDDEN)('no file under src/ uses %s', (needle) => {
    const offenders = files
      .filter((path) => readFileSync(path, 'utf8').includes(needle))
      .map((path) => relative(SOURCE_ROOT, path).split(sep).join('/'))
      .filter((path) => !ALLOWED.includes(path));

    expect(offenders).toEqual([]);
  });
});
