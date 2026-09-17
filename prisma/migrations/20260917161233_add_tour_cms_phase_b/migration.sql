-- Phase B of the admin CMS — tour management (status/archive, audience tags,
-- descriptions, itinerary, FAQs, pricing tiers, and the GroupDeparture→Tour link).
--
-- TWO STATEMENTS IN THIS FILE WERE ADDED BY HAND. Prisma generated everything
-- else. Both are backfills for columns being added to a table that already holds
-- 22 live tours, and both are called out where they appear.

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TourAudienceTag" AS ENUM ('Domestic', 'International', 'Group Tour', 'Custom-eligible');

-- AlterTable
ALTER TABLE "GroupDeparture" ADD COLUMN     "tourSlug" TEXT;

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "audienceTags" "TourAudienceTag"[],
ADD COLUMN     "bestTimeToVisit" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "exclusions" TEXT[],
ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "inclusions" TEXT[],
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- HAND-WRITTEN BACKFILL 1 — and the most important statement in this file.
--
-- `status` is declared `DEFAULT 'DRAFT'`, which is the correct default for every
-- row created FROM NOW ON: a tour that nobody has finished must not be
-- accidentally live. But applied to the 22 rows that already exist, that default
-- is catastrophically wrong — those tours ARE the live public catalogue, and
-- leaving them at the column default would take the entire site's tour content
-- dark the moment this migration ran. Home's rails, /tour-packages, every
-- /tour-packages/[slug], /api/tours and generateStaticParams() all resolve
-- through `isPubliclyListable()`, which as of this change requires PUBLISHED.
--
-- Every pre-existing row was publicly listed before this migration, so PUBLISHED
-- is the value that PRESERVES their observable state rather than changing it.
-- This is a one-time statement about rows that predate the column; the DRAFT
-- default is untouched and still governs every future insert.
-- ----------------------------------------------------------------------------
UPDATE "Tour" SET "status" = 'PUBLISHED';

-- ----------------------------------------------------------------------------
-- HAND-WRITTEN BACKFILL 2 — honesty about a timestamp we do not have.
--
-- `createdAt`/`updatedAt` backfill to CURRENT_TIMESTAMP via the column defaults
-- above. That is NOT when these 22 tours were authored — they were transcribed
-- from the design export and seeded, and no record of either moment survives.
-- The migration time is an UPPER BOUND on "last updated", not a fact about it.
--
-- `updatedAt` is therefore reset to `createdAt` here purely so the two agree on
-- day one (a row that reads "created and updated at the same instant" is the
-- honest description of a row nobody has edited), and the admin list's "Last
-- updated" column shows this date until someone makes a real edit, which
-- replaces it with a real timestamp.
-- ----------------------------------------------------------------------------
UPDATE "Tour" SET "updatedAt" = "createdAt";

-- CreateTable
CREATE TABLE "TourItineraryDay" (
    "id" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "TourItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourFaq" (
    "id" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TourFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourPricingTier" (
    "id" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TourPricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourItineraryDay_tourSlug_idx" ON "TourItineraryDay"("tourSlug");

-- CreateIndex
CREATE UNIQUE INDEX "TourItineraryDay_tourSlug_dayNumber_key" ON "TourItineraryDay"("tourSlug", "dayNumber");

-- CreateIndex
CREATE INDEX "TourFaq_tourSlug_idx" ON "TourFaq"("tourSlug");

-- CreateIndex
CREATE UNIQUE INDEX "TourFaq_tourSlug_sortOrder_key" ON "TourFaq"("tourSlug", "sortOrder");

-- CreateIndex
CREATE INDEX "TourPricingTier_tourSlug_idx" ON "TourPricingTier"("tourSlug");

-- CreateIndex
CREATE UNIQUE INDEX "TourPricingTier_tourSlug_sortOrder_key" ON "TourPricingTier"("tourSlug", "sortOrder");

-- CreateIndex
CREATE INDEX "GroupDeparture_tourSlug_idx" ON "GroupDeparture"("tourSlug");

-- CreateIndex
CREATE INDEX "Tour_status_archivedAt_idx" ON "Tour"("status", "archivedAt");

-- AddForeignKey
ALTER TABLE "TourItineraryDay" ADD CONSTRAINT "TourItineraryDay_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourFaq" ADD CONSTRAINT "TourFaq_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourPricingTier" ADD CONSTRAINT "TourPricingTier_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDeparture" ADD CONSTRAINT "GroupDeparture_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
