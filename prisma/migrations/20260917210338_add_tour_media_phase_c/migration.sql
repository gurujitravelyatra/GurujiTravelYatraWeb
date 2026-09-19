-- Phase C — real file uploads (Cloudinary).
--
-- ENTIRELY ADDITIVE, and every new column is NULLABLE WITH NO BACKFILL. That is
-- the deliberate choice, not an omission: the 22 existing tours have no uploaded
-- cover, no gallery and no brochure PDF, so any value written here would be a
-- fabricated asset URL. NULL is the true answer and the readers already handle
-- it — `PhotoPlaceholder` for images, `status = PENDING_UPLOAD` for brochures.
--
-- Contrast the Phase B migration, which DID hand-write `UPDATE "Tour" SET status
-- = 'PUBLISHED'` because the column's safe default (DRAFT) was the wrong value
-- for rows that were already live. There is no equivalent here — "no image" is
-- both the safe default and the true state of every existing row.
--
-- Note what this does NOT do: make `coverImageUrl` NOT NULL. A cover image is
-- required to PUBLISH (enforced in `publishableTourSchema`), not required to
-- exist. Drafts are half-finished by definition, and a NOT NULL column would
-- make saving one impossible.

-- AlterTable
ALTER TABLE "Brochure" ADD COLUMN     "pdfFileName" TEXT,
ADD COLUMN     "pdfPublicId" TEXT;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "coverImagePublicId" TEXT,
ADD COLUMN     "coverImageUrl" TEXT;

-- CreateTable
CREATE TABLE "TourGalleryImage" (
    "id" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TourGalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourGalleryImage_tourSlug_idx" ON "TourGalleryImage"("tourSlug");

-- CreateIndex
CREATE UNIQUE INDEX "TourGalleryImage_tourSlug_sortOrder_key" ON "TourGalleryImage"("tourSlug", "sortOrder");

-- AddForeignKey
ALTER TABLE "TourGalleryImage" ADD CONSTRAINT "TourGalleryImage_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
