import { ForbiddenException } from '@nestjs/common';
import { RewardRedemptionStatus, RewardType } from '@prisma/client';
import { RewardsService } from '../src/modules/rewards/rewards.service';

describe('RewardsService', () => {
  function createService(overrides?: Partial<any>) {
    const tx = {
      rewardCatalogItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reward-1',
          code: 'voucher-rm5',
          title: 'RM5 Grocery Voucher',
          type: RewardType.VOUCHER,
          pointsCost: 60,
          active: true,
        }),
      },
      pointLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pointsDelta: 100 },
        }),
        create: jest.fn().mockResolvedValue({
          id: 'ledger-redemption-1',
        }),
      },
      rewardRedemption: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'redemption-1',
          rewardId: data.rewardId,
          pointsCost: data.pointsCost,
          status: data.status,
          createdAt: new Date('2026-03-13T12:00:00.000Z'),
          fulfilledAt: data.fulfilledAt ?? null,
          cancelledAt: null,
          reward: {
            id: data.rewardId,
            code: 'voucher-rm5',
            title: 'RM5 Grocery Voucher',
            type: RewardType.VOUCHER,
          },
        })),
      },
      ...overrides,
    };

    const prisma = {
      rewardCatalogItem: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'reward-1',
            code: 'voucher-rm5',
            title: 'RM5 Grocery Voucher',
            description: 'Mock grocery voucher',
            type: RewardType.VOUCHER,
            pointsCost: 60,
            active: true,
            createdAt: new Date('2026-03-13T10:00:00.000Z'),
          },
          {
            id: 'reward-2',
            code: 'partner-discount-10',
            title: '10% Partner Discount',
            description: 'Mock partner discount',
            type: RewardType.PARTNER_DISCOUNT,
            pointsCost: 90,
            active: true,
            createdAt: new Date('2026-03-13T11:00:00.000Z'),
          },
        ]),
      },
      rewardRedemption: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pointLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { pointsDelta: 100 },
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      ...overrides,
    } as any;

    const contributionsService = {
      getContributionSummaryForUser: jest.fn(),
      getPointsBalanceForUser: jest.fn().mockResolvedValue(100),
      listPointLedgerEntries: jest.fn().mockResolvedValue([]),
    } as any;

    const service = new RewardsService(prisma, contributionsService);
    return { service, prisma, tx };
  }

  it('seeds and returns the reward catalog', async () => {
    const { service, prisma } = createService();

    const result = await service.listCatalog();

    expect(prisma.rewardCatalogItem.upsert).toHaveBeenCalledTimes(3);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      code: 'voucher-rm5',
      pointsCost: 60,
    });
  });

  it('blocks redemption when the user does not have enough points', async () => {
    const { service } = createService({
      $transaction: jest.fn(async (callback: (client: any) => Promise<unknown>) =>
        callback({
          rewardCatalogItem: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'reward-2',
              code: 'partner-discount-10',
              title: '10% Partner Discount',
              type: RewardType.PARTNER_DISCOUNT,
              pointsCost: 90,
              active: true,
            }),
          },
          pointLedgerEntry: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { pointsDelta: 20 },
            }),
            create: jest.fn(),
          },
          rewardRedemption: {
            create: jest.fn(),
          },
        }),
      ),
    });

    await expect(
      service.redeem({ id: 'user-1' } as any, 'reward-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a fulfilled redemption and negative ledger entry', async () => {
    const { service, tx } = createService();

    const result = await service.redeem({ id: 'user-1' } as any, 'reward-1');

    expect(tx.rewardRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          rewardId: 'reward-1',
          status: RewardRedemptionStatus.FULFILLED,
          pointsCost: 60,
        }),
      }),
    );
    expect(tx.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        pointsDelta: -60,
      }),
    });
    expect(result).toMatchObject({
      rewardId: 'reward-1',
      pointsCost: 60,
      remainingBalance: 40,
    });
  });
});
