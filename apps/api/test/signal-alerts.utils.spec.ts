import {
  hasSignalAlertCooldownElapsed,
  matchesSignalDecisionFilter,
} from '../src/modules/prices/signal-alerts.utils';

describe('signal-alerts.utils', () => {
  it('matches decision filter correctly', () => {
    expect(matchesSignalDecisionFilter('BOTH', 'BUY_NOW')).toBe(true);
    expect(matchesSignalDecisionFilter('BOTH', 'WAIT')).toBe(true);
    expect(matchesSignalDecisionFilter('BOTH', 'NEUTRAL')).toBe(false);
    expect(matchesSignalDecisionFilter('BUY_NOW', 'BUY_NOW')).toBe(true);
    expect(matchesSignalDecisionFilter('BUY_NOW', 'WAIT')).toBe(false);
    expect(matchesSignalDecisionFilter('WAIT', 'WAIT')).toBe(true);
    expect(matchesSignalDecisionFilter('WAIT', 'BUY_NOW')).toBe(false);
  });

  it('enforces cooldown window based on latest event time', () => {
    const now = new Date('2026-03-05T12:00:00.000Z');
    const recent = new Date('2026-03-05T08:30:00.000Z');
    const old = new Date('2026-03-05T05:00:00.000Z');

    expect(hasSignalAlertCooldownElapsed(undefined, 360, now)).toBe(true);
    expect(hasSignalAlertCooldownElapsed(null, 360, now)).toBe(true);
    expect(hasSignalAlertCooldownElapsed(recent, 360, now)).toBe(false);
    expect(hasSignalAlertCooldownElapsed(old, 360, now)).toBe(true);
  });
});
