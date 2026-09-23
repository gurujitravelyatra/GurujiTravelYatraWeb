# Testing Agents Base

> Inherits: [_base-core.md](_base-core.md) + project `_base-project.md` | Used by: frontend-tests, backend-tests agents

## Required Input

- Target: component/hook/service/controller
- Existing implementation
- Expected behavior

Behavior unclear -> **STOP and ASK**

## Rules

- Test behavior, not implementation
- Prefer black-box tests
- Mock: network, external services, browser/DB
- Do NOT mock framework internals

## Coverage

- States: loading/error/success
- User interactions
- Edge cases
- Error paths

## Conventions

- Colocated or `__tests__/`
- One unit per file

## Allowed

- Extract pure functions for testability
- Add interfaces for mocks
- DI improvements

## Forbidden

- Feature development
- Snapshot-only testing
- Over-mocking
- Testing implementation details

## Do NOT Trust Parity / "Dead Flag" Comments (escalated from QG feedback, 6 occurrences)

Tests and code in this repo have repeatedly carried comments like "legacy parity", "matches Classic behavior", "dead flag", or "by design" that were **fabricated justifications codifying a bug** — and a test asserting that comment then locked the bug in (e.g. @TC12194 asserted an ignored `enableIntro` flag as intended; a checkbox edit exclusion cited fake legacy parity).

When you encounter a test or comment claiming current behavior is intentional:
1. Do NOT treat the comment as authority. Verify against the spec (`documentation/**`), the ADO work item, or the orchestrator context.
2. If the spec/work item says the behavior is a bug, **rewrite the test to assert the fixed behavior** and delete the misleading comment — never write code or tests to satisfy the old assertion.
3. If no authoritative source settles it, flag it in your handoff (`Open questions`) instead of assuming the comment is right.

## A Green "Absence" Test Proves Nothing Until It Fails (escalated from QG feedback, 5 occurrences)

Any test asserting something is ABSENT — a leaked secret, an unguarded route, a stale invariant, a forbidden pattern — has repeatedly passed on day one for the wrong reason: an empty input set, a scan of the wrong object, or a floor comparing two things that can both be zero (`3x` in one file in one sitting; then a mutation-guard scan that found actions by filename and never looked at the real route directory; then a `Cache-Control` substring check that a framework default already satisfies with the actual rule deleted).

For any test that asserts an absence:
1. **Make it fail before you trust it.** Plant the thing it forbids, confirm red, then remove it. This is the only evidence that exists — reading the assertion is not enough.
2. **Guard the guard with a literal floor** (`expect(files.length).toBeGreaterThan(N)`), never a comparison between two values that can both be zero.
3. **Assert you actually looked at what you named** (status code + no-redirect, the file list contains the expected paths, the fetch really returned 200).
4. **When a framework default overlaps your rule, assert the exact value only your rule produces** — a substring/contains check will pass even with your rule deleted.
5. **Cross-process assumptions are the usual culprit.** The test runner, the server under test, and the build are different environments — plant a shared value from one place both sides read, don't assume the runner's env matches the server's.
