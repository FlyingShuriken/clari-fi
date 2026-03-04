-- Phase 2: price intelligence schema

CREATE TYPE "StoreProvider" AS ENUM ('OSM_NOMINATIM');

ALTER TABLE "Expense"
ADD COLUMN "locationLat" DECIMAL(10,7),
ADD COLUMN "locationLng" DECIMAL(10,7),
ADD COLUMN "areaText" TEXT;

CREATE TABLE "CanonicalItem" (
  "id" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "canonicalUnit" TEXT,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanonicalItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemAlias" (
  "id" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "aliasText" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'und',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItemAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "provider" "StoreProvider" NOT NULL DEFAULT 'OSM_NOMINATIM',
  "providerPlaceId" TEXT,
  "lat" DECIMAL(10,7),
  "lng" DECIMAL(10,7),
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceObservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "expenseLineItemId" TEXT NOT NULL,
  "canonicalItemId" TEXT NOT NULL,
  "storeId" TEXT,
  "areaText" TEXT,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
  "quantity" DECIMAL(12,4),
  "unitRaw" TEXT,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "totalPrice" DECIMAL(12,2) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "provenance" "ExpenseProvenance" NOT NULL,
  "trustScore" DECIMAL(5,4) NOT NULL,
  "outlierFlag" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanonicalItem_canonicalName_key" ON "CanonicalItem"("canonicalName");
CREATE UNIQUE INDEX "ItemAlias_aliasText_locale_key" ON "ItemAlias"("aliasText", "locale");
CREATE INDEX "ItemAlias_canonicalItemId_idx" ON "ItemAlias"("canonicalItemId");
CREATE UNIQUE INDEX "Store_provider_providerPlaceId_key" ON "Store"("provider", "providerPlaceId");
CREATE INDEX "Store_normalizedName_idx" ON "Store"("normalizedName");
CREATE UNIQUE INDEX "PriceObservation_expenseLineItemId_key" ON "PriceObservation"("expenseLineItemId");
CREATE INDEX "PriceObservation_canonicalItemId_observedAt_idx" ON "PriceObservation"("canonicalItemId", "observedAt");
CREATE INDEX "PriceObservation_storeId_canonicalItemId_observedAt_idx" ON "PriceObservation"("storeId", "canonicalItemId", "observedAt");
CREATE INDEX "PriceObservation_areaText_canonicalItemId_observedAt_idx" ON "PriceObservation"("areaText", "canonicalItemId", "observedAt");

ALTER TABLE "ItemAlias"
ADD CONSTRAINT "ItemAlias_canonicalItemId_fkey"
FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceObservation"
ADD CONSTRAINT "PriceObservation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PriceObservation_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PriceObservation_expenseLineItemId_fkey"
FOREIGN KEY ("expenseLineItemId") REFERENCES "ExpenseLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "PriceObservation_canonicalItemId_fkey"
FOREIGN KEY ("canonicalItemId") REFERENCES "CanonicalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "PriceObservation_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
