'use client';

import { Label } from '@/components/ui/label';

/**
 * Cover image, gallery and brochure inputs — DELIBERATELY NOT CONNECTED.
 *
 * ## Why this ships disabled rather than not at all, or worse, working-looking
 *
 * File upload is Phase C (Cloudinary). This phase builds the surface so that
 * phase wires a call rather than designing a screen — but a file input that
 * accepts a file and silently drops it is the worst of the three options: the
 * admin would believe the image was saved, and would find out when the tour went
 * live without one.
 *
 * So the inputs are `disabled`, the state is stated in words next to them, and
 * nothing here is registered with React Hook Form — the form's payload has no
 * image fields, and `Tour` has no image columns yet, both on purpose. A column
 * nothing writes and a field nothing reads are precisely the "flag that exists
 * and does nothing" shape `memory/feedback_qg_unenforced-safety-flag.md`
 * records five occurrences of; Phase C adds the columns together with the code
 * that fills them.
 *
 * The honesty pattern is the one the brochure records already use: `pdfUrl` is
 * NULL and `status` is `PENDING_UPLOAD`, rather than a synthesised path that
 * 404s. An absent capability that says so beats a plausible-looking stub.
 *
 * **Publishing does NOT require any of these** (see `publishableTourSchema`):
 * gating publish on a field the system cannot yet accept would make publishing
 * impossible. A tour with no cover renders the same token-coloured
 * `PhotoPlaceholder` every tour on the site renders today.
 */
export function TourUploadsSection() {
  return (
    <fieldset
      disabled
      className="flex flex-col gap-5 rounded-18 border border-dashed border-gty-border-9 bg-gty-bg p-5"
    >
      <legend className="px-2 text-13-5 font-extrabold text-gty-ink">Images &amp; brochure</legend>

      <p className="rounded-12 border border-gty-border-9 bg-gty-white px-4 py-3 text-12-5 leading-relaxed text-gty-body">
        <strong className="font-bold text-gty-ink">Not connected yet.</strong> File uploads are the next
        phase of this work. These controls are disabled rather than hidden so the fields are visible, but
        nothing you choose here would be stored — tours currently render a placeholder image everywhere on
        the site. You can still save and publish a tour without them.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tour-cover-image">Cover image</Label>
        <input
          id="tour-cover-image"
          type="file"
          accept="image/*"
          aria-describedby="tour-uploads-state"
          className="text-13 text-gty-faint file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tour-gallery">Gallery images</Label>
        <input
          id="tour-gallery"
          type="file"
          accept="image/*"
          multiple
          aria-describedby="tour-uploads-state"
          className="text-13 text-gty-faint file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tour-brochure">Brochure PDF</Label>
        <input
          id="tour-brochure"
          type="file"
          accept="application/pdf"
          aria-describedby="tour-uploads-state"
          className="text-13 text-gty-faint file:mr-3 file:rounded-pill file:border file:border-gty-border-9 file:bg-gty-white file:px-4 file:py-2 file:text-11-5 file:font-bold file:text-gty-ink"
        />
      </div>

      {/*
        One shared explanation, referenced by all three inputs. `disabled` alone
        is not an explanation — a screen-reader user hears "dimmed" and not why,
        which is the same "marker that does not reach assistive tech" defect the
        stats footnotes were fixed for.
      */}
      <p id="tour-uploads-state" className="text-12 text-gty-subtle">
        Disabled until file uploads are built. Nothing selected here is saved.
      </p>
    </fieldset>
  );
}
