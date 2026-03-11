import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';

describe('SubscriptionsService', () => {
  const userId = 'user-1';

  it('returns free-tier limits by default', async () => {
    const prisma = {
      userSubscription: {
        upsert: jest.fn().mockResolvedValue({
          userId,
          plan: SubscriptionPlan.FREE,
          addonCount: 0,
        }),
      },
      subscriptionUsageMonth: {
        findUnique: jest.fn().mockResolvedValue({
          userId,
          periodKey: '2026-03',
          compareSearchCount: 4,
        }),
      },
      priceAlert: {
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;

    const service = new SubscriptionsService(prisma);
    const snapshot = await service.getEntitlementSnapshotForUser(userId);

    expect(snapshot.plan).toBe(SubscriptionPlan.FREE);
    expect(snapshot.addonCount).toBe(0);
    expect(snapshot.compare).toEqual({
      itemsPerSearch: 1,
      searchesPerMonth: 15,
      usedThisMonth: 4,
      remainingThisMonth: 11,
    });
    expect(snapshot.alerts).toEqual({
      activeLimit: 1,
      activeCount: 1,
      remainingActive: 0,
    });
    expect(snapshot.family.additionalMembersAllowed).toBe(1);
    expect(snapshot.pricing).toEqual({
      monthlyPriceRm: 0,
      addonUnitPriceRm: 1.99,
    });
  });

  it('applies premium addon limits cumulatively', async () => {
    const prisma = {
      userSubscription: {
        upsert: jest.fn().mockResolvedValue({
          userId,
          plan: SubscriptionPlan.PREMIUM,
          addonCount: 2,
        }),
      },
      subscriptionUsageMonth: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      priceAlert: {
        count: jest.fn().mockResolvedValue(3),
      },
    } as any;

    const service = new SubscriptionsService(prisma);
    const snapshot = await service.getEntitlementSnapshotForUser(userId);

    expect(snapshot.compare.itemsPerSearch).toBe(20);
    expect(snapshot.compare.searchesPerMonth).toBe(90);
    expect(snapshot.alerts.activeLimit).toBe(15);
    expect(snapshot.family.additionalMembersAllowed).toBe(4);
    expect(snapshot.pricing.monthlyPriceRm).toBe(5.99);
  });

  it('blocks compare searches above plan item limit', async () => {
    const prisma = {
      userSubscription: {
        upsert: jest.fn().mockResolvedValue({
          userId,
          plan: SubscriptionPlan.FREE,
          addonCount: 0,
        }),
      },
      subscriptionUsageMonth: {
        findUnique: jest.fn().mockResolvedValue({
          userId,
          periodKey: '2026-03',
          compareSearchCount: 0,
        }),
        upsert: jest.fn(),
      },
      priceAlert: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;

    const service = new SubscriptionsService(prisma);

    await expect(service.consumeCompareSearch(userId, 2)).rejects.toThrow(ForbiddenException);
    expect(prisma.subscriptionUsageMonth.upsert).not.toHaveBeenCalled();
  });

  it('blocks family growth when the owner is already at the plan limit', async () => {
    const prisma = {
      userSubscription: {
        upsert: jest.fn().mockResolvedValue({
          userId,
          plan: SubscriptionPlan.FREE,
          addonCount: 0,
        }),
      },
      subscriptionUsageMonth: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      priceAlert: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;

    const service = new SubscriptionsService(prisma);

    await expect(service.assertFamilyCapacity(userId, 2)).rejects.toThrow(
      'This family plan allows owner + 1 additional member(s). Upgrade to invite more people.',
    );
  });
});
