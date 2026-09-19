---
name: QG pattern — the guard test that asserts over nothing
description: Security/invariant tests here keep passing because their input set is empty or their target is the wrong object. Green means nothing until the test has been made to fail.
type: feedback
---

Pattern: a test written to enforce a safety property passes on day one **because
it checked zero things**, not because the property holds. It then reads as
coverage in every later review, which is worse than having no test at all.

Occurrences: 3
Last seen: 2026-09-19
Affected agents: e2e, backend-tests, frontend-tests, pipeline-executor
Pipeline: SPEC (GTY admin CMS)

Examples:
- `e2e/admin-csrf.spec.ts` (2026-09-19): the secret-leak check built its list of
  secrets from `process.env` **inside the Playwright runner**, which loads no
  `.env` — the list came back empty and the loop ran zero comparisons. Green,
  and worthless.
- Same file, same day: the non-vacuity guard added to fix it was itself vacuous —
  `expect(SECRETS.length).toBeGreaterThanOrEqual(Object.keys(PLANTED).length)`
  passes when BOTH are 0.
- Same file, same day: the scans were reading the wrong page. Playwright's
  `request` fixture keeps a cookie jar and Auth.js re-issues its sliding session
  cookie, so an earlier authenticated call authenticated the later "anonymous"
  ones; `/admin/login` 307'd to `/admin` and the body scanned under the name
  `/admin/login` was the dashboard. A deliberate leak planted on `/admin/login`
  was invisible to a test that claimed to scan it.

**Why:** three variants in a single file in a single sitting, all green, all
proving nothing. Every one was found by trying to make the test FAIL, and none
would ever have been found by reading it.

**How to apply — for any test asserting that something is ABSENT:**
1. **Make it fail before you trust it.** Plant the thing it forbids, watch it go
   red, then remove it. Budget for this; it is the only evidence that exists.
2. **Guard the guard, with a constant.** `expect(files.length).toBeGreaterThan(50)`,
   `expect(chunks.size).toBeGreaterThan(5)` — a literal floor, never a comparison
   between two things that can both be zero.
3. **Assert you looked at what you named.** `maxRedirects: 0` plus a status
   assertion; the file list contains the paths you expect; the fetch returned 200.
4. **Prefer patterns that cannot go empty** (a regex for the SHAPE of a secret)
   alongside lists that can.
5. **Cross-process assumptions are the usual culprit.** The test runner, the
   server under test and the build are three different environments. If the test
   needs a value the server has, PLANT it from one place both sides read.
