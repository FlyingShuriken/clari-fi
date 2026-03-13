import { Injectable } from '@nestjs/common';
import {
  ContributionAcceptanceStatus,
  Prisma,
} from '@prisma/client';

const STREAK_ELIGIBLE_STATUSES = [
  ContributionAcceptanceStatus.ACCEPTED,
  ContributionAcceptanceStatus.CAPPED,
] as const;

export const STREAK_BONUS_RULES = [
  { days: 3, bonusPoints: 2 },
  { days: 7, bonusPoints: 5 },
  { days: 14, bonusPoints: 10 },
] as const;

export interface StreakAwardDecision {
  streakDays: number;
  bonusPoints: number;
  alreadyCountedToday: boolean;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minusUtcDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return toUtcDayKey(date);
}

@Injectable()
export class ContributionStreaksService {
  computeDecisionFromAcceptedDates(
    acceptedDates: Date[],
    at = new Date(),
  ): StreakAwardDecision {
    const todayKey = toUtcDayKey(at);
    const uniqueDayKeys = [...new Set(acceptedDates.map((date) => toUtcDayKey(date)).sort().reverse())];
    const daySet = new Set(uniqueDayKeys);
    const alreadyCountedToday = daySet.has(todayKey);

    let streakDays = 1;
    let offset = 1;
    while (daySet.has(minusUtcDays(todayKey, offset))) {
      streakDays += 1;
      offset += 1;
    }

    if (alreadyCountedToday) {
      return {
        streakDays,
        bonusPoints: 0,
        alreadyCountedToday,
      };
    }

    const rule = [...STREAK_BONUS_RULES]
      .sort((left, right) => right.days - left.days)
      .find((candidate) => candidate.days === streakDays);

    return {
      streakDays,
      bonusPoints: rule?.bonusPoints ?? 0,
      alreadyCountedToday,
    };
  }

  async computeStreakAward(
    tx: Prisma.TransactionClient,
    userId: string,
    at = new Date(),
  ): Promise<StreakAwardDecision> {
    const acceptances = await tx.contributionAcceptance.findMany({
      where: {
        userId,
        status: {
          in: [...STREAK_ELIGIBLE_STATUSES],
        },
        acceptedAt: {
          not: null,
        },
      },
      select: {
        acceptedAt: true,
      },
      orderBy: {
        acceptedAt: 'desc',
      },
    });

    return this.computeDecisionFromAcceptedDates(
      acceptances
        .map((entry) => entry.acceptedAt)
        .filter((value): value is Date => value instanceof Date),
      at,
    );
  }
}
