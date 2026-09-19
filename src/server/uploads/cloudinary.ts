import 'server-only';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

import type { DetectedFormat, UploadKind } from './file-validation';

/**
 * The only module in this project that talks to Cloudinary.
 *
 * ## `import 'server-only'` is load-bearing here, more than anywhere else
 *
 * `CLOUDINARY_API_SECRET` is a credential with write access to the media account.
 * A client component that imported this file would inline the module into the
 * browser bundle, and while Next would not inline a non-`NEXT_PUBLIC_` env var's
 * VALUE, the import itself is the mistake worth failing the build over. The
 * browser never speaks to Cloudinary in this design — it POSTs to
 * `/api/admin/uploads`, which is behind the admin session, and that route calls
 * this.
 *
 * ## Signed server-side upload, not an unsigned browser upload
 *
 * Cloudinary's unsigned preset is the other common pattern and is rejected here.
 * An unsigned preset is, by construction, an upload endpoint that anyone who
 * views the page's JavaScript can POST to, forever, from anywhere — the preset
 * name IS the credential and it cannot be scoped to a session. For a surface
 * whose whole point is that only a logged-in admin may add media, handing out a
 * permanent public write token to get a few hundred milliseconds of latency back
 * is the wrong trade. Signing server-side also means the size/format rules in
 * `file-validation.ts` are enforced on a path the browser cannot go around,
 * because the browser has nothing to go around it WITH.
 *
 * ## Configuration is read per call, never at module load
 *
 * `next build` runs with `NODE_ENV=production` and evaluates every page module,
 * so anything that throws on missing configuration at import time breaks the
 * BUILD rather than the request — the trap `assertAuthSecretConfigured()` exists
 * for, recorded in `memory/project_gty_admin_auth.md`. Missing Cloudinary config
 * is therefore a value (`isCloudinaryConfigured()` → false) that the route turns
 * into a 503 and the form turns into a disabled control with a reason, never an
 * exception at import.
 */

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function readConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // All three or none. Two out of three is a half-finished deployment, and
  // treating it as "configured" would surface as an opaque 401 from Cloudinary
  // at the moment an admin uploads rather than as a clear "not configured".
  if (!cloudName || !apiKey || !apiSecret) return null;

  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  return readConfig() !== null;
}

export const CLOUDINARY_NOT_CONFIGURED =
  'File uploads are not available in this environment: no Cloudinary account is configured. ' +
  'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (see .env.example).';

export interface UploadedAsset {
  /** Cloudinary's `secure_url` — always https. */
  url: string;
  publicId: string;
  bytes: number;
  /** Images only; a raw PDF has no dimensions. */
  width?: number;
  height?: number;
  format: string;
  resourceType: string;
}

/**
 * PDFs go up as `raw`; images as `image`.
 *
 * Cloudinary can hold a PDF as an `image` resource and rasterise page 1 into a
 * thumbnail, which is tempting. It is not used because delivery of `image`-type
 * PDFs is BLOCKED BY DEFAULT on Cloudinary accounts (Settings → Security →
 * "Allow delivery of PDF and ZIP files"), so that choice produces an upload that
 * succeeds, a URL that looks right, and a 401 for every visitor who clicks
 * Download — a failure that would not show up until someone tried the live link.
 * `raw` delivery is not subject to that setting.
 *
 * The cost is that there is no server-generated PDF thumbnail. The editor shows
 * the filename, size and a "view" link instead, which is what the brochure field
 * needs anyway.
 */
function resourceTypeFor(format: DetectedFormat): 'image' | 'raw' {
  return format === 'pdf' ? 'raw' : 'image';
}

/**
 * Where an asset lands. Grouped per tour so the Cloudinary media library is
 * navigable by someone who did not build this, and so a tour's assets can be
 * found without the database.
 *
 * `slug` is used for a NEW tour too, where it is the slug the admin has typed but
 * not yet saved. That is fine and is why the folder is not treated as a key: it
 * is a filing label, and the database's `publicId` is the identity. A tour later
 * renamed keeps its old folder, which is untidy and harmless — moving assets to
 * match would be a destructive operation run for cosmetics.
 */
function folderFor(kind: UploadKind, tourSlug: string | null): string {
  const scope = tourSlug && tourSlug.length > 0 ? tourSlug : '_unsaved';
  return `gty/tours/${scope}/${kind}`;
}

export interface UploadRequest {
  kind: UploadKind;
  format: DetectedFormat;
  bytes: Buffer;
  /** The admin's own filename, used as the basis of the public_id. */
  fileName: string;
  /** The tour being edited, or null when creating one that has no slug yet. */
  tourSlug: string | null;
}

/**
 * Uploads one file and returns where it landed.
 *
 * ## REPLACEMENT SAFETY LIVES IN THESE THREE OPTIONS
 *
 * `overwrite: false` + `unique_filename: true` + no explicit `public_id` is the
 * whole mechanism, and it is why replacing a published tour's cover cannot break
 * the live page:
 *
 *   - Cloudinary mints a NEW public_id for every upload (`spiti_a7f3c1.jpg`), so
 *     a replacement is an ADDITION. The asset the live site is currently serving
 *     is never written to.
 *   - The database is only repointed afterwards, by the tour form's own save,
 *     which happens strictly after this promise resolves with a URL.
 *   - So the old URL keeps resolving right up to the swap, and a failed or
 *     abandoned upload leaves the live tour exactly as it was.
 *
 * Passing `public_id: slug` with `overwrite: true` — the other obvious way to
 * write this — inverts all three: it mutates the asset in place, so a half-
 * finished upload can leave the live page serving a truncated image, and there
 * is nothing to roll back to.
 *
 * The consequence, stated plainly: REPLACED ASSETS ARE NOT DELETED. Nothing here
 * calls `destroy`. Orphans accumulate in Cloudinary and, on a free tier, count
 * against storage. That is the deliberate trade — an unreferenced file costs
 * money, a deleted-too-early file costs a broken live page — and reclaiming them
 * is a follow-up (a sweep over `publicId`s no row references), not something to
 * bolt onto the request that is trying to make the swap safe.
 */
export async function uploadAsset(request: UploadRequest): Promise<UploadedAsset> {
  const config = readConfig();
  if (config === null) throw new Error(CLOUDINARY_NOT_CONFIGURED);

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const options: UploadApiOptions = {
    folder: folderFor(request.kind, request.tourSlug),
    resource_type: resourceTypeFor(request.format),

    // See the doc block above — these three are the replacement-safety mechanism.
    overwrite: false,
    unique_filename: true,

    /**
     * Keeps a human-readable stem ("spiti-cover_a7f3c1.jpg") so the Cloudinary
     * media library is legible. `unique_filename` is what stops it colliding.
     * For a `raw` PDF this is also what preserves the `.pdf` extension, which is
     * what makes a browser open it rather than download an extensionless blob.
     */
    use_filename: true,
    filename_override: request.fileName,

    /**
     * Cloudinary re-decodes and normalises what it accepts, which is a second,
     * independent format check on the far side of ours. Restricting the allowed
     * formats here means an attacker who somehow got past the magic-byte sniff
     * still cannot land an SVG in the account.
     */
    allowed_formats: request.format === 'pdf' ? ['pdf'] : ['jpg', 'jpeg', 'png', 'webp'],
  };

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, response) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error.message ?? error)));
        return;
      }
      if (!response) {
        reject(new Error('Cloudinary returned no response for the upload.'));
        return;
      }
      resolve(response);
    });

    stream.end(request.bytes);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format ?? request.format,
    resourceType: result.resource_type,
  };
}
