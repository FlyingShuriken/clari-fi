-- Phase 3A: family shared wallet + bill splitting foundations

-- Create enums
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
CREATE TYPE "FamilyMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "FamilyInviteStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE "SplitStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');
CREATE TYPE "SplitParticipantType" AS ENUM ('MEMBER', 'GUEST');
CREATE TYPE "SplitAllocationType" AS ENUM ('ITEM', 'SHARED_CHARGE');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED');

-- Family profile tables
CREATE TABLE "FamilyProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyMember" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "FamilyRole" NOT NULL DEFAULT 'VIEWER',
  "status" "FamilyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyInvite" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "usedByUserId" TEXT,
  "status" "FamilyInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- Split tables
CREATE TABLE "SplitSession" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "expenseId" TEXT,
  "title" TEXT,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MYR',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sharedCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "SplitStatus" NOT NULL DEFAULT 'DRAFT',
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SplitSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SplitParticipant" (
  "id" TEXT NOT NULL,
  "splitId" TEXT NOT NULL,
  "familyMemberId" TEXT,
  "type" "SplitParticipantType" NOT NULL DEFAULT 'MEMBER',
  "displayName" TEXT NOT NULL,
  "isPayer" BOOLEAN NOT NULL DEFAULT false,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SplitParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SplitAllocation" (
  "id" TEXT NOT NULL,
  "splitId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "expenseLineItemId" TEXT,
  "allocationType" "SplitAllocationType" NOT NULL DEFAULT 'ITEM',
  "lineItemLabel" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SplitAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SplitSettlement" (
  "id" TEXT NOT NULL,
  "splitId" TEXT NOT NULL,
  "fromParticipantId" TEXT NOT NULL,
  "toParticipantId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SplitSettlement_pkey" PRIMARY KEY ("id")
);

-- Expense family linkage
ALTER TABLE "Expense"
ADD COLUMN "familyId" TEXT;

-- Indexes
CREATE INDEX "FamilyProfile_createdByUserId_createdAt_idx" ON "FamilyProfile"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
CREATE INDEX "FamilyMember_userId_status_idx" ON "FamilyMember"("userId", "status");
CREATE INDEX "FamilyMember_familyId_status_idx" ON "FamilyMember"("familyId", "status");
CREATE UNIQUE INDEX "FamilyInvite_code_key" ON "FamilyInvite"("code");
CREATE INDEX "FamilyInvite_familyId_status_expiresAt_idx" ON "FamilyInvite"("familyId", "status", "expiresAt");
CREATE INDEX "FamilyInvite_createdByUserId_createdAt_idx" ON "FamilyInvite"("createdByUserId", "createdAt");
CREATE INDEX "SplitSession_familyId_status_createdAt_idx" ON "SplitSession"("familyId", "status", "createdAt");
CREATE INDEX "SplitSession_expenseId_idx" ON "SplitSession"("expenseId");
CREATE INDEX "SplitParticipant_splitId_idx" ON "SplitParticipant"("splitId");
CREATE INDEX "SplitParticipant_familyMemberId_idx" ON "SplitParticipant"("familyMemberId");
CREATE INDEX "SplitAllocation_splitId_participantId_idx" ON "SplitAllocation"("splitId", "participantId");
CREATE INDEX "SplitAllocation_expenseLineItemId_idx" ON "SplitAllocation"("expenseLineItemId");
CREATE INDEX "SplitSettlement_splitId_status_idx" ON "SplitSettlement"("splitId", "status");
CREATE INDEX "SplitSettlement_fromParticipantId_idx" ON "SplitSettlement"("fromParticipantId");
CREATE INDEX "SplitSettlement_toParticipantId_idx" ON "SplitSettlement"("toParticipantId");
CREATE INDEX "Expense_familyId_transactionAt_idx" ON "Expense"("familyId", "transactionAt");

-- Foreign keys
ALTER TABLE "FamilyProfile"
ADD CONSTRAINT "FamilyProfile_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyMember"
ADD CONSTRAINT "FamilyMember_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMember"
ADD CONSTRAINT "FamilyMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyInvite"
ADD CONSTRAINT "FamilyInvite_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyInvite"
ADD CONSTRAINT "FamilyInvite_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyInvite"
ADD CONSTRAINT "FamilyInvite_usedByUserId_fkey"
FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SplitSession"
ADD CONSTRAINT "SplitSession_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitSession"
ADD CONSTRAINT "SplitSession_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitSession"
ADD CONSTRAINT "SplitSession_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SplitParticipant"
ADD CONSTRAINT "SplitParticipant_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "SplitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitParticipant"
ADD CONSTRAINT "SplitParticipant_familyMemberId_fkey"
FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SplitAllocation"
ADD CONSTRAINT "SplitAllocation_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "SplitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitAllocation"
ADD CONSTRAINT "SplitAllocation_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitAllocation"
ADD CONSTRAINT "SplitAllocation_expenseLineItemId_fkey"
FOREIGN KEY ("expenseLineItemId") REFERENCES "ExpenseLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_splitId_fkey"
FOREIGN KEY ("splitId") REFERENCES "SplitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_fromParticipantId_fkey"
FOREIGN KEY ("fromParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SplitSettlement"
ADD CONSTRAINT "SplitSettlement_toParticipantId_fkey"
FOREIGN KEY ("toParticipantId") REFERENCES "SplitParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "FamilyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
