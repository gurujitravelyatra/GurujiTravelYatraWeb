# Impact Analysis — Batch #15071 / #15072 / #15073 / #15078

Diff analyzed: `git diff b46663f8..HEAD` (commits `abc2b5b4` fix + `45e2bca6` test + `853bd0b4` invalidate-guard follow-up, branch `users/vedat/15071-15072-15073-15078-bug-batch`).

> **[STALE — updated for PR #5091 review round]** Everything below this note
> describes the ORIGINAL batch only. The PR #5091 review added five more
> commits touching the same surfaces this artifact already covers:
> `9e9b3dfc` (guard the enable-dialog preselect against an in-flight
> `mailSettingsQuery`, same file as the enableIntro/logo work below —
> `useOnboardingLogic.ts`), `a7d3bdfe` (surface the mail-settings server error
> reason instead of a generic toast, same file), `e9e33b7f` (restore the
> Exchange deliverability caveat dropped from the #15077 REDO dialog,
> `OnboardingSection.tsx` + 6 locales), and `189f54c4`/`4354aa89` (D1/D2:
> restructured `onboarding-config.service.ts`'s `updateConfig` into a
> validate-all → upload → DB-update → delete-old-blobs pipeline, and added a
> try/catch to `CustomizeOnboarding/useCustomizeOnboardingLogic.ts`'s
> `onPublish`). The `useUpdateOnboardingConfigMutation` cache-strategy row
> below and its line references were written against the pre-D1 shape of
> `onboarding-config.service.ts`; the write-through/invalidate-guard logic
> itself (`frontend/src/services/onboarding-config.service.ts`) is untouched
> by D1/D2, but the backend line numbers it cites have shifted. Function names
> are used instead of line numbers going forward in this file to avoid
> re-staling.

## Changed Files

**Backend (`backend/src/modules/onboarding/`)**
- `dto/onboarding-process.dto.ts` — added `enableIntro: boolean` to `OnboardingProcessDto` (API contract change, additive).
- `lib/resolve-enable-intro.ts` (new) + `.spec.ts` — shared helper `resolveEnableIntro(settings)`, factors out the `settings['enableintroscreen'] === true` check.
- `onboarding.service.ts` — `getProcess()` now fetches `enableintroscreen` via `settingsService.getByKeys` and populates `enableIntro` on the response DTO.
- `onboarding-config.service.ts` — `getPortalConfig` switched its inline check to call the same `resolveEnableIntro` helper (no behavior change, dedup only).
- `onboarding.service.spec.ts`, `onboarding-config.service.spec.ts` — new coverage for both producers.

**Guest portal app (`onboarding/src/`)**
- `models/onboarding.model.ts` — `OnboardingProcess.enableIntro?: boolean` (hand-mirrored copy of the backend DTO field, optional).
- `views/useOnboardingView.ts` — `useStepNavigation(..., process?.enableIntro ?? true)` replaces a hard-coded `true`.
- `hooks/useStepNavigation.ts` (+`.tc.test.ts`) — `welcome` page is now conditionally pushed based on `enableIntro`; added to the `useMemo` deps.

**Admin app (`frontend/src/`)**
- `services/onboarding-config.service.ts` (+ new `.test.ts`) — mutation `onSuccess` changed from unconditional `invalidateQueries` to a `setQueryData` write-through of `companyName`, `cssFile`, `welcomeScreen`, `successScreen`, `privacyPolicy`, `termsAndConditions`, and `logo: null` (delete case); falls back to a single targeted `invalidateQueries` only when a server-generated asset was actually uploaded — non-null `logoData`, `welcomeBackgroundData`, or `successBackgroundData` (guard generalized in `853bd0b4`).
- `views/Settings/sections/Onboarding/OnboardingSection.tsx` — tri-state `logoSrc` fix (delete no longer falls through to stale server logo), `logoRow` flex wrapper (spacing fix #15072), file-type + size validation with inline `logoError` message (#15073), input reset moved before the early-return so re-selecting the same rejected file re-fires `onChange`.
- `views/Settings/sections/Onboarding/useOnboardingLogic.ts` — `onError` toast added to both the logo-autosave effect and manual `onSave` mutation calls (#15078 failure surfacing); removed the redundant second `onSave()` call after `onLogoDelete()`.
- 6 locale pairs (`de/fr/is/nl/tr/en` × `onboarding-settings.json`, `settings.json`) — new keys `logoInvalidType`, `logoTooLarge`, `logoSaveError`.
- Several `.test.ts(x)` files updated/added for the above.

## Cross-Component Impact

| Component | App(s) | Risk | Reason |
|-----------|--------|------|--------|
| `OnboardingProcessDto.enableIntro` | backend + `onboarding/` portal | LOW | Additive field on a hand-mirrored (not shared-package) contract. Confirmed the only consumer needing the field (`useOnboardingView.ts`) already reads it via `process?.enableIntro ?? true`; other readers of `OnboardingProcess` (`onboarding/src/services/onboarding.service.ts` passthrough, `useOnboardingProcess.ts` react-query wrapper, `StepRenderer.tsx` prop) don't touch the field, so nothing else needs updating. |
| `resolveEnableIntro` helper | backend only | NONE | Pure dedup of an existing expression; both call sites (`onboarding.service.ts`, `onboarding-config.service.ts`) produce identical output to before. No other backend module reads the `enableintroscreen` key. |
| `useUpdateOnboardingConfigMutation` cache strategy | `frontend/` admin app | MEDIUM (gap found → **RESOLVED in-batch, `853bd0b4`**) | Two independent hooks share the same `['onboarding-config']` query cache and both call this mutation: `Onboarding/useOnboardingLogic.ts` (primary; all its mutated fields are covered by the merge whitelist) AND `CustomizeOnboarding/useCustomizeOnboardingLogic.ts` (`onPublish`). **Gap found during this analysis:** `onPublish` can also send `welcomeBackgroundData` / `successBackgroundData` (base64 background-image uploads). The backend injects the resulting blob SAS URL into `welcomeScreen`/`successScreen` server-side only on a subsequent `GET` (`onboarding-config.service.ts`, `injectBackgroundImage`) — the `PUT` response is a bare string and carries no image URL — so the write-through alone would have cached the client's raw (background-less) screen JSON, and the initial conditional-invalidate checked only `variables.logoData`. **Fixed in this batch by `853bd0b4`:** the guard was generalized to a single `uploadedAsset` check covering non-null `logoData`, `welcomeBackgroundData`, or `successBackgroundData` (any server-generated asset upload triggers one targeted invalidate); resets/deletes stay local via write-through (background deletes ride along with the `welcomeScreen`/`successScreen` null payload). Covered by new tests in `onboarding-config.service.test.ts`. **Note (PR #5091 review, D1):** `onPublish` itself gained a try/catch (`4354aa89`) unrelated to this cache guard — the guard logic above is unaffected. |
| Logo tri-state / spacing / validation fixes | `frontend/` `Onboarding/` section only | LOW | Self-contained to `OnboardingSection.tsx` + `useOnboardingLogic.ts`; no other component renders this section. |
| i18n key additions | `frontend/` (6 locales) | NONE | Additive only-keys; existing i18n-parity test (`QA-EC-30` in the onboarding functional spec) covers this pattern. |

## Shared Package Changes
None. `packages/common/*` and `packages/back/*` / `packages/front/*` are untouched by this diff — confirmed via grep, no shared-package files appear in the changed-file list.

## Recommendations
- [x] ~~Extend the conditional-invalidate check to also cover `welcomeBackgroundData`/`successBackgroundData` uploads~~ — **DONE in `853bd0b4`**: the guard in `frontend/src/services/onboarding-config.service.ts` now fires the targeted invalidate for any non-null asset upload (`logoData`, `welcomeBackgroundData`, `successBackgroundData`), with test coverage added in `onboarding-config.service.test.ts`.
- [ ] Verify `useOnboardingLogic.ts`'s `[..., toast, t]` dependency-array addition doesn't cause the `onSave` `useCallback` to re-create on every render if `toast`/`t` are not stable references (check `useToast`/`useTranslation` memoization) — a minor churn risk, not a correctness bug.
- [ ] No ADO posting performed per orchestrator instruction (local-only run).

## Risk Summary
HIGH: 0 | MEDIUM: 1 (found and resolved in-batch, `853bd0b4`) | LOW: 3 | NONE: 2
