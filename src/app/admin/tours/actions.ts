'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';

import { requireAdminSession } from '@/server/auth/session';
import {
  createTour,
  findSlugConflict,
  getAdminTourBySlug,
  setTourArchived,
  setTourStatus,
  updateTour,
} from '@/server/admin/tours/tour-repository';
import {
  isSubmitIntent,
  parseTourForm,
  publishableTourSchema,
  type SubmitIntent,
} from '@/server/admin/tours/tour-form-schema';

// TYPE-ONLY import: a `"use server"` file may not export a value that is not an
// async function, and it may not re-export one either. The shape lives in
// `form-state.ts`; see the note there.
import type { TourFormState } from './form-state';

/**
 * Tour CRUD server actions — Phase B.
 *
 * ## Every action calls `requireAdminSession()` FIRST
 *
 * Not the layout, not `proxy.ts`. Both are documented as insufficient in
 * `src/server/auth/session.ts`: a proxy cannot see a server action invoked
 * directly, and a layout's check does not stop nested segments rendering. A
 * server action is a POST endpoint with a stable ID — it is reachable without
 * ever loading the page that renders its form — so the check belongs in the
 * action itself, before it reads a single field.
 *
 * `requireAdminSession()` redirects rather than returning null, so there is no
 * falsy branch for one of these to forget.
 *
 * ## Why the public site's cache is revalidated here
 *
 * Publishing a tour changes what `/`, `/tour-packages` and `/tour-packages/
 * [slug]` should render. Those are the surfaces the draft gate hides, so they
 * are exactly the ones that must be re-rendered when a tour crosses the gate in
 * either direction — a publish that is invisible for an hour looks like a bug,
 * and an un-publish that stays cached is a draft leak with a cache in front of
 * it.
 */

const NO_DATABASE =
  'No content database is configured (DATABASE_URL is unset), so tours cannot be saved. ' +
  'The site is serving its built-in fixture catalogue.';

/**
 * Revalidates every public surface a tour's publication state affects.
 *
 * Listed explicitly rather than calling `revalidatePath('/', 'layout')`, so it
 * is legible which pages depend on tour content — and so adding a new public
 * tour surface is a visible one-line change here rather than something that
 * silently already worked and silently stops working later.
 */
function revalidateTourSurfaces(slug: string): void {
  revalidatePath('/');
  revalidatePath('/tour-packages');
  revalidatePath(`/tour-packages/${slug}`);
  revalidatePath('/admin/tours');
}

/** Zod issues → the flat `path: message` map the form renders. */
function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join('.');
    // First message per field wins — the form shows one message per input, and
    // the first is the most specific in Zod's ordering.
    if (path && !(path in fieldErrors)) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

/**
 * The form posts JSON in a single field rather than ~30 flat `FormData` entries.
 *
 * The payload is deeply nested (itinerary days, FAQs and pricing tiers are
 * arrays of objects), and `FormData` has no representation for that beyond
 * inventing an index-encoded key convention and parsing it back. Since the
 * client already holds a validated object from React Hook Form, serialising it
 * once and re-parsing it with THE SAME Zod schema server-side is both simpler
 * and stricter — the server's parse is the real one either way.
 */
function readPayload(formData: FormData): { intent: SubmitIntent; values: unknown } | null {
  const intent = formData.get('intent');
  if (!isSubmitIntent(intent)) return null;

  const raw = formData.get('payload');
  if (typeof raw !== 'string') return null;

  try {
    return { intent, values: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

const MALFORMED = 'That submission could not be read. Please reload the page and try again.';

const EDIT_CONFLICT =
  'Someone else saved changes to this tour after you opened it, so your changes have NOT been saved — ' +
  'saving now would erase theirs. Everything you typed is still in the form below: copy anything you need, ' +
  'then reload the page to see their version and re-apply your edits.';

const TOUR_GONE =
  'That tour no longer exists — it may have been renamed or removed by someone else. ' +
  'Nothing was saved. Go back to the tours list to find it.';

/**
 * The editor's version token, as an exact instant. `Date.parse` accepts far
 * more than the ISO string the form writes, so the shape is checked first — a
 * token that is not what the form produces is not a version this server issued.
 */
function readVersion(formData: FormData): Date | null {
  const raw = formData.get('expectedUpdatedAt');
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function saveTourAction(
  _previousState: TourFormState,
  formData: FormData
): Promise<TourFormState> {
  await requireAdminSession();

  const payload = readPayload(formData);
  if (!payload) return { error: MALFORMED, fieldErrors: {} };

  const editingSlug = formData.get('editingSlug');
  const currentSlug = typeof editingSlug === 'string' && editingSlug.length > 0 ? editingSlug : null;

  /**
   * M7 — the version the editor was loaded at. REQUIRED for an edit: a
   * submission without one (a hand-crafted POST, or a tab open since before this
   * shipped) cannot be checked, and saving it unchecked is exactly the silent
   * overwrite this exists to stop. Refused as malformed, which already tells the
   * admin to reload.
   */
  let expectedUpdatedAt: Date | null = null;
  if (currentSlug) {
    expectedUpdatedAt = readVersion(formData);
    if (!expectedUpdatedAt) return { error: MALFORMED, fieldErrors: {} };
  }

  /**
   * Re-validated server-side with the schema the INTENT demands, never the one
   * the client claims to have used. `parseTourForm` is the only place that
   * mapping is made, so "Publish" cannot be satisfied by the draft-level schema
   * even if the request was hand-crafted.
   */
  const parsed = parseTourForm(payload.intent, payload.values);
  if (!parsed.success) {
    return {
      error:
        payload.intent === 'publish'
          ? 'This tour is not ready to publish yet — see the fields marked below.'
          : 'Some fields need attention before this can be saved.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const values = parsed.data;

  /**
   * SLUG COLLISIONS ARE REJECTED, NOT AUTO-SUFFIXED.
   *
   * The alternative — silently saving `spiti-valley-2` when the admin typed
   * `spiti-valley` — produces a public URL that is not the one they entered and
   * not the one they will paste into a campaign. A slug is an address, so the
   * system refuses and says which tour holds it; the field is editable, so the
   * admin resolves it deliberately. (This is also why `tour-form-schema.ts`
   * validates the slug's SHAPE rather than re-slugifying whatever was typed.)
   */
  const conflict = await findSlugConflict(values.slug, currentSlug ?? undefined);
  if (!conflict.configured) return { error: NO_DATABASE, fieldErrors: {} };
  if (conflict.value.taken) {
    return {
      error: null,
      fieldErrors: {
        slug: conflict.value.archived
          ? `“${values.slug}” is already used by an ARCHIVED tour. Archived tours keep their URL — find it with the “Archived” status filter, or choose a different slug.`
          : `“${values.slug}” is already used by another tour. Choose a different slug.`,
      },
    };
  }

  let savedSlug: string;
  try {
    if (currentSlug && expectedUpdatedAt) {
      const result = await updateTour(currentSlug, values, payload.intent, expectedUpdatedAt);
      if (!result.configured) return { error: NO_DATABASE, fieldErrors: {} };

      /**
       * Returned as STATE, not a redirect, so the editor stays mounted with
       * everything the admin typed still in it. Reloading would show the other
       * person's version and throw this one away — the admin decides that, not
       * the server.
       */
      if (result.value.outcome === 'conflict') {
        return { error: EDIT_CONFLICT, fieldErrors: {}, conflict: true };
      }
      if (result.value.outcome === 'missing') {
        return { error: TOUR_GONE, fieldErrors: {} };
      }
      savedSlug = result.value.slug;
    } else {
      const result = await createTour(values, payload.intent);
      if (!result.configured) return { error: NO_DATABASE, fieldErrors: {} };
      savedSlug = result.value.slug;
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error('[admin/tours] save failed', error);
    return { error: 'Saving failed. The tour has not been changed.', fieldErrors: {} };
  }

  revalidateTourSurfaces(savedSlug);
  // Also revalidate the old URL when the slug changed, or the previous address
  // keeps serving a cached page for a tour that no longer lives there.
  if (currentSlug && currentSlug !== savedSlug) revalidatePath(`/tour-packages/${currentSlug}`);

  /**
   * Redirect from the server, outside the try/catch — `redirect()` signals by
   * throwing, and `loginAction` records what happens when this is done from a
   * client effect instead.
   */
  redirect(`/admin/tours/${savedSlug}/edit?saved=${payload.intent}`);
}

/**
 * Publish / un-publish from the LIST view.
 *
 * Publishing here runs the SAME `publishableTourSchema` the form's Publish
 * button runs. Without that, the list toggle would be a second, laxer path to
 * the same state change — publish a tour the form refused to publish, one click
 * away, on the screen where the admin can see least about it. The tour is
 * re-read from the database and validated in its persisted shape, which is the
 * honest question: "is what is stored publishable", not "was the form valid".
 */
export async function setTourPublishedAction(formData: FormData): Promise<void> {
  await requireAdminSession();

  const slug = String(formData.get('slug') ?? '');
  const publish = String(formData.get('publish') ?? '') === 'true';
  if (!slug) return;

  if (publish) {
    const existing = await getAdminTourBySlug(slug);
    if (!existing.configured || existing.value === null) return;

    // Validated over the STORED form values, which is the honest question here:
    // "is what is saved publishable", not "was some form valid".
    const check = publishableTourSchema.safeParse(existing.value.form);
    if (!check.success) {
      /**
       * Refused, and the admin is told where to fix it. Redirecting to the edit
       * page with the reason beats a toast on the list: the fields that are
       * missing are only editable there, so this sends them to the one screen
       * that can resolve it.
       */
      redirect(`/admin/tours/${slug}/edit?publishBlocked=1`);
    }
  }

  const result = await setTourStatus(slug, publish ? 'PUBLISHED' : 'DRAFT');
  if (!result.configured) return;

  revalidateTourSurfaces(slug);
}

/**
 * Archive / restore. Sets `archivedAt`; the row is never deleted — product-spec
 * §7's rule for anything with lead history, which a tour certainly has.
 */
export async function setTourArchivedAction(formData: FormData): Promise<void> {
  await requireAdminSession();

  const slug = String(formData.get('slug') ?? '');
  const archived = String(formData.get('archived') ?? '') === 'true';
  if (!slug) return;

  const result = await setTourArchived(slug, archived);
  if (!result.configured) return;

  revalidateTourSurfaces(slug);
}
