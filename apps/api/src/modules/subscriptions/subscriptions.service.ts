import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionPlan } from '@prisma/client';
import { UpdateMockSubscriptionDto } from './dto/update-mock-subscription.dto';

export interface EntitlementSnapshot {
  plan: SubscriptionPlan;
  addonCount: number;
  compare: {
    itemsPerSearch: number;
    searchesPerMonth: number;
    usedThisMonth: number;
    remainingThisMonth: number;
  };
  alerts: {
    activeLimit: number;
    activeCount: number;
    remainingActive: number;
  };
  family: {
    additionalMembersAllowed: number;
  };
  pricing: {
    monthlyPriceRm: number;
    addonUnitPriceRm: number;
  };
  periodKey: string;
}

function currentPeriodKeyUtc(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
}

function computeBaseLimits(plan: SubscriptionPlan, addonCount: number) {
  if (plan === SubscriptionPlan.PREMIUM) {
    return {
      itemsPerSearch: 10 + addonCount * 5,
      searchesPerMonth: 30 + addonCount * 30,
      activeAlerts: 5 + addonCount * 5,
      additionalMembers: 2 + addonCount,
      monthlyPriceRm: 5.99,
    };
  }

  return {
    itemsPerSearch: 1,
    searchesPerMonth: 15,
    activeAlerts: 1,
    additionalMembers: 1,
    monthlyPriceRm: 0,
  };
}

@Injectable()
export class SubscriptionsService {
  private static readonly ADDON_PRICE_RM = 1.99;

  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate(userId: string) {
    return this.prisma.userSubscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        plan: SubscriptionPlan.FREE,
        addonCount: 0,
      },
    });
  }

  private async getUsage(userId: string, periodKey: string) {
    return this.prisma.subscriptionUsageMonth.findUnique({
      where: {
        userId_periodKey: {
          userId,
          periodKey,
        },
      },
    });
  }

  async getEntitlementSnapshotForUser(userId: string): Promise<EntitlementSnapshot> {
    const subscription = await this.getOrCreate(userId);
    const periodKey = currentPeriodKeyUtc();
    const [usage, activeAlertCount] = await Promise.all([
      this.getUsage(userId, periodKey),
      this.prisma.priceAlert.count({
        where: {
          userId,
          active: true,
        },
      }),
    ]);

    const base = computeBaseLimits(subscription.plan, subscription.addonCount);
    const usedThisMonth = usage?.compareSearchCount ?? 0;

    return {
      plan: subscription.plan,
      addonCount: subscription.addonCount,
      compare: {
        itemsPerSearch: base.itemsPerSearch,
        searchesPerMonth: base.searchesPerMonth,
        usedThisMonth,
        remainingThisMonth: Math.max(0, base.searchesPerMonth - usedThisMonth),
      },
      alerts: {
        activeLimit: base.activeAlerts,
        activeCount: activeAlertCount,
        remainingActive: Math.max(0, base.activeAlerts - activeAlertCount),
      },
      family: {
        additionalMembersAllowed: base.additionalMembers,
      },
      pricing: {
        monthlyPriceRm: base.monthlyPriceRm,
        addonUnitPriceRm: SubscriptionsService.ADDON_PRICE_RM,
      },
      periodKey,
    };
  }

  async getCurrentForUser(user: AuthenticatedUser) {
    const snapshot = await this.getEntitlementSnapshotForUser(user.id);
    return {
      userId: user.id,
      ...snapshot,
      generatedAt: new Date().toISOString(),
    };
  }

  async updateMockSubscription(user: AuthenticatedUser, dto: UpdateMockSubscriptionDto) {
    const addonCount = dto.plan === SubscriptionPlan.PREMIUM ? dto.addonCount : 0;

    await this.prisma.userSubscription.upsert({
      where: { userId: user.id },
      update: {
        plan: dto.plan,
        addonCount,
      },
      create: {
        userId: user.id,
        plan: dto.plan,
        addonCount,
      },
    });

    return this.getCurrentForUser(user);
  }

  async consumeCompareSearch(userId: string, requestedItemCount: number) {
    const snapshot = await this.getEntitlementSnapshotForUser(userId);

    if (requestedItemCount > snapshot.compare.itemsPerSearch) {
      throw new ForbiddenException(
        `Your plan allows up to ${snapshot.compare.itemsPerSearch} item(s) per compare search. Upgrade to continue.`,
      );
    }

    if (snapshot.compare.usedThisMonth >= snapshot.compare.searchesPerMonth) {
      throw new ForbiddenException(
        `You have used all ${snapshot.compare.searchesPerMonth} compare searches for ${snapshot.periodKey}. Upgrade to continue.`,
      );
    }

    await this.prisma.subscriptionUsageMonth.upsert({
      where: {
        userId_periodKey: {
          userId,
          periodKey: snapshot.periodKey,
        },
      },
      update: {
        compareSearchCount: {
          increment: 1,
        },
      },
      create: {
        userId,
        periodKey: snapshot.periodKey,
        compareSearchCount: 1,
      },
    });
  }

  async assertCanCreateActiveAlert(userId: string) {
    const snapshot = await this.getEntitlementSnapshotForUser(userId);
    if (snapshot.alerts.activeCount >= snapshot.alerts.activeLimit) {
      throw new ForbiddenException(
        `Your plan allows ${snapshot.alerts.activeLimit} active price alert(s). Disable one or upgrade to continue.`,
      );
    }
  }

  async assertFamilyCapacity(ownerUserId: string, activeMemberCount: number) {
    const snapshot = await this.getEntitlementSnapshotForUser(ownerUserId);
    const maxMembers = 1 + snapshot.family.additionalMembersAllowed;
    if (activeMemberCount >= maxMembers) {
      throw new ForbiddenException(
        `This family plan allows owner + ${snapshot.family.additionalMembersAllowed} additional member(s). Upgrade to invite more people.`,
      );
    }
  }
}
