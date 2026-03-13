import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  RewardRedemptionStatus,
  RewardType,
  PointLedgerEntryType,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ContributionsService } from '../contributions/contributions.service';

const DEFAULT_REWARD_CATALOG: Array<{
  code: string;
  title: string;
  description: string;
  type: RewardType;
  pointsCost: number;
  metadata?: Prisma.InputJsonValue;
}> = [
  {
    code: 'voucher-rm5',
    title: 'RM5 Grocery Voucher',
    description: 'Mock grocery voucher for everyday supermarket purchases.',
    type: RewardType.VOUCHER,
    pointsCost: 60,
    metadata: { partner: 'ClariFi Market', faceValueRm: 5 },
  },
  {
    code: 'partner-discount-10',
    title: '10% Partner Discount',
    description: 'Mock partner discount on selected household items.',
    type: RewardType.PARTNER_DISCOUNT,
    pointsCost: 90,
    metadata: { partner: 'Household Partner', discountPct: 10 },
  },
  {
    code: 'exclusive-promo-early',
    title: 'Exclusive Promo Unlock',
    description: 'Early access to a limited mock promotion campaign.',
    type: RewardType.EXCLUSIVE_PROMOTION,
    pointsCost: 120,
    metadata: { promoCode: 'EARLY-ACCESS' },
  },
];

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contributionsService: ContributionsService,
  ) {}

  private async ensureCatalogSeeded() {
    await Promise.all(
      DEFAULT_REWARD_CATALOG.map((item) =>
        this.prisma.rewardCatalogItem.upsert({
          where: { code: item.code },
          update: {
            title: item.title,
            description: item.description,
            type: item.type,
            pointsCost: item.pointsCost,
            active: true,
            metadata: item.metadata,
          },
          create: {
            code: item.code,
            title: item.title,
            description: item.description,
            type: item.type,
            pointsCost: item.pointsCost,
            active: true,
            metadata: item.metadata,
          },
        }),
      ),
    );
  }

  async getSummary(user: AuthenticatedUser) {
    return this.contributionsService.getContributionSummaryForUser(user.id);
  }

  async listCatalog() {
    await this.ensureCatalogSeeded();
    const items = await this.prisma.rewardCatalogItem.findMany({
      where: {
        active: true,
      },
      orderBy: [{ pointsCost: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        title: item.title,
        description: item.description ?? null,
        type: item.type,
        pointsCost: item.pointsCost,
        active: item.active,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async listLedger(user: AuthenticatedUser, limit?: number) {
    const [balance, items] = await Promise.all([
      this.contributionsService.getPointsBalanceForUser(user.id),
      this.contributionsService.listPointLedgerEntries(user.id, limit ?? 25),
    ]);

    return {
      userId: user.id,
      balance,
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  async listRedemptions(user: AuthenticatedUser, limit?: number) {
    const items = await this.prisma.rewardRedemption.findMany({
      where: {
        userId: user.id,
      },
      include: {
        reward: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit ?? 25, 100),
    });

    return {
      userId: user.id,
      items: items.map((item) => ({
        id: item.id,
        rewardId: item.rewardId,
        rewardTitle: item.reward.title,
        rewardType: item.reward.type,
        pointsCost: item.pointsCost,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        fulfilledAt: item.fulfilledAt?.toISOString() ?? null,
        cancelledAt: item.cancelledAt?.toISOString() ?? null,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async redeem(user: AuthenticatedUser, rewardId: string) {
    await this.ensureCatalogSeeded();

    const result = await this.prisma.$transaction(async (tx) => {
      const reward = await tx.rewardCatalogItem.findUnique({
        where: {
          id: rewardId,
        },
      });

      if (!reward || !reward.active) {
        throw new NotFoundException('Reward not found.');
      }

      const balanceAggregate = await tx.pointLedgerEntry.aggregate({
        where: {
          userId: user.id,
        },
        _sum: {
          pointsDelta: true,
        },
      });

      const balance = balanceAggregate._sum.pointsDelta ?? 0;
      if (balance < reward.pointsCost) {
        throw new ForbiddenException(
          `You need ${reward.pointsCost} points to redeem this reward. Current balance: ${balance}.`,
        );
      }

      const now = new Date();
      const redemption = await tx.rewardRedemption.create({
        data: {
          userId: user.id,
          rewardId: reward.id,
          status: RewardRedemptionStatus.FULFILLED,
          pointsCost: reward.pointsCost,
          fulfilledAt: now,
          metadata: {
            mock: true,
            rewardCode: reward.code,
          } satisfies Prisma.InputJsonValue,
        },
        include: {
          reward: true,
        },
      });

      await tx.pointLedgerEntry.create({
        data: {
          userId: user.id,
          redemptionId: redemption.id,
          type: PointLedgerEntryType.REDEMPTION,
          pointsDelta: -reward.pointsCost,
          description: `Redeemed ${reward.title}`,
        },
      });

      return {
        redemption,
        remainingBalance: balance - reward.pointsCost,
      };
    });

    return {
      id: result.redemption.id,
      rewardId: result.redemption.rewardId,
      rewardTitle: result.redemption.reward.title,
      rewardType: result.redemption.reward.type,
      pointsCost: result.redemption.pointsCost,
      status: result.redemption.status,
      createdAt: result.redemption.createdAt.toISOString(),
      fulfilledAt: result.redemption.fulfilledAt?.toISOString() ?? null,
      cancelledAt: result.redemption.cancelledAt?.toISOString() ?? null,
      remainingBalance: result.remainingBalance,
      generatedAt: new Date().toISOString(),
    };
  }
}
