import { getAdminSession } from '@/server/auth/session';
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
 * The `Sec-Fetch-Site` check below is a second, independent line — belt and
 * braces on a route that spends money.
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

export async function POST(request: Request) {
  return handleRoute('POST /api/admin/uploads', async () => {
    const session = await getAdminSession();
    if (session === null) {
      return apiFailure(401, 'Your session has expired. Sign in again, then retry the upload.');
    }

    /**
     * `cross-site` is the only value worth refusing. `same-origin` is the normal
     * case, `same-site` covers a subdomain, and `none` is what a non-browser
     * client (curl, a test) sends — and those are already authenticated by the
     * session check above, which is the gate that matters.
     */
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return apiFailure(403, 'Cross-site uploads are not allowed.');
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return apiFailure(413, 'That file is too large to upload.');
    }

    if (!isCloudinaryConfigured()) {
      /**
       * 503, not 500: nothing is broken and nothing the admin did is wrong. This
       * is an environment fact, and it is the same distinction
       * `/api/brochures/[slug]` draws between "no store configured" and "no such
       * brochure".
       */
      return apiFailure(503, CLOUDINARY_NOT_CONFIGURED);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
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

    const tourSlugField = formData.get('tourSlug');
    const tourSlug = typeof tourSlugField === 'string' && tourSlugField.length > 0 ? tourSlugField : null;

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
