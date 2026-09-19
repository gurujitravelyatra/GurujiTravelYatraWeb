---
name: GTY admin uploads — Phase C decisions
description: Cloudinary file uploads for the tour CMS. NO CREDENTIALS EXIST — the integration is unverified against a real account. Read before touching uploads, media columns, or the publish bar.
type: project
---

Shipped 2026-09-18 on `feat/gty-site-setup` (`6eb49ab`, `62579cc`), Phase C of the
admin CMS. Full decision record in **BLOCKERS.md item 12**; this file is the part
worth knowing before opening any of those files.

## THE THING TO KNOW FIRST: there is no Cloudinary account

`.env` holds only `DATABASE_URL`. There are **no `CLOUDINARY_*` variables** in
`.env`, in the shell, or anywhere in this environment, and **no upload has ever
been performed against a real Cloudinary account.** Everything is built,
typechecked and unit-tested against a **mocked SDK**.

So the claim "uploads work" is NOT evidence-backed. Specifically unverified:
that a real signed upload is accepted, that the returned `secure_url` resolves,
and that `raw` PDF delivery works against the account's security settings. What
IS verified live is the database half — 22 integration tests (`RUN_DB_TESTS=1`)
round-trip cover/gallery/brochure through real SQL.

Unset is a supported mode: `isCloudinaryConfigured()` → false, the route answers
503 with the reason, and the form's controls disable themselves and say why.
**But a tour then cannot be PUBLISHED**, because a cover image is now required.

`.env.example` documents the three variables. To go live, someone must create the
account and supply them — nothing in the code needs to change.

## Decisions that would be expensive to reverse

- **Signed server-side upload, never an unsigned preset.** An unsigned preset is
  a permanent public write token in page JS; it cannot be scoped to a session,
  which defeats an admin-only surface. The browser never talks to Cloudinary — it
  POSTs to `/api/admin/uploads`.
- **Validation reads MAGIC BYTES, never the declared MIME type or the filename.**
  Both are client-written, so a rule that reads them is a rule an attacker
  restates for free. An SVG renamed `holiday.jpg` is a stored-XSS vector and is
  refused on its leading bytes. JPEG/PNG/WebP 10MB, PDF 20MB.
- **Replacement safety = `overwrite: false` + `unique_filename: true` + no
  explicit `public_id`.** Every upload is a NEW asset, so a replacement is an
  addition and the live page's asset is never written to. The DB pointer moves
  only on save, strictly after the upload returned a URL. **Consequence: replaced
  assets are never deleted** — orphans accumulate against the free tier.
  Reclaiming them is an unwritten follow-up sweep.
- **The brochure writes to the EXISTING `Brochure` table, not a new
  `Tour.brochurePdfUrl`.** That column would have shown the admin a successful
  upload while `GET /api/brochures/[slug]` kept answering `PENDING_UPLOAD` — see
  `feedback_qg_unenforced-safety-flag.md` variant 4.
- **The gallery is a `TourGalleryImage` child table, not `String[]` of URLs.** An
  image carries a `publicId` and dimensions; two parallel arrays have nothing
  tying index n of one to index n of the other.
- **A cover image is REQUIRED TO PUBLISH** (the user's original spec), reversing
  Phase B's interim "images not required". Gallery and brochure stay optional.

## Landmines found the hard way

1. **PDFs must upload as `resource_type: 'raw'`, not as image-type PDFs.**
   Cloudinary can rasterise a thumbnail from an image-type PDF, but their
   DELIVERY is disabled by default on an account — so that choice gives an upload
   that succeeds, a URL that looks right, and a 401 for every visitor who clicks
   Download. Nothing in the code would notice.
2. **Do not write a non-form field from the save path.** `photosCount` was
   briefly derived on save as `galleryImages.length`. Tidy, and wrong: it is not a
   form field, so editing a tour's *description* silently changed its photo count
   — caught going 11 → 0 on a real seeded tour by the live integration suite, and
   the live row had to be repaired. It is derived at READ time in
   `PrismaContentAdapter` instead. General rule: if the admin cannot see a field
   in the form, the save path must not write it.
3. **The save transaction needs an explicit budget.** Adding one round trip (the
   brochure lookup) pushed it past Prisma's 5s default over Railway's proxy,
   aborting with `Transaction not found` — *intermittently*, so it would have
   shipped and eaten roughly one save in five behind a generic "Saving failed".
   `createTour`/`updateTour` now pass `{ maxWait: 10_000, timeout: 30_000 }`, as
   `prisma/seed.ts` already did for the same link.
4. **An uploaded image must reach the PUBLIC query, not just the column.** The
   publish gate requiring `coverImageUrl` is not enough — a visitor still sees a
   grey box unless `PrismaContentAdapter` carries it across. The render branch
   lives in `PhotoPlaceholder`'s new `imageUrl` prop, i.e. the one component every
   card/hero/rail already routes through, so no call site can be the one that was
   forgotten.

**Why:** the credentials gap is invisible from the code (it all typechecks and
tests green) and is exactly the thing a later session would assume was done.
**How to apply:** read before touching `src/server/uploads/*`,
`/api/admin/uploads`, `TourUploadsSection`, the media columns, or
`publishableTourSchema`. See also [[project_gty_admin_auth]] (Phase A) and
BLOCKERS.md items 11 and 12.
