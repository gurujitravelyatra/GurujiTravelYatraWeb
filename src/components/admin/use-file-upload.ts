'use client';

import { useCallback, useRef, useState } from 'react';

import {
  MAGIC_BYTE_PREFIX_LENGTH,
  type UploadKind,
  validateUpload,
} from '@/server/uploads/file-validation';

/**
 * The browser half of `/api/admin/uploads` — Phase C.
 *
 * ## Why `XMLHttpRequest` and not `fetch`
 *
 * `fetch()` still cannot report UPLOAD progress. `ReadableStream` request bodies
 * exist but stream the request in the other direction and are not supported for
 * this purpose across the browsers this admin runs in. XHR's `upload.onprogress`
 * is the only API that reports bytes-sent, so it is what is used here.
 *
 * This matters because the alternative is a spinner that spins for the same
 * duration whether the file is 40 KB or 9 MB, which tells the admin nothing and
 * — on the hotel wifi a travel company's staff actually work from — is
 * indistinguishable from a hang. A bar that moves is the difference between
 * waiting and reloading the page halfway through.
 *
 * ## The progress number means one specific thing, and the UI says so
 *
 * `upload.onprogress` measures BROWSER → OUR SERVER only. When it reaches 100%
 * the server has the bytes and has not yet finished handing them to Cloudinary,
 * which on a large image is a further second or two. Reporting that as "100%,
 * done" and then sitting there is the dishonest version, so the phase changes to
 * `finalising` at 100% and the UI relabels rather than pretending the wait is
 * over.
 */

export interface UploadedFileResult {
  url: string;
  publicId: string;
  bytes: number;
  width: number | null;
  height: number | null;
  format: string;
  fileName: string;
  kind: UploadKind;
}

export type UploadPhase =
  | { phase: 'idle' }
  | { phase: 'reading'; fileName: string }
  | { phase: 'uploading'; fileName: string; percent: number; index: number; total: number }
  | { phase: 'finalising'; fileName: string; index: number; total: number }
  | { phase: 'error'; message: string; fileName: string | null }
  | { phase: 'success'; message: string };

const NETWORK_ERROR =
  'The upload could not reach the server. Check your connection and try again — nothing else on this form has been lost.';

/**
 * Reads the server's JSON envelope. `json.ts` guarantees `{ error }` on failure,
 * so the specific reason — wrong type, too large, session expired — is carried
 * through to the admin verbatim instead of being flattened into "upload failed".
 */
function messageFromResponse(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) return parsed.error;
  } catch {
    // Not JSON — fall through to the status-based message below.
  }

  if (status === 401) return 'Your session has expired. Open the admin in another tab, sign in, then retry.';
  if (status === 413) return 'That file is too large.';
  return `The upload failed (error ${status}). Try again.`;
}

interface UploadOneOptions {
  file: File;
  kind: UploadKind;
  tourSlug: string | null;
  onProgress: (percent: number) => void;
  onFinalising: () => void;
}

function postFile({ file, kind, tourSlug, onProgress, onFinalising }: UploadOneOptions): Promise<UploadedFileResult> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    if (tourSlug) body.append('tourSlug', tourSlug);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/uploads');

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      if (percent >= 100) onFinalising();
      else onProgress(percent);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(messageFromResponse(xhr.status, xhr.responseText)));
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText) as { data?: UploadedFileResult };
        if (!parsed.data?.url) {
          reject(new Error('The server accepted the file but returned no address for it. Try again.'));
          return;
        }
        resolve(parsed.data);
      } catch {
        reject(new Error('The server’s reply could not be read. Try again.'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error(NETWORK_ERROR)));
    xhr.addEventListener('abort', () => reject(new Error('The upload was cancelled.')));
    xhr.addEventListener('timeout', () => reject(new Error('The upload timed out. Try again.')));

    xhr.send(body);
  });
}

/**
 * Runs the SAME validation the server runs, before a byte goes over the wire.
 *
 * This is the shared-schema discipline `tour-form-schema.ts` uses, applied to
 * files: one `validateUpload()`, called from both sides, so the client cannot
 * promise something the server will refuse. It is a courtesy, not a check — the
 * server re-runs it over the bytes that actually arrive, and that run is the one
 * that decides.
 *
 * The payoff is concrete: a 19 MB photo is refused instantly instead of after a
 * two-minute upload, and a renamed `.jpg` is caught before it is sent, because
 * this reads the real leading bytes rather than trusting `file.type`.
 */
async function preflight(kind: UploadKind, file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, MAGIC_BYTE_PREFIX_LENGTH).arrayBuffer());
  const result = validateUpload(kind, {
    byteLength: file.size,
    head,
    declaredMimeType: file.type,
    fileName: file.name,
  });
  return result.ok ? null : result.message;
}

export interface UseFileUploadResult {
  status: UploadPhase;
  /** Uploads every file in order and resolves with the ones that succeeded. */
  upload: (files: File[], kind: UploadKind) => Promise<UploadedFileResult[]>;
  reset: () => void;
}

export function useFileUpload(tourSlug: string | null): UseFileUploadResult {
  const [status, setStatus] = useState<UploadPhase>({ phase: 'idle' });

  /**
   * Guards against a second batch starting while one is in flight — a double
   * click on the file input, typically. A ref and not state: it is read and
   * written inside the same event handler and must not wait for a re-render, and
   * reading state during render is what React Compiler rejects
   * (`memory/project_gty_admin_auth.md`).
   */
  const busy = useRef(false);

  const reset = useCallback(() => setStatus({ phase: 'idle' }), []);

  const upload = useCallback(
    async (files: File[], kind: UploadKind): Promise<UploadedFileResult[]> => {
      if (busy.current || files.length === 0) return [];
      busy.current = true;

      const uploaded: UploadedFileResult[] = [];

      try {
        for (const [index, file] of files.entries()) {
          setStatus({ phase: 'reading', fileName: file.name });

          const rejection = await preflight(kind, file);
          if (rejection !== null) {
            /**
             * Stops the batch at the first bad file and KEEPS what already
             * succeeded — those are returned and the caller commits them. Dropping
             * six good uploads because the seventh was a HEIC would be the worst
             * of both behaviours.
             */
            setStatus({ phase: 'error', message: `${file.name}: ${rejection}`, fileName: file.name });
            return uploaded;
          }

          setStatus({ phase: 'uploading', fileName: file.name, percent: 0, index, total: files.length });

          try {
            const result = await postFile({
              file,
              kind,
              tourSlug,
              onProgress: (percent) =>
                setStatus({ phase: 'uploading', fileName: file.name, percent, index, total: files.length }),
              onFinalising: () => setStatus({ phase: 'finalising', fileName: file.name, index, total: files.length }),
            });
            uploaded.push(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : NETWORK_ERROR;
            setStatus({ phase: 'error', message: `${file.name}: ${message}`, fileName: file.name });
            return uploaded;
          }
        }

        setStatus({
          phase: 'success',
          message:
            files.length === 1
              ? `“${files[0].name}” uploaded. Remember to save the tour.`
              : `${files.length} files uploaded. Remember to save the tour.`,
        });
        return uploaded;
      } finally {
        busy.current = false;
      }
    },
    [tourSlug]
  );

  return { status, upload, reset };
}
