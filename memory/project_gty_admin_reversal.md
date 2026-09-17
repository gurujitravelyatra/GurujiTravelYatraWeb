---
name: gty-admin-reversal
description: The "zero admin/login/CMS" rule that governed this repo since project start was explicitly, permanently reversed by the user on 2026-09-17 — a full admin CMS is now in-scope and being built in this repo.
metadata:
  type: project
---

The GTY website repo's foundational architecture constraint — "this repo is the
public website only, zero login, zero admin UI, zero CMS-style screens,
everything admin-related lives in a separate system" — was the user's own
explicit instruction at the start of this build, and was verified as a hard
PASS/FAIL gate in three independent adversarial pre-merge reviews since.

**On 2026-09-17 the user explicitly reversed this**, confirmed via a direct
yes/no question after I flagged the contradiction (including that the product
spec's own Section 7/12 originally framed admin as living "inside the existing
CRM, not a separate site"). The user's answer: *"Yes, confirmed — this is an
intentional, permanent pivot."*

**Current state (do not re-flag as a violation):** `/admin/*` routes, a login
screen, session-gated middleware, and a full tour-management CMS (auth, CRUD,
file uploads to Cloudinary, draft/publish workflow) are now legitimate,
in-scope parts of this repo, built directly into the same Next.js app as the
public site — not a separate project, not the CRM.

**Pricing model clarified alongside this:** tours are NOT uniformly single- or
multi-tier. Some tours have one price, others have multiple named tiers
(Standard/Deluxe/Premium-style). The admin UI must let the user choose, per
tour, whether to keep a single price or add a tiers table — this is a
per-tour toggle, not a global schema mode.

**Why:** Not recorded verbatim from the user, but the practical trigger was
that the CRM/ERP side's admin work and lead-endpoint integration is still
pending, and the user wants a working content-management surface now rather
than wait indefinitely.

**How to apply:** Any future review (edge-case-adversary, QG, or otherwise)
that flags `/admin`, login, or CMS surfaces as a "zero admin" violation is
using STALE guidance — check this memory and `documentation/technical-
specification/BLOCKERS.md` for the actual current architecture decision
before treating admin/CMS code as out-of-scope or as a security violation.
The things that DO still need real scrutiny in this new surface: auth
correctness, session handling, upload validation, draft/published leak
prevention on public endpoints, XSS sanitization of admin-authored content,
and rate-limiting/CSRF — these are genuine security requirements for the CMS
itself, not remnants of the old "no admin" rule.

See also: [[project_gty_content_database]] (the DB layer this CMS now manages
content through) and `documentation/technical-specification/BLOCKERS.md` for
the full decision record.
