import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  ContributionAcceptanceStatus,
  ContributionKind,
  PointLedgerEntryType,
  Prisma,
} from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ContributionStreaksService,
} from './contribution-streaks.service';

const RECEIPT_BASE_POINTS = 8;
const FLYER_BASE_POINTS = 10;
const DAILY_POINTS_CAP = 40;

interface ContributionLineItemInput {
  descriptionRaw?: string | null;
  totalPrice?: number | null;
}

interface ReceiptContributionInput {
  userId: string;
  expenseId: string;
  receiptId?: string;
  fileRef: string;
  merchantText?: string | null;
  transactionAt: Date;
  totalAmount: number;
  currency: string;
  lineItems: ContributionLineItemInput[];
}

interface FlyerContributionInput {
  userId: string;
  promoIngestionId: string;
  fileRefs: string[];
  merchantText?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  currency: string;
  lineItems: ContributionLineItemInput[];
}

export interface ContributionAwardResult {
  submissionId: string;
  acceptanceId: string;
  kind: ContributionKind;
  status: ContributionAcceptanceStatus;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  streakDays: number;
  reasonCode?: string | null;
}

export interface ContributionSummarySnapshot {
  userId: string;
  balance: number;
  currentStreakDays: number;
  lastAcceptedAt: string | null;
  generatedAt: string;
}

type RecordContributionArgs = {
  userId: string;
  kind: ContributionKind;
  sourceRef: string;
  basePoints: number;
  fingerprint: string;
  structuredItemCount: number;
  metadata?: Prisma.InputJsonValue;
  receiptId?: string;
  promoIngestionId?: string;
};

function normalizeLooseText(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function createFingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function countStructuredLineItems(lineItems: ContributionLineItemInput[]): number {
  return lineItems.filter((item) => {
    const description = item.descriptionRaw?.trim();
    const totalPrice = typeof item.totalPrice === 'number' ? item.totalPrice : 0;
    return Boolean(description) && totalPrice > 0;
  }).length;
}

function dayBoundsUtc(at: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly streaksService: ContributionStreaksService,
  ) {}

  async recordAcceptedReceiptContribution(
    input: ReceiptContributionInput,
  ): Promise<ContributionAwardResult> {
    const fingerprint = createFingerprint({
      kind: ContributionKind.RECEIPT,
      fileRef: input.fileRef,
      merchantText: normalizeLooseText(input.merchantText),
      transactionDay: input.transactionAt.toISOString().slice(0, 10),
      totalAmount: input.totalAmount.toFixed(2),
      currency: input.currency,
      lineItems: input.lineItems
        .map((item) => ({
          descriptionRaw: normalizeLooseText(item.descriptionRaw),
          totalPrice:
            typeof item.totalPrice === 'number' ? Number(item.totalPrice.toFixed(2)) : null,
        }))
        .filter((item) => item.descriptionRaw && item.totalPrice && item.totalPrice > 0)
        .sort((left, right) => left.descriptionRaw.localeCompare(right.descriptionRaw)),
    });

    return this.recordContribution({
      userId: input.userId,
      kind: ContributionKind.RECEIPT,
      sourceRef: input.expenseId,
      receiptId: input.receiptId,
      basePoints: RECEIPT_BASE_POINTS,
      fingerprint,
      structuredItemCount: countStructuredLineItems(input.lineItems),
      metadata: {
        fileRef: input.fileRef,
        merchantText: input.merchantText ?? null,
        transactionAt: input.transactionAt.toISOString(),
        totalAmount: input.totalAmount,
        currency: input.currency,
      } satisfies Prisma.InputJsonValue,
    });
  }

  async recordAcceptedFlyerContribution(
    input: FlyerContributionInput,
  ): Promise<ContributionAwardResult> {
    const fingerprint = createFingerprint({
      kind: ContributionKind.FLYER,
      merchantText: normalizeLooseText(input.merchantText),
      validFrom: input.validFrom?.toISOString().slice(0, 10) ?? null,
      validTo: input.validTo?.toISOString().slice(0, 10) ?? null,
      currency: input.currency,
      lineItems: input.lineItems
        .map((item) => ({
          descriptionRaw: normalizeLooseText(item.descriptionRaw),
          totalPrice:
            typeof item.totalPrice === 'number' ? Number(item.totalPrice.toFixed(2)) : null,
        }))
        .filter((item) => item.descriptionRaw && item.totalPrice && item.totalPrice > 0)
        .sort((left, right) => left.descriptionRaw.localeCompare(right.descriptionRaw)),
    });

    return this.recordContribution({
      userId: input.userId,
      kind: ContributionKind.FLYER,
      sourceRef: input.promoIngestionId,
      promoIngestionId: input.promoIngestionId,
      basePoints: FLYER_BASE_POINTS,
      fingerprint,
      structuredItemCount: countStructuredLineItems(input.lineItems),
      metadata: {
        fileRefs: input.fileRefs,
        merchantText: input.merchantText ?? null,
        validFrom: input.validFrom?.toISOString() ?? null,
        validTo: input.validTo?.toISOString() ?? null,
        currency: input.currency,
      } satisfies Prisma.InputJsonValue,
    });
  }

  async getPointsBalanceForUser(userId: string): Promise<number> {
    const aggregate = await this.prisma.pointLedgerEntry.aggregate({
      where: {
        userId,
      },
      _sum: {
        pointsDelta: true,
      },
    });

    return aggregate._sum.pointsDelta ?? 0;
  }

  async getContributionSummaryForUser(userId: string): Promise<ContributionSummarySnapshot> {
    const [balance, accepted] = await Promise.all([
      this.getPointsBalanceForUser(userId),
      this.prisma.contributionAcceptance.findMany({
        where: {
          userId,
          acceptedAt: {
            not: null,
          },
          status: {
            in: [
              ContributionAcceptanceStatus.ACCEPTED,
              ContributionAcceptanceStatus.CAPPED,
            ],
          },
        },
        select: {
          acceptedAt: true,
        },
        orderBy: {
          acceptedAt: 'desc',
        },
      }),
    ]);

    const acceptedDates = accepted
      .map((entry) => entry.acceptedAt)
      .filter((value): value is Date => value instanceof Date);
    const streakDecision = this.streaksService.computeDecisionFromAcceptedDates(acceptedDates);

    return {
      userId,
      balance,
      currentStreakDays: acceptedDates.length > 0 ? streakDecision.streakDays : 0,
      lastAcceptedAt: acceptedDates[0]?.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  async listPointLedgerEntries(userId: string, limit = 25) {
    const items = await this.prisma.pointLedgerEntry.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 100),
    });

    return items.map((entry) => ({
      id: entry.id,
      type: entry.type,
      pointsDelta: entry.pointsDelta,
      description: entry.description ?? null,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  private async recordContribution(
    args: RecordContributionArgs,
  ): Promise<ContributionAwardResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.contributionSubmission.findUnique({
        where: {
          kind_sourceRef: {
            kind: args.kind,
            sourceRef: args.sourceRef,
          },
        },
        include: {
          acceptance: true,
        },
      });

      if (existing?.acceptance) {
        return this.mapAcceptance(args.kind, existing.acceptance);
      }

      const submission =
        existing ??
        (await tx.contributionSubmission.create({
          data: {
            userId: args.userId,
            kind: args.kind,
            sourceRef: args.sourceRef,
            fingerprint: args.fingerprint,
            receiptId: args.receiptId,
            promoIngestionId: args.promoIngestionId,
            structuredItemCount: args.structuredItemCount,
            metadata: args.metadata,
          },
        }));

      if (args.structuredItemCount < 1) {
        return this.createAcceptance(tx, {
          submissionId: submission.id,
          userId: args.userId,
          kind: args.kind,
          status: ContributionAcceptanceStatus.REJECTED,
          reasonCode: 'LOW_VALUE_CONTRIBUTION',
          basePoints: args.basePoints,
          bonusPoints: 0,
          totalPoints: 0,
          streakDays: 0,
        });
      }

      const duplicate = await tx.contributionSubmission.findFirst({
        where: {
          kind: args.kind,
          fingerprint: args.fingerprint,
          id: {
            not: submission.id,
          },
          acceptance: {
            status: {
              in: [
                ContributionAcceptanceStatus.ACCEPTED,
                ContributionAcceptanceStatus.CAPPED,
              ],
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return this.createAcceptance(tx, {
          submissionId: submission.id,
          userId: args.userId,
          kind: args.kind,
          status: ContributionAcceptanceStatus.DUPLICATE,
          reasonCode: 'DUPLICATE_FINGERPRINT',
          basePoints: args.basePoints,
          bonusPoints: 0,
          totalPoints: 0,
          streakDays: 0,
        });
      }

      const now = new Date();
      const earnedToday = await this.getAwardedPointsForDay(tx, args.userId, now);
      const remainingToday = DAILY_POINTS_CAP - earnedToday;

      if (remainingToday < args.basePoints) {
        const cappedDecision = await this.streaksService.computeStreakAward(tx, args.userId, now);
        return this.createAcceptance(tx, {
          submissionId: submission.id,
          userId: args.userId,
          kind: args.kind,
          status: ContributionAcceptanceStatus.CAPPED,
          reasonCode: 'DAILY_POINTS_CAP_REACHED',
          basePoints: args.basePoints,
          bonusPoints: 0,
          totalPoints: 0,
          streakDays: cappedDecision.streakDays,
          acceptedAt: now,
        });
      }

      const streakDecision = await this.streaksService.computeStreakAward(tx, args.userId, now);
      const bonusPoints =
        remainingToday >= args.basePoints + streakDecision.bonusPoints
          ? streakDecision.bonusPoints
          : 0;

      const acceptance = await this.createAcceptance(tx, {
        submissionId: submission.id,
        userId: args.userId,
        kind: args.kind,
        status: ContributionAcceptanceStatus.ACCEPTED,
        reasonCode: null,
        basePoints: args.basePoints,
        bonusPoints,
        totalPoints: args.basePoints + bonusPoints,
        streakDays: streakDecision.streakDays,
        acceptedAt: now,
      });

      const ledgerEntries: Prisma.PointLedgerEntryCreateManyInput[] = [
        {
          userId: args.userId,
          acceptanceId: acceptance.acceptanceId,
          type:
            args.kind === ContributionKind.RECEIPT
              ? PointLedgerEntryType.RECEIPT_ACCEPTED
              : PointLedgerEntryType.FLYER_ACCEPTED,
          pointsDelta: args.basePoints,
          description:
            args.kind === ContributionKind.RECEIPT
              ? 'Accepted receipt contribution'
              : 'Accepted flyer contribution',
        },
      ];

      if (bonusPoints > 0) {
        ledgerEntries.push({
          userId: args.userId,
          acceptanceId: acceptance.acceptanceId,
          type: PointLedgerEntryType.STREAK_BONUS,
          pointsDelta: bonusPoints,
          description: `${acceptance.streakDays}-day contribution streak bonus`,
        });
      }

      await tx.pointLedgerEntry.createMany({
        data: ledgerEntries,
      });

      return acceptance;
    });

    this.metrics.trackCounter('contributions.acceptance.count', 1, {
      kind: result.kind,
      status: result.status,
      reasonCode: result.reasonCode ?? 'none',
      points: String(result.totalPoints),
      userId: args.userId,
    });

    return result;
  }

  private async getAwardedPointsForDay(
    tx: Prisma.TransactionClient,
    userId: string,
    at: Date,
  ): Promise<number> {
    const { start, end } = dayBoundsUtc(at);
    const aggregate = await tx.pointLedgerEntry.aggregate({
      where: {
        userId,
        createdAt: {
          gte: start,
          lt: end,
        },
        pointsDelta: {
          gt: 0,
        },
      },
      _sum: {
        pointsDelta: true,
      },
    });

    return aggregate._sum.pointsDelta ?? 0;
  }

  private async createAcceptance(
    tx: Prisma.TransactionClient,
    input: {
      submissionId: string;
      userId: string;
      kind: ContributionKind;
      status: ContributionAcceptanceStatus;
      reasonCode: string | null;
      basePoints: number;
      bonusPoints: number;
      totalPoints: number;
      streakDays: number;
      acceptedAt?: Date;
    },
  ): Promise<ContributionAwardResult> {
    const acceptance = await tx.contributionAcceptance.create({
      data: {
        submissionId: input.submissionId,
        userId: input.userId,
        status: input.status,
        reasonCode: input.reasonCode ?? undefined,
        basePoints: input.basePoints,
        bonusPoints: input.bonusPoints,
        totalPoints: input.totalPoints,
        streakDays: input.streakDays,
        acceptedAt: input.acceptedAt,
      },
    });

    return this.mapAcceptance(input.kind, acceptance);
  }

  private mapAcceptance(
    kind: ContributionKind,
    acceptance: {
      id: string;
      submissionId: string;
      status: ContributionAcceptanceStatus;
      basePoints: number;
      bonusPoints: number;
      totalPoints: number;
      streakDays: number;
      reasonCode: string | null;
    },
  ): ContributionAwardResult {
    return {
      submissionId: acceptance.submissionId,
      acceptanceId: acceptance.id,
      kind,
      status: acceptance.status,
      basePoints: acceptance.basePoints,
      bonusPoints: acceptance.bonusPoints,
      totalPoints: acceptance.totalPoints,
      streakDays: acceptance.streakDays,
      reasonCode: acceptance.reasonCode,
    };
  }
}
