# Issue Analysis — Batch #15085 / #15086

## Bug #15085 — "Media/Metafield: Main window remains accessible when child modal dialog is open — clicking Add Media/Metafield again closes the dialog"

**State:** In Progress | **Assigned to:** Vedat Kökmen | **Iteration:** Sprint 8.3
**Severity:** 3 - Medium | **Priority:** 2

**Problem summary**
When the "Add guest media" (Media section) or "Add metafield" (Metafields section) dialog is open, the main screen behind it remains clickable. Clicking the trigger button ("Add New Media" / "Add metafield") a second time closes the dialog instead of being blocked. Same behavior applies to both the Media dialog and the Metafield dialog.

**Root cause (confirmed via code read)**
- `frontend/src/views/Settings/sections/Media/MediaSection.tsx` / `MetafieldsSection.tsx`: the trigger `<button onClick={onAdd}>` is a plain HTML button rendered as a **sibling** of `<MediaDialog>`/`<MetafieldDialog>`, not a Fluent `DialogTrigger`. It stays enabled and clickable regardless of dialog open state.
- `frontend/src/views/Settings/sections/Media/useMediaLogic.ts` / `useMetafieldsLogic.ts`: `openCreateDialog` unconditionally calls `setShowDialog(true)` — no guard against being called while already open.
- `frontend/src/views/Settings/sections/Media/MediaDialog.tsx` / `MetafieldDialog.tsx`: `<Dialog open={open} onOpenChange={...}>` never explicitly sets `modalType="modal"` (relies on Fluent's implicit default), unlike other dialogs in the codebase (`RequestWizard.tsx:996`, `CommandPalette.tsx:240`, `ManageGuestsDialog.tsx:270`, `PostureActionDialog.tsx:365`) which declare it explicitly.

**Suspected scope:** Frontend only.

**Related work item:** #14170 (Onboarding/Settings area)

---

## Bug #15086 — "Metafield: Required checkbox can be set to false during Onboarding and cannot be modified afterwards in Additional Info"

**State:** In Progress | **Assigned to:** Vedat Kökmen | **Iteration:** Sprint 8.3
**Severity:** 2 - High | **Priority:** 2

**Problem summary**
A metafield of type Checkbox marked Required is not enforced during the onboarding wizard — the guest can leave it unchecked (false) and still submit. Afterwards the value shows as "No" in Overview → Teams → Additional Info with no way to correct it there.

**Root cause (confirmed via code read)**
- `onboarding/src/components/MetafieldStep.tsx` line ~206-208: `allRequiredFilled` gate checks `(values[opt.id] ?? '').trim().length > 0`. For Text/Date/Dropdown, unset = `''` so the check works. For Checkbox, the value is always the **string** `"true"`/`"false"` — `"false".trim().length > 0` is `true`, so an unchecked required checkbox is treated as "filled" and never blocks the Send button.
- `frontend/src/components/AdditionalInformation/AdditionalInformation.tsx` line ~450-453: `editable = canEdit && entry.type !== FIELD_TYPE.Checkbox` — Checkbox metafields are unconditionally excluded from the edit pencil, per a comment claiming legacy parity ("Checkbox metafield can not be edited"). Per project convention (see memory `feedback_fabricated_legacy_parity_comment`), this comment is suspect — the ADO bug explicitly asks for checkbox editability, so the exclusion itself is the bug, not a preserved legacy constraint. `MetafieldEditor` has no Checkbox-type branch (falls through to a plain text `<Input>`), so even removing the exclusion needs a Switch-based editor branch added.
- `backend/src/modules/onboarding/onboarding.service.ts` line ~1427-1466 (final-submission required-metafield gate): only checks **row existence** in `metafieldData` for each required metafield ID — never inspects the stored `value`. Since the checkbox always writes a row (`"true"` or `"false"`), this server-side gate cannot catch a bypass of the (buggy) frontend check either — defense-in-depth gap for all required-checkbox metafields specifically.

**Suspected scope:** Full-stack (frontend required-gate fix + edit capability in Additional Info; backend defense-in-depth value check).

**Related work item:** #14170

---

## Batch Summary

**Overlaps:** No file overlap between #15085 (Media/Metafield Settings dialogs) and #15086 (onboarding wizard + Additional Info + onboarding service). Safe to implement with one frontend agent (covers both — no cross-bug file collision) + one backend agent (only touches #15086's backend defense-in-depth).

**Recommended fix order:** #15086 first (High severity, full-stack), then #15085 (Medium, frontend-only).

**Blockers:** None. Both bugs are well-scoped with confirmed root causes from direct code reads.
