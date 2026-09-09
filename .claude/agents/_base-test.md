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
