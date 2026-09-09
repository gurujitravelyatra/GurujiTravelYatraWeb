# Impact Analysis — Batch #15125 #15127

Diff analyzed: `git diff origin/develop...HEAD` (branch `users/vedat/15125-15127-bug-batch`,
base `1e8a0790`, 4 commits: `a10dca24`, `271aab7b`, `18949f8b`, `d9cca05c`).

## Changed Files

**Backend (AB#15125 — Deleted-card fan-out on requester self-delete)**
- `backend/src/modules/requests/requests.service.ts` — `deleteOwnRequest()`: after the
  existing soft-delete + activity-history write, adds a fire-and-forget
  `notifyAfterDeleteRequest` bot-card fan-out to the request's approvers (reusing
  `getRequestApprovers`, `resolveDenyRequestMailContext`, `resolveRequesterCard`,
  `resolveGroupTypeKey` — all pre-existing helpers, no new shared surface). Added `select`
  fields (`requesterMail`, `requesterComment`, `team`, `invitee.mail`) to the existing
  Prisma query.
- `backend/src/modules/bot/bot-notification.service.ts` — doc-comment-only change on
  `DeleteRequestNotificationData`; no runtime logic touched. `notifyAfterDeleteRequest` itself
  (template, recipient shape, `botnotification_forprocessedrequest` gate) is unmodified —
  this diff is its **first caller** (previously zero callers in `backend/src`).
- `backend/tests/.../requests.service.deleteOwnRequest.spec.ts` (new, 390 lines) — pins the
  fan-out behavior.

**Frontend (AB#15127 — auto-approved toast variant)**
- `frontend/src/components/RequestWizard/useRequestWizardLogic.ts` — creation success toast
  branches on `data?.autoApproved`: `toast.successAutoApproved` vs `toast.success`.
- `frontend/src/i18n/locales/{de,en,fr,is,nl,tr}/requestWizard.json` — new key
  `toast.successAutoApproved` added to all 6 locales (additive only, no key removed/renamed).
- `frontend/src/i18n/locales.requestWizard-parity.test.ts` (new, 93 lines) — enforces the
  6-locale key-set stays in sync going forward.
- `frontend/src/components/RequestWizard/useRequestWizardLogic.test.ts` (new, 102 lines) —
  pins the toast-copy branching.

## Cross-Component Impact

| Component | App(s) | Risk | Reason |
|---|---|---|---|
| `RequestsService.deleteOwnRequest` | backend (eum-ai) | LOW | Single confirmed caller: `requests.controller.ts` `DELETE /:id` (`:206-213`). No other backend module calls this method. The new fan-out is appended after the existing DB write and wrapped in `.then().catch()` — a notification failure cannot roll back or throw past the delete response. |
| `BotNotificationService.notifyAfterDeleteRequest` | backend (eum-ai) | NONE | Method, template, and gate (`botnotification_forprocessedrequest`) are pre-existing and unchanged; this diff only adds its first caller. No other in-repo caller exists to regress. |
| `useRequestWizardLogic` (toast copy) | frontend (eum-ai) | LOW | Purely additive conditional on an existing response field (`autoApproved`, already returned by `RequestsService.create()` since bug #10132); no change to the field's producer, no change to the non-auto-approved branch's existing string/key. |
| i18n locale bundles (6x `requestWizard.json`) | frontend (eum-ai) | LOW | Additive key only; new parity test (`locales.requestWizard-parity.test.ts`) guards against future drift. No existing key touched. |
| `botnotification_forprocessedrequest` vs `botnotification_forincomingrequest` gate asymmetry | backend (eum-ai) | ACCEPTED, PRE-EXISTING | Every "processed"-class event (approve, deny, user-decline, reassign, and now delete) gates on `_forprocessedrequest`; only the two "new request" creation notifications (`notifyAfterCreateRequest`, `notifyAfterCreateOrgRequest`) gate on `_forincomingrequest`. This diff extends the existing pattern to `delete` — it does not introduce a new asymmetry. Documented in the functional spec (FR-18 addendum) and in `teams-bot.md` §4.4's existing catalogue row. Not a defect; no action taken. |

## Shared Package Changes

None. No files under `packages/common`, `packages/back`, or `packages/front` were touched by
this diff — confirmed via `git diff --name-only origin/develop...HEAD` (all 12 changed paths
are under `backend/src/modules/...` or `frontend/src/...`, plus locale JSON and test files).

## Recommendations

- [x] No shared-package or cross-app blast radius — safe to proceed without additional
  cross-team review.
- [x] Verify SonarCloud develop-branch baseline for the 3 touched source files before
  flagging any issue as "introduced by this diff" (done in the SONARCLOUD sub-step below).
- [ ] Consider (future, out of scope for this batch): backfill functional-spec coverage for
  the create-time `enableautoapprove` gate (bug #10132) in §4.2 — it drives the `autoApproved`
  flag this batch's toast reads, but has no dedicated FR of its own; this batch only
  documents the flag's consumer (the toast), not the full producer-side feature.
- [ ] No ADO posting performed per orchestrator instruction (local-only run; branch not yet
  pushed).

## Risk Summary

- HIGH: 0
- MEDIUM: 0
- LOW: 4
- NONE: 1
- ACCEPTED/PRE-EXISTING (documented, not a defect): 1
