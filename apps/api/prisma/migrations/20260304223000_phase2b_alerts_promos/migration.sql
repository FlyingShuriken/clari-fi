-- Phase 2B: alerts + promo ingestion

CREATE TYPE "PromoReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ObservationSource" AS ENUM ('EXPENSE', 'PROMO');

CREATE TABLE "PriceAlert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "storeId" TEXT,
  "areaText" TEXT,
  "targetUnitPrice" DECIMAL(12,2) NOT NULL,
  "radiusKm" DECIMAL(7,2) NOT NULL DEFAULT 10,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertEvent" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "storeId" TEXT,
  "areaText" TEXT,
  "source" "ObservationSource" NOT NULL DEFAULT 'EXPENSE',
  "triggerUnitPrice" DECIMAL(12,2) NOT NULL,
  "targetUnitPrice" DECIMAL(12,2) NOT NULL,
  "distanceKm" DECIMAL(7,2),
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoIngestion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fileRef" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "merchantText" TEXT,
  "areaText" TEXT,
  "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "rawText" TEXT,
  "ocrRaw" JSONB,
  "parsedPayload" JSONB,
  "errorText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoIngestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoObservation" (
  "id" TEXT NOT NULL,
  "ingestionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "storeId" TEXT,
  "areaText" TEXT,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
  "quantity" DECIMAL(12,4),
  "unitRaw" TEXT,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "totalPrice" DECIMAL(12,2),
  "trustScore" DECIMAL(5,4) NOT NULL,
  "reviewStatus" "PromoReviewStatus" NOT NULL DEFAULT 'PENDING',
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceAlert_userId_active_idx" ON "PriceAlert"("userId", "active");
CREATE INDEX "PriceAlert_canonicalItemId_active_idx" ON "PriceAlert"("canonicalItemId", "active");
CREATE INDEX "PriceAlert_storeId_active_idx" ON "PriceAlert"("storeId", "active");

CREATE INDEX "AlertEvent_userId_triggeredAt_idx" ON "AlertEvent"("userId", "triggeredAt");
CREATE INDEX "AlertEvent_alertId_triggeredAt_idx" ON "AlertEvent"("alertId", "triggeredAt");
CREATE INDEX "AlertEvent_readAt_idx" ON "AlertEvent"("readAt");

CREATE INDEX "PromoIngestion_userId_createdAt_idx" ON "PromoIngestion"("userId", "createdAt");
CREATE INDEX "PromoIngestion_status_createdAt_idx" ON "PromoIngestion"("status", "createdAt");

CREATE INDEX "PromoObservation_canonicalItemId_observedAt_idx" ON "PromoObservation"("canonicalItemId", "observedAt");
CREATE INDEX "PromoObservation_reviewStatus_validFrom_validTo_idx" ON "PromoObservation"("reviewStatus", "validFrom", "validTo");
CREATE INDEX "PromoObservation_storeId_canonicalItemId_observedAt_idx" ON "PromoObservation"("storeId", "canonicalItemId", "observedAt");
CREATE INDEX "PromoObservation_areaText_canonicalItemId_observedAt_idx" ON "PromoObservation"("areaText", "canonicalItemId", "observedAt");

ALTER TABLE "PriceAlert"
ADD CONSTRAINT "PriceAlert_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PriceAlert_canonicalItemId_fkey"
FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "PriceAlert_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertEvent"
ADD CONSTRAINT "AlertEvent_alertId_fkey"
FOREIGN KEY ("alertId") REFERENCES "PriceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "AlertEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "AlertEvent_canonicalItemId_fkey"
FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "AlertEvent_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromoIngestion"
ADD CONSTRAINT "PromoIngestion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromoObservation"
ADD CONSTRAINT "PromoObservation_ingestionId_fkey"
FOREIGN KEY ("ingestionId") REFERENCES "PromoIngestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PromoObservation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PromoObservation_canonicalItemId_fkey"
FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "PromoObservation_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
