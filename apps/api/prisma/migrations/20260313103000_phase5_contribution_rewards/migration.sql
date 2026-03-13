-- Phase 5: contribution rewards foundation

CREATE TYPE "ContributionKind" AS ENUM ('RECEIPT', 'FLYER');
CREATE TYPE "ContributionAcceptanceStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'DUPLICATE', 'CAPPED');
CREATE TYPE "PointLedgerEntryType" AS ENUM ('RECEIPT_ACCEPTED', 'FLYER_ACCEPTED', 'STREAK_BONUS', 'REDEMPTION');
CREATE TYPE "RewardType" AS ENUM ('VOUCHER', 'PARTNER_DISCOUNT', 'EXCLUSIVE_PROMOTION');
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "ContributionSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "ContributionKind" NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "receiptId" TEXT,
  "promoIngestionId" TEXT,
  "structuredItemCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContributionSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContributionAcceptance" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ContributionAcceptanceStatus" NOT NULL,
  "reasonCode" TEXT,
  "basePoints" INTEGER NOT NULL DEFAULT 0,
  "bonusPoints" INTEGER NOT NULL DEFAULT 0,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "streakDays" INTEGER NOT NULL DEFAULT 0,
  "acceptedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContributionAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointLedgerEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "acceptanceId" TEXT,
  "redemptionId" TEXT,
  "type" "PointLedgerEntryType" NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PointLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardCatalogItem" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "RewardType" NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RewardCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "pointsCost" INTEGER NOT NULL,
  "metadata" JSONB,
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionSubmission_kind_sourceRef_key" ON "ContributionSubmission"("kind", "sourceRef");
CREATE UNIQUE INDEX "ContributionSubmission_receiptId_key" ON "ContributionSubmission"("receiptId");
CREATE UNIQUE INDEX "ContributionSubmission_promoIngestionId_key" ON "ContributionSubmission"("promoIngestionId");
CREATE INDEX "ContributionSubmission_userId_createdAt_idx" ON "ContributionSubmission"("userId", "createdAt");
CREATE INDEX "ContributionSubmission_kind_fingerprint_idx" ON "ContributionSubmission"("kind", "fingerprint");

CREATE UNIQUE INDEX "ContributionAcceptance_submissionId_key" ON "ContributionAcceptance"("submissionId");
CREATE INDEX "ContributionAcceptance_userId_createdAt_idx" ON "ContributionAcceptance"("userId", "createdAt");
CREATE INDEX "ContributionAcceptance_userId_status_acceptedAt_idx" ON "ContributionAcceptance"("userId", "status", "acceptedAt");

CREATE INDEX "PointLedgerEntry_userId_createdAt_idx" ON "PointLedgerEntry"("userId", "createdAt");
CREATE INDEX "PointLedgerEntry_acceptanceId_idx" ON "PointLedgerEntry"("acceptanceId");
CREATE INDEX "PointLedgerEntry_redemptionId_idx" ON "PointLedgerEntry"("redemptionId");

CREATE UNIQUE INDEX "RewardCatalogItem_code_key" ON "RewardCatalogItem"("code");
CREATE INDEX "RewardCatalogItem_active_type_idx" ON "RewardCatalogItem"("active", "type");

CREATE INDEX "RewardRedemption_userId_createdAt_idx" ON "RewardRedemption"("userId", "createdAt");
CREATE INDEX "RewardRedemption_status_createdAt_idx" ON "RewardRedemption"("status", "createdAt");

ALTER TABLE "ContributionSubmission"
ADD CONSTRAINT "ContributionSubmission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContributionSubmission"
ADD CONSTRAINT "ContributionSubmission_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContributionSubmission"
ADD CONSTRAINT "ContributionSubmission_promoIngestionId_fkey"
FOREIGN KEY ("promoIngestionId") REFERENCES "PromoIngestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContributionAcceptance"
ADD CONSTRAINT "ContributionAcceptance_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "ContributionSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContributionAcceptance"
ADD CONSTRAINT "ContributionAcceptance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointLedgerEntry"
ADD CONSTRAINT "PointLedgerEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PointLedgerEntry"
ADD CONSTRAINT "PointLedgerEntry_acceptanceId_fkey"
FOREIGN KEY ("acceptanceId") REFERENCES "ContributionAcceptance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RewardRedemption"
ADD CONSTRAINT "RewardRedemption_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RewardRedemption"
ADD CONSTRAINT "RewardRedemption_rewardId_fkey"
FOREIGN KEY ("rewardId") REFERENCES "RewardCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointLedgerEntry"
ADD CONSTRAINT "PointLedgerEntry_redemptionId_fkey"
FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
