---
name: QG pattern — the guard test that asserts over nothing
description: Security/invariant tests here keep passing because their input set is empty or their target is the wrong object. Green means nothing until the test has been made to fail.
type: feedback
---

Pattern: a test written to enforce a safety property passes on day one **because
it checked zero things**, not because the property holds. It then reads as
coverage in every later review, which is worse than having no test at all.

Occurrences: 5 (3 self-found in Phase D; +2 found by the independent review,
L5 and M9, 2026-09-19 — and 2 more caught by mutation in the fix round itself)
Last seen: 2026-09-23
Affected agents: e2e, backend-tests, frontend-tests, pipeline-executor
Pipeline: SPEC (GTY admin CMS)
**Escalation threshold (5) reached** — recommend adding "make it fail first; literal
floor on scanned count" to `_base-test.md` (not done by the executor: config change).

Examples (newest; older three were all in `e2e/admin-csrf.spec.ts`, Phase D —
empty secret list, a floor comparing two zeros, and a cookie jar that made the
"anonymous" scan authenticated):
- **M9 (review):** `admin-mutation-guards.test.ts` found actions by FILENAME
  (`actions.ts`) and never looked at `/api/admin/**`. A planted ungated `bulk.ts`
  and an upload route with its session check deleted both left it 10/10 green.
- **Fix round, self-caught:** the "lying Content-Length" test sent a 40 MB IMAGE;
  with the stream cap deleted it still got 413 — from the later per-file size
  check. Fixed by padding a TEXT field beside a small valid JPEG.
- **Fix round, self-caught:** asserting `Cache-Control` CONTAINS `no-store` on an
  admin page passes with the config rule deleted, because Next already sends
  `private, no-cache, no-store, …` on dynamic pages. Assert the exact value.
  Generalises: **when a framework default overlaps your rule, assert the value
  only YOUR rule produces.**

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
