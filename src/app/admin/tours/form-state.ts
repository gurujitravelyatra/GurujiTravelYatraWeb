/**
 * The tour form's action state — the SHAPE only, deliberately in its own module.
 *
 * ## Why this is not in `actions.ts`
 *
 * `actions.ts` carries `'use server'`, and a `"use server"` file may ONLY export
 * async functions. Exporting the `EMPTY_FORM_STATE` constant from there compiles
 * and passes `tsc`, then fails the production build with:
 *
 *   `A "use server" file can only export async functions, found object.`
 *
 * — and it fails during "Collecting page data", i.e. after a successful compile,
 * which is why it is worth a note rather than a silent fix. `type` exports are
 * fine there because they are erased, so only the runtime value had to move.
 *
 * This is the same family of Next 16 trap `memory/project_gty_admin_auth.md`
 * records for `proxy.ts` and `assertAuthSecretConfigured()`: the build is the
 * first thing that checks these rules, so a green `tsc` says nothing about them.
 */

export interface TourFormState {
  /** Form-level error, or null. */
  error: string | null;
  /** Field-level errors keyed by the form path, e.g. `priceFrom`, `faqs.0.question`. */
  fieldErrors: Record<string, string>;
}

export const EMPTY_FORM_STATE: TourFormState = { error: null, fieldErrors: {} };
