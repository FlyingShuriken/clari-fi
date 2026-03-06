-- Phase 3B.2: signal alert subscriptions and signal event tracking

CREATE TYPE "AlertKind" AS ENUM ('THRESHOLD', 'SIGNAL');
CREATE TYPE "SignalDecisionFilter" AS ENUM ('BUY_NOW', 'WAIT', 'BOTH');

ALTER TABLE "PriceAlert"
ADD COLUMN "kind" "AlertKind" NOT NULL DEFAULT 'THRESHOLD',
ADD COLUMN "signalDecisionFilter" "SignalDecisionFilter",
ADD COLUMN "signalMinConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.65,
ADD COLUMN "signalCooldownMinutes" INTEGER NOT NULL DEFAULT 360;

ALTER TABLE "PriceAlert"
ALTER COLUMN "targetUnitPrice" DROP NOT NULL;

ALTER TABLE "AlertEvent"
ADD COLUMN "eventKind" "AlertKind" NOT NULL DEFAULT 'THRESHOLD';

ALTER TABLE "AlertEvent"
ALTER COLUMN "targetUnitPrice" DROP NOT NULL;

CREATE INDEX "PriceAlert_kind_active_idx" ON "PriceAlert"("kind", "active");
CREATE INDEX "AlertEvent_eventKind_triggeredAt_idx" ON "AlertEvent"("eventKind", "triggeredAt");
