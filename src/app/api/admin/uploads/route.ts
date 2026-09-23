import { getAdminSession } from '@/server/auth/session';
import { SLUG_PATTERN } from '@/server/admin/tours/tour-form-schema';
import {
  CLOUDINARY_NOT_CONFIGURED,
  isCloudinaryConfigured,
  uploadAsset,
} from '@/server/uploads/cloudinary';
import {
  MAGIC_BYTE_PREFIX_LENGTH,
  MAX_BROCHURE_BYTES,
  isUploadKind,
  maxBytesFor,
  validateUpload,
} from '@/server/uploads/file-validation';

import { apiFailure, apiSuccess, handleRoute } from '../../_lib/json';

/**
 * `POST /api/admin/uploads` — the admin CMS's file intake. Phase C.
 *
 * ## This is the FIRST authenticated route under `src/app/api`
 *
 * Everything else in this folder is public, read-only content. This one writes to
 * a paid third-party account on the strength of a session cookie, so the auth
 * check is the first thing it does and there is no branch that reaches Cloudinary
 * without it.
 *
 * It uses `getAdminSession()` and NOT `requireAdminSession()`, which is the one
 * deliberate difference from every `/admin` page and server action.
 * `requireAdminSession()` redirects to the login page — correct for a navigation,
 * wrong for an XHR, where a 307 to an HTML login form arrives at a `fetch()`
 * expecting JSON and surfaces to the admin as a parse error instead of "your
 * session expired". A 401 with a readable message is the honest answer, and the
 * upload UI turns it into a retry prompt.
 *
 * ## `src/proxy.ts` does NOT cover this path, by design of that file's matcher
 *
 * The proxy matches `/admin` and `/admin/:path*` only. That is not a gap being
 * tolerated — it is why the session check here is the real gate, exactly as
 * `src/server/auth/session.ts` states the rule for every admin entry point. The
 * proxy is an optimistic pre-filter for page navigations; an API route must
 * answer for itself.
 *
 * ## CSRF
 *
 * A multipart POST is a "simple request" in CORS terms, so a form on another
 * origin can submit to this URL without a preflight. What stops it is the session
 * cookie's `SameSite=Lax` (NextAuth v5's default, unchanged here): a cross-site
 * POST does not carry the cookie, so it arrives unauthenticated and gets a 401.
 *
 * The header checks in `refuseForeignRequest()` are a second, independent line.
 * **They are not belt and braces and this note used to claim they were** — see
 * that function for what the old version actually permitted.
 */

export const dynamic = 'force-dynamic';
/** Uploads are Node-only: `cloudinary` uses Node streams and crypto. */
export const runtime = 'nodejs';

/**
 * A ceiling applied to the declared `Content-Length` BEFORE the body is read.
 *
 * `request.formData()` buffers the whole request in memory, so without this a
 * signed-in admin — or anyone holding a stolen cookie — could hand the server a
 * 2 GB body and have it allocated before any size rule ran. Authentication
 * bounds who can do that; it does not make it free.
 *
 * It is NOT the real limit and cannot be: `Content-Length` is client-supplied and
 * may be absent entirely on a chunked request. The authoritative check is
 * `validateUpload()` over the actual byte count, below. This header check exists
 * only to avoid buffering something enormous first.
 *
 * The slack over `MAX_BROCHURE_BYTES` covers multipart framing — boundaries, part
 * headers and the other form fields — which are counted by `Content-Length` but
 * not by the file's own length.
 */
const MAX_REQUEST_BYTES = MAX_BROCHURE_BYTES + 1024 * 1024;

/**
 * ## The origin policy, rewritten — M3 of the 2026-09-19 review
 *
 * The old check refused exactly one value:
 *
 * ```
 * if (request.headers.get('sec-fetch-site') === 'cross-site') …
 * ```
 *
 * with a comment explaining that `same-site` "covers a subdomain" and was
 * therefore fine. It is not fine, and it is the whole finding: `same-site`
 * means a DIFFERENT ORIGIN that happens to share a registrable domain. Any
 * sibling subdomain — a staging host, a marketing microsite, a CMS preview, a
 * hosting provider's wildcard, anything ever pointed at `*.gty.example` — could
 * POST here and carry the session cookie, because `SameSite=Lax` considers a
 * sibling subdomain same-site too. The cookie defence and the header defence
 * had the same blind spot, so the "second, independent line" was neither.
 *
 * ## What is allowed now, and the reason for each
 *
 * - **`same-origin`** — the admin UI's own `XMLHttpRequest`. The only value a
 *   legitimate browser upload produces.
 * - **header absent** — a non-browser client: `curl`, the Jest suite, the
 *   Playwright request fixture. `Sec-Fetch-*` is a forbidden header name, so a
 *   page CANNOT remove it or set it; its absence therefore means "not a
 *   browser", and a non-browser client has no ambient cookie to be tricked
 *   into sending. Refusing this would make the route untestable without
 *   proving anything.
 * - **everything else, including `none`** — refused. `none` is a user-initiated
 *   navigation (a typed URL, a bookmark), which cannot be a multipart POST from
 *   any real flow; nothing in this project needs it and an E2E test that did
 *   would be testing a path that does not exist.
 *
 * ## And the `Origin` header, checked independently
 *
 * `Sec-Fetch-Site` is recent. `Origin` is universal, and a cross-origin form
 * POST always carries it. So when it is present it must name THIS host — which
 * closes the same-site hole for any browser too old to send `Sec-Fetch-Site`.
 *
 * The comparison is on HOST, not on the full origin string, because this app
 * sits behind a TLS-terminating proxy: the request the server sees is plain
 * HTTP on an internal address while `Origin` says `https://` and the public
 * name. Comparing schemes would refuse every legitimate production upload.
 *
 * `x-forwarded-host` is accepted alongside `host` for the same reason. It is
 * spoofable — and `memory/project_gty_admin_auth.md` records that this exact
 * header defeats Next's own server-action origin check — but only by a client
 * that can already set arbitrary headers, i.e. not a browser, i.e. not
 * something with a stolen ambient cookie. Stated here rather than discovered
 * again later.
 */
function refuseForeignRequest(request: Request): string | null {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return 'Uploads must come from the admin interface on this site.';
  }

  const origin = request.headers.get('origin');
  if (origin !== null && origin !== 'null') {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      // An unparseable Origin is not a value any browser produces.
      return 'Uploads must come from the admin interface on this site.';
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = request.headers.get('host');
    const permitted = [forwardedHost, host].filter((value): value is string => value !== null);

    // No `Host` at all is HTTP/1.1-invalid and cannot be matched against. Closed
    // is the right direction: there is nothing to compare the Origin to.
    if (!permitted.includes(originHost)) {
      return 'Uploads must come from the admin interface on this site.';
    }
  }

  // `Origin: null` is a sandboxed iframe or a redirected cross-origin request.
  // Neither is the admin UI, and both are refused by the branch above's guard
  // only because they are handled here instead — explicitly, so the string
  // 'null' is not mistaken for a hostname.
  if (origin === 'null') {
    return 'Uploads must come from the admin interface on this site.';
  }

  return null;
}

/**
 * The declared body size, or a refusal — M2 of the 2026-09-19 review.
 *
 * The old check was:
 *
 * ```
 * const declaredLength = Number(request.headers.get('content-length') ?? '0');
 * if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) …
 * ```
 *
 * `Number('abc')` is `NaN`, `Number.isFinite(NaN)` is `false`, so the guard was
 * SKIPPED for any unparseable header — and the whole body was buffered. A size
 * limit that any client can turn off by sending `Content-Length: abc` is not a
 * size limit. The `?? '0'` did the same thing for a header that was simply
 * absent, only more quietly: it invented a zero and reported the request as
 * comfortably under the cap.
 *
 * Both are now closed rather than open. The header must be present and must be
 * digits — `/^\d+$/` rather than `Number()`, because `Number` also accepts
 * ` 12 `, `1e5`, `0x10` and `-1`, none of which is a valid `Content-Length`
 * token and all of which would mean the parsed value is not what the sender
 * said.
 *
 * ## The cost, stated: a chunked upload is now refused
 *
 * A request with no `Content-Length` (HTTP/1.1 chunked transfer) gets a 411.
 * Browsers set the header for a `FormData` body, so the admin UI is unaffected;
 * what this does affect is any intermediary that re-chunks the request. This
 * deployment sits behind a managed proxy that has not been observed doing that
 * and could not be tested from here — so if uploads ever start failing with
 * "declare its size", THIS is the line, and relaxing it is safe precisely
 * because `readBodyWithinCap()` below enforces the real limit on the bytes as
 * they arrive rather than on the sender's claim about them.
 */
type LengthVerdict = { ok: true } | { ok: false; status: number; message: string };

function checkDeclaredLength(request: Request): LengthVerdict {
  const declared = request.headers.get('content-length');

  if (declared === null) {
    return {
      ok: false,
      status: 411,
      message: 'That upload did not declare its size, so it cannot be accepted. Try again.',
    };
  }

  if (!/^\d+$/.test(declared.trim())) {
    return {
      ok: false,
      status: 400,
      message: 'That upload declared an invalid size, so it cannot be accepted. Try again.',
    };
  }

  if (Number(declared) > MAX_REQUEST_BYTES) {
    return { ok: false, status: 413, message: 'That file is too large to upload.' };
  }

  return { ok: true };
}

/**
 * Reads the request body, refusing the moment it exceeds the cap.
 *
 * This is the half the header check cannot be: `Content-Length` is a CLAIM, and
 * a client that declares 1 MB is free to send two gigabytes. `request.formData()`
 * buffers whatever arrives with no ceiling of its own, so before this the only
 * thing standing between a signed-in client (or a stolen cookie) and the
 * server's memory was the sender's own honesty about the number.
 *
 * Reading the stream ourselves and aborting past the cap makes the limit
 * enforceable rather than advisory. The body is then handed to `Response` to be
 * parsed as multipart — the same parser `request.formData()` uses, running over
 * a buffer that is now provably bounded.
 *
 * Returns `null` when the cap was exceeded. Memory stays bounded by the cap in
 * every branch, including the refusal, because the stream is cancelled rather
 * than drained.
 */
async function readBodyWithinCap(request: Request, cap: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (request.body === null) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined) continue;

    total += value.byteLength;
    if (total > cap) {
      // Cancel rather than break: cancelling tells the sender to stop, where
      // breaking would leave the rest of a 2 GB upload arriving into a socket
      // buffer nobody is reading.
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return new Uint8Array(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  return handleRoute('POST /api/admin/uploads', async () => {
    const session = await getAdminSession();
    if (session === null) {
      return apiFailure(401, 'Your session has expired. Sign in again, then retry the upload.');
    }

    // Origin policy, then declared size — both BEFORE a byte of the body is
    // read, so a refusal costs a header lookup rather than a buffered upload.
    const foreign = refuseForeignRequest(request);
    if (foreign !== null) return apiFailure(403, foreign);

    const length = checkDeclaredLength(request);
    if (!length.ok) return apiFailure(length.status, length.message);

    if (!isCloudinaryConfigured()) {
      /**
       * 503, not 500: nothing is broken and nothing the admin did is wrong. This
       * is an environment fact, and it is the same distinction
       * `/api/brochures/[slug]` draws between "no store configured" and "no such
       * brochure".
       */
      return apiFailure(503, CLOUDINARY_NOT_CONFIGURED);
    }

    /**
     * The body is read HERE, under a hard cap, and parsed from the buffer —
     * rather than handed to `request.formData()`, which would buffer whatever
     * arrives however much that turns out to be.
     */
    const body = await readBodyWithinCap(request, MAX_REQUEST_BYTES);
    if (body === null) {
      return apiFailure(413, 'That file is too large to upload.');
    }

    let formData: FormData;
    try {
      // Wrapped in a Blob rather than passed as a Uint8Array: the ambient
      // `BodyInit` in this toolchain does not admit a `BufferSource`, and a
      // Blob is a zero-copy view over the same bytes.
      formData = await new Response(new Blob([body]), {
        // The multipart boundary lives in this header; without it there is
        // nothing to parse the buffer against.
        headers: { 'content-type': request.headers.get('content-type') ?? '' },
      }).formData();
    } catch {
      return apiFailure(400, 'That upload could not be read. Try again.');
    }

    const kind = formData.get('kind');
    if (!isUploadKind(kind)) {
      return apiFailure(400, 'Unknown upload kind.');
    }

    const file = formData.get('file');
    /**
     * Duck-typed rather than `instanceof File`. The undici `File` a Next route
     * receives is not always reference-identical to the global the test
     * environment provides, and an `instanceof` that is false in jsdom would make
     * this branch untestable — it would reject every file in the suite while
     * working in production, which is the worst way round.
     */
    if (file === null || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return apiFailure(400, 'No file was included in that upload.');
    }

    /**
     * L1 — the tour slug is VALIDATED, not merely non-empty.
     *
     * It flows into `folderFor()` and becomes a path segment in the Cloudinary
     * folder an asset is filed under: `gty/tours/<slug>/<kind>`. It arrives from
     * a form field on a hand-craftable request, and the old check was
     * `length > 0`.
     *
     * So `../../../` reached a path builder, and a 64 kB string reached a folder
     * name. Neither is a catastrophe — Cloudinary treats `folder` as a filing
     * label rather than a filesystem path, and the DATABASE identity is the
     * returned `publicId`, never this — which is exactly why it rates an L. But
     * "the remote service probably normalises it" is a bet on someone else's
     * parser, placed on every upload, for the sake of not writing one `regex.test`.
     *
     * `SLUG_PATTERN` is THE slug rule — the same constant `tourFormSchema` uses,
     * imported rather than restated, so the folder a draft's assets land in
     * cannot disagree with the slug that draft will be saved under.
     */
    const tourSlugField = formData.get('tourSlug');
    let tourSlug: string | null = null;

    if (typeof tourSlugField === 'string' && tourSlugField.length > 0) {
      // The length cap is part of `SLUG_PATTERN` itself, so this one test is the
      // whole rule — shape AND size.
      if (!SLUG_PATTERN.test(tourSlugField)) {
        return apiFailure(400, 'That tour reference is not valid, so the file was not uploaded.');
      }
      tourSlug = tourSlugField;
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    /**
     * THE AUTHORITATIVE CHECK. Run over the bytes that actually arrived, not over
     * `file.size`, `file.type`, the filename, or the `Content-Length` read above
     * — every one of those is a claim by the sender.
     */
    const validation = validateUpload(kind, {
      byteLength: bytes.byteLength,
      head: bytes.subarray(0, MAGIC_BYTE_PREFIX_LENGTH),
      declaredMimeType: typeof file.type === 'string' ? file.type : undefined,
      fileName: typeof file.name === 'string' ? file.name : undefined,
    });

    if (!validation.ok) {
      // 413 for a size refusal, 400 for everything else — the distinction a
      // client needs to decide whether retrying the same file could ever work.
      const status = validation.code === 'TOO_LARGE' ? 413 : 400;
      return apiFailure(status, validation.message);
    }

    const fileName = typeof file.name === 'string' && file.name.length > 0 ? file.name : 'upload';

    const asset = await uploadAsset({
      kind,
      format: validation.format,
      bytes,
      fileName,
      tourSlug,
    });

    /**
     * The response is the ONLY thing that reaches the database, and it reaches it
     * later — the editor holds these values in the form and they are written when
     * the admin saves the tour. That ordering is the replacement-safety property:
     * the stored URL is not repointed until a new asset demonstrably exists.
     */
    return apiSuccess({
      url: asset.url,
      publicId: asset.publicId,
      bytes: asset.bytes,
      width: asset.width ?? null,
      height: asset.height ?? null,
      format: asset.format,
      fileName,
      /** Echoed so the client can reject a response that arrived for the wrong field. */
      kind,
      limitBytes: maxBytesFor(kind),
    });
  });
}
