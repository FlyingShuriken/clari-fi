import type { PriceSignalDecision } from './price-signal.utils';

export function matchesSignalDecisionFilter(
  filter: 'BUY_NOW' | 'WAIT' | 'BOTH',
  decision: PriceSignalDecision,
): boolean {
  if (decision === 'NEUTRAL') {
    return false;
  }
  if (filter === 'BOTH') {
    return decision === 'BUY_NOW' || decision === 'WAIT';
  }
  return filter === decision;
}

export function hasSignalAlertCooldownElapsed(
  latestTriggeredAt: Date | null | undefined,
  cooldownMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!latestTriggeredAt) {
    return true;
  }
  const elapsedMs = now.getTime() - latestTriggeredAt.getTime();
  return elapsedMs >= cooldownMinutes * 60 * 1000;
}
