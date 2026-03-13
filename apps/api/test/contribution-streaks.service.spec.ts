import { ContributionStreaksService } from '../src/modules/contributions/contribution-streaks.service';

describe('ContributionStreaksService', () => {
  const service = new ContributionStreaksService();

  it('awards a bonus when the user reaches a 3-day streak', () => {
    const decision = service.computeDecisionFromAcceptedDates(
      [
        new Date('2026-03-12T08:00:00.000Z'),
        new Date('2026-03-11T09:30:00.000Z'),
      ],
      new Date('2026-03-13T10:00:00.000Z'),
    );

    expect(decision).toEqual({
      streakDays: 3,
      bonusPoints: 2,
      alreadyCountedToday: false,
    });
  });

  it('resets the streak after a gap', () => {
    const decision = service.computeDecisionFromAcceptedDates(
      [
        new Date('2026-03-10T08:00:00.000Z'),
        new Date('2026-03-08T09:30:00.000Z'),
      ],
      new Date('2026-03-13T10:00:00.000Z'),
    );

    expect(decision).toEqual({
      streakDays: 1,
      bonusPoints: 0,
      alreadyCountedToday: false,
    });
  });

  it('does not award another streak bonus for multiple contributions on the same day', () => {
    const decision = service.computeDecisionFromAcceptedDates(
      [
        new Date('2026-03-13T08:00:00.000Z'),
        new Date('2026-03-12T09:30:00.000Z'),
        new Date('2026-03-11T12:00:00.000Z'),
      ],
      new Date('2026-03-13T15:00:00.000Z'),
    );

    expect(decision).toEqual({
      streakDays: 3,
      bonusPoints: 0,
      alreadyCountedToday: true,
    });
  });
});
