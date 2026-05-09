-- AlterEnum
ALTER TYPE "StoreProvider" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "isPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerKey" TEXT;

-- CreateTable
CREATE TABLE "PartnerPriceObservation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "canonicalItemId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "originalPrice" DECIMAL(12,2),
    "unit" TEXT,
    "category" TEXT,
    "sourceUrl" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerPriceObservation_canonicalItemId_scrapedAt_idx" ON "PartnerPriceObservation"("canonicalItemId", "scrapedAt");

-- CreateIndex
CREATE INDEX "PartnerPriceObservation_storeId_canonicalItemId_idx" ON "PartnerPriceObservation"("storeId", "canonicalItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPriceObservation_storeId_canonicalItemId_key" ON "PartnerPriceObservation"("storeId", "canonicalItemId");

-- CreateIndex
CREATE INDEX "Store_isPartner_idx" ON "Store"("isPartner");

-- AddForeignKey
ALTER TABLE "PartnerPriceObservation" ADD CONSTRAINT "PartnerPriceObservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPriceObservation" ADD CONSTRAINT "PartnerPriceObservation_canonicalItemId_fkey" FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
