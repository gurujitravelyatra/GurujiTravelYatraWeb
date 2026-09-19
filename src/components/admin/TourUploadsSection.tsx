'use client';

import { useId } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cloudinaryThumbnailUrl } from '@/lib/cloudinary-url';
import {
  BROCHURE_ACCEPT,
  IMAGE_ACCEPT,
  MAX_BROCHURE_BYTES,
  MAX_IMAGE_BYTES,
  formatBytes,
} from '@/server/uploads/file-validation';
import type { TourFormValues } from '@/server/admin/tours/tour-form-schema';

import { useFileUpload, type UploadPhase } from './use-file-upload';

/**
 * Cover image, gallery and brochure — Phase C, and a full replacement of the
 * disabled stub this file held in Phase B.
 *
 * ## What changed, and why the stub was right until now
 *
 * Phase B shipped these three inputs `disabled`, registering nothing, with the
 * reason stated on screen. That was not caution for its own sake: a file input
 * that accepts a file and silently drops it is worse than no input at all,
 * because the admin believes the image was saved and finds out when the tour goes
 * live without one. Uploads now exist, so the controls are live, the values are
 * registered with React Hook Form, and `Tour` has the columns to hold them.
 *
 * ## The values live in the FORM, not in this component
 *
 * An upload writes its result into RHF (`coverImage`, `galleryImages`,
 * `brochureFile`) via `setValue`, and the tour's own Save/Publish button is what
 * persists it. That has three consequences worth being explicit about:
 *
 *  1. **A failed upload cannot lose the rest of the form.** The upload is an
 *     out-of-band XHR; it never submits the form, so every other field the admin
 *     has typed is untouched and the retry is just picking the file again.
 *  2. **An upload is not a save.** The success message says so, because the asset
 *     existing in Cloudinary and the tour pointing at it are two different
 *     facts — and the second one is what a visitor sees.
 *  3. **Replacement is safe by construction.** A replacement uploads a NEW
 *     Cloudinary asset (`uploadAsset()` never overwrites), and the stored URL is
 *     only repointed when the admin saves. The live tour keeps serving the old
 *     image until then, and an abandoned upload changes nothing.
 */

interface TourUploadsSectionProps {
  control: Control<TourFormValues>;
  setValue: UseFormSetValue<TourFormValues>;
  /** The tour being edited, or undefined when creating — used to file assets per tour. */
  editingSlug?: string;
  /**
   * False when no Cloudinary account is configured. The controls then disable
   * themselves and SAY why, rather than failing at the moment a file is chosen.
   * The Phase B honesty pattern, applied to a genuinely absent capability.
   */
  uploadsEnabled: boolean;
  /** Server-side publish error for the cover image, routed in by `TourForm`. */
  coverError?: string;
}

const COVER_THUMB = { width: 320, height: 200 } as const;
const GALLERY_THUMB = { width: 160, height: 120 } as const;

export function TourUploadsSection({
  control,
  setValue,
  editingSlug,
  uploadsEnabled,
  coverError,
}: TourUploadsSectionProps) {
  const cover = useWatch({ control, name: 'coverImage' });
  const gallery = useWatch({ control, name: 'galleryImages' }) ?? [];
  const brochure = useWatch({ control, name: 'brochureFile' });

  const { status, upload, reset } = useFileUpload(editingSlug ?? null);

  const statusId = useId();

  /**
   * Every `setValue` marks the form dirty and re-validates. `shouldValidate` is
   * what clears a "cover image is required to publish" error the moment the
   * cover arrives — without it the message would sit under a control that
   * visibly shows an image, which reads as the form being broken.
   *
   * Three named setters rather than one generic `commit(name, value)` helper.
   * React Hook Form's `setValue` types its value against the field PATH through a
   * conditional type, and a `K extends keyof TourFormValues` wrapper does not
   * survive that inference — it compiles only with a cast, which would throw away
   * the exact check that stops `galleryImages` being handed a brochure.
   */
  const SET_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

  const setCover = (value: TourFormValues['coverImage']) => setValue('coverImage', value, SET_OPTIONS);
  const setGallery = (value: TourFormValues['galleryImages']) =>
    setValue('galleryImages', value, SET_OPTIONS);
  const setBrochure = (value: TourFormValues['brochureFile']) =>
    setValue('brochureFile', value, SET_OPTIONS);

  const handleCover = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Cleared immediately so re-picking the SAME file after a failure still fires
    // `change`. Without this, a retry of the identical file is a no-op.
    input.value = '';
    if (!file) return;

    const [result] = await upload([file], 'cover');
    if (result) setCover({ url: result.url, publicId: result.publicId });
  };

  const handleGallery = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    const results = await upload(files, 'gallery');
    if (results.length === 0) return;

    // APPENDED, never replaced — picking a second batch adds to the gallery, which
    // is what "add more photos" means. Removal is explicit, per image.
    setGallery([
      ...gallery,
      ...results.map((result) => ({
        url: result.url,
        publicId: result.publicId,
        width: result.width ?? undefined,
        height: result.height ?? undefined,
      })),
    ]);
  };

  const handleBrochure = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const [result] = await upload([file], 'brochure');
    if (result) {
      setBrochure({
        url: result.url,
        publicId: result.publicId,
        fileName: result.fileName,
        sizeBytes: result.bytes,
      });
    }
  };

  const moveGalleryImage = (from: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    const next = [...gallery];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setGallery(next);
  };

  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, position) => position !== index));
  };

  const busy = status.phase === 'uploading' || status.phase === 'finalising' || status.phase === 'reading';

  return (
    <section className="flex flex-col gap-6 rounded-18 border border-gty-border bg-gty-white p-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-16 font-extrabold text-gty-ink">Images &amp; brochure</h2>
        <p className="text-12 leading-relaxed text-gty-subtle">
          Uploads happen straight away, but they are only attached to this tour when you save it. Images:{' '}
          {formatBytes(MAX_IMAGE_BYTES)} max, JPG, PNG or WebP. Brochure: {formatBytes(MAX_BROCHURE_BYTES)} max,
          PDF only.
        </p>
      </div>

      {!uploadsEnabled && (
        <p
          role="status"
          className="rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 leading-relaxed text-gty-body"
        >
          <strong className="font-bold text-gty-ink">Uploads are unavailable here.</strong> No Cloudinary
          account is configured in this environment, so files cannot be stored. The controls below are disabled
          rather than hidden so the fields are visible — and note that a tour cannot be{' '}
          <strong className="font-bold text-gty-ink">published</strong> without a cover image.
        </p>
      )}

      <UploadStatusBanner id={statusId} status={status} onDismiss={reset} />

      {/* ---------------------------------------------------------------- */}
      <fieldset disabled={!uploadsEnabled || busy} className="flex flex-col gap-3">
        <legend className="sr-only">Cover image</legend>
        <Label htmlFor="tour-cover-image">
          Cover image{' '}
          <span className="font-normal normal-case tracking-normal text-gty-faint">— required to publish</span>
        </Label>
        <p id="tour-cover-image-hint" className="text-12 leading-relaxed text-gty-subtle">
          The single photo shown on the tour card and at the top of the tour page.
        </p>

        {cover && (
          <figure className="flex flex-col gap-2">
            {/*
              A plain <img>, not next/image, and deliberately so: the src is
              already a Cloudinary URL carrying `w_`, `q_auto` and `f_auto`, so
              Cloudinary has resized and re-encoded it for this exact slot.
              Passing it through Next's optimiser as well would fetch the derived
              image and derive it a second time — two CDNs' work for one
              thumbnail, on a screen only staff see.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryThumbnailUrl(cover.url, COVER_THUMB)}
              alt="The cover image currently attached to this tour"
              width={COVER_THUMB.width}
              height={COVER_THUMB.height}
              className="rounded-12 border border-gty-border object-cover"
            />
            <figcaption className="flex flex-wrap items-center gap-3 text-12 text-gty-subtle">
              <a href={cover.url} target="_blank" rel="noreferrer" className="font-bold text-gty-primary underline">
                View full size ↗
              </a>
              <Button type="button" size="sm" onClick={() => setCover(undefined)}>
                Remove cover image
              </Button>
            </figcaption>
          </figure>
        )}

        <input
          id="tour-cover-image"
          type="file"
          accept={IMAGE_ACCEPT}
          aria-describedby={`tour-cover-image-hint ${statusId}`}
          aria-invalid={coverError ? true : undefined}
          onChange={(event) => void handleCover(event.currentTarget)}
          className="text-13 text-gty-body file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />

        {cover && (
          <p className="text-12 text-gty-subtle">
            Choosing another file replaces this one. The current image keeps working until you save.
          </p>
        )}

        {coverError && (
          <p role="alert" className="text-12-5 font-semibold text-gty-primary">
            {coverError}
          </p>
        )}
      </fieldset>

      {/* ---------------------------------------------------------------- */}
      <fieldset disabled={!uploadsEnabled || busy} className="flex flex-col gap-3 border-t border-gty-border-4 pt-5">
        <legend className="sr-only">Gallery images</legend>
        <Label htmlFor="tour-gallery">Gallery images</Label>
        <p id="tour-gallery-hint" className="text-12 leading-relaxed text-gty-subtle">
          Optional. Shown in the order below — use the arrows to reorder. Adding more files keeps the ones
          already here.
        </p>

        {gallery.length > 0 && (
          <ol className="flex flex-col gap-3">
            {gallery.map((image, index) => (
              <li
                key={image.publicId}
                className="flex flex-wrap items-center gap-3 rounded-12 border border-gty-border-4 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cloudinaryThumbnailUrl(image.url, GALLERY_THUMB)}
                  alt={`Gallery image ${index + 1}`}
                  width={GALLERY_THUMB.width}
                  height={GALLERY_THUMB.height}
                  className="rounded-8 border border-gty-border object-cover"
                />
                <span className="text-12 font-bold uppercase tracking-label text-gty-subtle">
                  {index + 1} of {gallery.length}
                </span>
                {/*
                  Arrows rather than drag-and-drop. The form already reorders
                  itinerary days, FAQs and pricing tiers exactly this way, so this
                  is the control the admin has already learned — and it is the one
                  that works with a keyboard and a screen reader without a
                  bespoke implementation. Drag-to-reorder would mean a new
                  dependency for a fourth idiom in the same form.
                */}
                <span className="ml-auto flex gap-2">
                  <Button type="button" size="sm" disabled={index === 0} onClick={() => moveGalleryImage(index, index - 1)}>
                    ↑<span className="sr-only">Move gallery image {index + 1} up</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === gallery.length - 1}
                    onClick={() => moveGalleryImage(index, index + 1)}
                  >
                    ↓<span className="sr-only">Move gallery image {index + 1} down</span>
                  </Button>
                  <Button type="button" size="sm" onClick={() => removeGalleryImage(index)}>
                    Remove<span className="sr-only"> gallery image {index + 1}</span>
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}

        <input
          id="tour-gallery"
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          aria-describedby={`tour-gallery-hint ${statusId}`}
          onChange={(event) => void handleGallery(event.currentTarget)}
          className="text-13 text-gty-body file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />
      </fieldset>

      {/* ---------------------------------------------------------------- */}
      <fieldset disabled={!uploadsEnabled || busy} className="flex flex-col gap-3 border-t border-gty-border-4 pt-5">
        <legend className="sr-only">Brochure PDF</legend>
        <Label htmlFor="tour-brochure">Brochure PDF</Label>
        <p id="tour-brochure-hint" className="text-12 leading-relaxed text-gty-subtle">
          Optional. Offered as a download on the tour page. Replacing it uploads a new file — the one currently
          published keeps working until you save.
        </p>

        {brochure && (
          <div className="flex flex-wrap items-center gap-3 rounded-12 border border-gty-border-4 p-3 text-12-5 text-gty-body">
            {/*
              No PDF thumbnail. Cloudinary can rasterise page 1, but only for
              `image`-type PDFs, and those are blocked from delivery by default on
              a Cloudinary account — which is exactly why these are uploaded as
              `raw` (see `resourceTypeFor`). Filename, size and a link that opens
              the real file are what confirm the right document went in.
            */}
            <span aria-hidden="true" className="text-16">
              📄
            </span>
            <span className="font-bold text-gty-ink">{brochure.fileName}</span>
            <span className="text-gty-subtle">{formatBytes(brochure.sizeBytes)}</span>
            <a
              href={brochure.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-gty-primary underline"
            >
              View PDF ↗
            </a>
            <Button type="button" size="sm" className="ml-auto" onClick={() => setBrochure(undefined)}>
              Remove brochure
            </Button>
          </div>
        )}

        <input
          id="tour-brochure"
          type="file"
          accept={BROCHURE_ACCEPT}
          aria-describedby={`tour-brochure-hint ${statusId}`}
          onChange={(event) => void handleBrochure(event.currentTarget)}
          className="text-13 text-gty-body file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />
      </fieldset>
    </section>
  );
}

/**
 * The upload's live state — progress, success, or the specific reason it failed.
 *
 * Two live regions, not one, and the distinction is load-bearing: progress and
 * success are `role="status"` (polite — announced when the user is idle), while a
 * failure is `role="alert"` (assertive — interrupts). A failure that waits its
 * turn is a failure the admin walks away from, believing the file uploaded.
 *
 * Never a bare spinner. The bar is driven by real `XMLHttpRequest` upload
 * progress events, and when those reach 100% the label changes rather than the
 * bar sitting full — see `use-file-upload.ts` for what the number measures.
 */
function UploadStatusBanner({
  id,
  status,
  onDismiss,
}: {
  id: string;
  status: UploadPhase;
  onDismiss: () => void;
}) {
  if (status.phase === 'idle') {
    // Still rendered, and still empty: the live region must exist in the DOM
    // BEFORE it gains content, or assistive tech has nothing subscribed to
    // announce the first change.
    return <div id={id} role="status" aria-live="polite" className="sr-only" />;
  }

  if (status.phase === 'error') {
    return (
      <div
        id={id}
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-12 border border-gty-primary bg-gty-red-50 px-4 py-3 text-12-5 text-gty-primary"
      >
        <strong className="font-bold">Upload failed.</strong>
        <span>{status.message}</span>
        <span className="w-full text-gty-body">
          Nothing else on this form has been affected — fix the file and choose it again.
        </span>
        <Button type="button" size="sm" className="ml-auto" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (status.phase === 'success') {
    return (
      <div
        id={id}
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-12 border border-gty-green-border bg-gty-green-bg px-4 py-3 text-12-5 text-gty-green-text"
      >
        <span>{status.message}</span>
        <Button type="button" size="sm" className="ml-auto" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  const percent = status.phase === 'uploading' ? status.percent : 100;
  const batch =
    status.phase === 'uploading' || status.phase === 'finalising'
      ? status.total > 1
        ? ` (${status.index + 1} of ${status.total})`
        : ''
      : '';

  const label =
    status.phase === 'reading'
      ? `Checking ${status.fileName}…`
      : status.phase === 'finalising'
        ? `Sending ${status.fileName} to Cloudinary…${batch}`
        : `Uploading ${status.fileName}… ${percent}%${batch}`;

  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 text-gty-body"
    >
      <span>{label}</span>
      <progress
        value={status.phase === 'reading' ? undefined : percent}
        max={100}
        className="h-2 w-full overflow-hidden rounded-pill"
      >
        {percent}%
      </progress>
    </div>
  );
}
