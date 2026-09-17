/**
 * Email normalisation for admin accounts. Pure, dependency-free, and
 * deliberately NOT marked `server-only`.
 *
 * It lives in its own file so that the two processes that must agree on it can
 * both import it: the Next app (via `admin-user.ts`, which does the database
 * lookup) and `prisma/seed-admin.ts`, which runs under `ts-node` in a plain Node
 * process where a `server-only` import throws outright.
 *
 * The alternative was to let the seed script keep its own copy of the rule. That
 * is the shape `memory/feedback_qg_duplicate-fixture-transcription.md` records
 * going wrong repeatedly in this repo, and it fails in a particularly bad way
 * here: if the seed and the login path ever disagreed about case handling, the
 * seed would happily write a row that the login could never find, and the only
 * symptom would be a correct password being rejected forever.
 */

/**
 * Lowercase and trim. Postgres `@unique` is case-SENSITIVE, so this is what
 * actually makes `AdminUser.email` unique in the sense anyone means by it —
 * without it, `Owner@gty.com` and `owner@gty.com` are two permitted rows.
 *
 * Applied on BOTH sides: every write in `prisma/seed-admin.ts` and every lookup
 * in `findAdminUserForLogin()`.
 */
export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}
