-- CreateEnum
CREATE TYPE "DestinationCategory" AS ENUM ('Spiritual', 'Mountains', 'Cultural', 'Family', 'Adventure', 'International', 'Beach', 'Himalaya', 'Family Trip', 'Pilgrimage');

-- CreateEnum
CREATE TYPE "BrochureStatus" AS ENUM ('PENDING_UPLOAD', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Destination" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "category" "DestinationCategory",
    "tagline" TEXT,
    "photoKey" TEXT NOT NULL,
    "photosCount" INTEGER,
    "isInternational" BOOLEAN NOT NULL DEFAULT false,
    "internationalOrder" INTEGER,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Tour" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "category" "DestinationCategory" NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "photosCount" INTEGER NOT NULL,
    "priceFrom" TEXT NOT NULL,
    "priceWas" TEXT,
    "savingsLabel" TEXT,
    "seatsLabel" TEXT,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "pricingUnverified" BOOLEAN NOT NULL DEFAULT false,
    "catalogueOrder" INTEGER NOT NULL,
    "popularOrder" INTEGER,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Rail" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Rail_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "RailTour" (
    "railSlug" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "RailTour_pkey" PRIMARY KEY ("railSlug","tourSlug")
);

-- CreateTable
CREATE TABLE "GroupDeparture" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "category" "DestinationCategory" NOT NULL,
    "photoKey" TEXT NOT NULL,
    "dateRangeLabel" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "boardingPoints" TEXT NOT NULL,
    "tourManagerLabel" TEXT NOT NULL,
    "priceFrom" TEXT NOT NULL,
    "seatsLabel" TEXT NOT NULL,
    "scriptAccent" TEXT NOT NULL,
    "durationUnverified" BOOLEAN NOT NULL DEFAULT false,
    "priceUnverified" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "GroupDeparture_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Brochure" (
    "id" TEXT NOT NULL,
    "tourSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itinerarySummary" TEXT NOT NULL,
    "priceLabel" TEXT,
    "dateRangeLabel" TEXT,
    "coverImageKey" TEXT NOT NULL,
    "category" "DestinationCategory" NOT NULL,
    "pdfUrl" TEXT,
    "status" "BrochureStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileSizeBytes" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brochure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Destination_name_key" ON "Destination"("name");

-- CreateIndex
CREATE INDEX "Destination_isInternational_internationalOrder_idx" ON "Destination"("isInternational", "internationalOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_name_key" ON "Tour"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_catalogueOrder_key" ON "Tour"("catalogueOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_popularOrder_key" ON "Tour"("popularOrder");

-- CreateIndex
CREATE INDEX "Tour_destinationSlug_idx" ON "Tour"("destinationSlug");

-- CreateIndex
CREATE INDEX "Tour_pricingUnverified_idx" ON "Tour"("pricingUnverified");

-- CreateIndex
CREATE UNIQUE INDEX "Rail_title_key" ON "Rail"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Rail_sortOrder_key" ON "Rail"("sortOrder");

-- CreateIndex
CREATE INDEX "RailTour_tourSlug_idx" ON "RailTour"("tourSlug");

-- CreateIndex
CREATE UNIQUE INDEX "RailTour_railSlug_sortOrder_key" ON "RailTour"("railSlug", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GroupDeparture_name_key" ON "GroupDeparture"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupDeparture_sortOrder_key" ON "GroupDeparture"("sortOrder");

-- CreateIndex
CREATE INDEX "GroupDeparture_destinationSlug_idx" ON "GroupDeparture"("destinationSlug");

-- CreateIndex
CREATE INDEX "GroupDeparture_month_idx" ON "GroupDeparture"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Brochure_tourSlug_key" ON "Brochure"("tourSlug");

-- CreateIndex
CREATE INDEX "Brochure_status_idx" ON "Brochure"("status");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_destinationSlug_fkey" FOREIGN KEY ("destinationSlug") REFERENCES "Destination"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailTour" ADD CONSTRAINT "RailTour_railSlug_fkey" FOREIGN KEY ("railSlug") REFERENCES "Rail"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RailTour" ADD CONSTRAINT "RailTour_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDeparture" ADD CONSTRAINT "GroupDeparture_destinationSlug_fkey" FOREIGN KEY ("destinationSlug") REFERENCES "Destination"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brochure" ADD CONSTRAINT "Brochure_tourSlug_fkey" FOREIGN KEY ("tourSlug") REFERENCES "Tour"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

