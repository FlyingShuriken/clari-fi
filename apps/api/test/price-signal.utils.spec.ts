import { computePriceSignal, type SignalObservation } from '../src/modules/prices/price-signal.utils';

function day(base: string): Date {
  return new Date(`${base}T10:00:00.000Z`);
}

describe('price-signal.utils', () => {
  it('returns BUY_NOW when current value is cheap and trend points up', () => {
    const observations: SignalObservation[] = [
      { unitPrice: 5.0, observedAt: day('2026-03-04'), source: 'EXPENSE' },
      { unitPrice: 4.9, observedAt: day('2026-03-03'), source: 'EXPENSE' },
      { unitPrice: 4.8, observedAt: day('2026-03-02'), source: 'EXPENSE' },
      { unitPrice: 4.7, observedAt: day('2026-03-01'), source: 'EXPENSE' },
      { unitPrice: 4.6, observedAt: day('2026-02-28'), source: 'EXPENSE' },
      { unitPrice: 4.5, observedAt: day('2026-02-27'), source: 'EXPENSE' },
      { unitPrice: 4.4, observedAt: day('2026-02-26'), source: 'EXPENSE' },
      { unitPrice: 4.3, observedAt: day('2026-02-25'), source: 'EXPENSE' },
      { unitPrice: 4.2, observedAt: day('2026-02-24'), source: 'EXPENSE' },
      { unitPrice: 4.1, observedAt: day('2026-02-23'), source: 'EXPENSE' },
      { unitPrice: 11.2, observedAt: day('2026-02-22'), source: 'EXPENSE' },
      { unitPrice: 11.1, observedAt: day('2026-02-21'), source: 'EXPENSE' },
      { unitPrice: 11.0, observedAt: day('2026-02-20'), source: 'EXPENSE' },
      { unitPrice: 10.9, observedAt: day('2026-02-19'), source: 'EXPENSE' },
      { unitPrice: 10.8, observedAt: day('2026-02-18'), source: 'EXPENSE' },
      { unitPrice: 10.7, observedAt: day('2026-02-17'), source: 'EXPENSE' },
      { unitPrice: 10.6, observedAt: day('2026-02-16'), source: 'EXPENSE' },
      { unitPrice: 10.5, observedAt: day('2026-02-15'), source: 'EXPENSE' },
      { unitPrice: 10.4, observedAt: day('2026-02-14'), source: 'EXPENSE' },
      { unitPrice: 10.3, observedAt: day('2026-02-13'), source: 'EXPENSE' },
      { unitPrice: 3.4, observedAt: day('2026-03-02'), source: 'PROMO' },
    ];

    const signal = computePriceSignal({
      observations,
      horizonDays: 7,
      now: day('2026-03-05'),
    });

    expect(signal.decision).toBe('BUY_NOW');
    expect(signal.confidence).toBeGreaterThanOrEqual(0.6);
    expect(signal.sampleSize).toBeGreaterThanOrEqual(12);
  });

  it('returns WAIT when current price is high and trend points down', () => {
    const observations: SignalObservation[] = [
      { unitPrice: 9.5, observedAt: day('2026-03-04'), source: 'EXPENSE' },
      { unitPrice: 10.0, observedAt: day('2026-03-03'), source: 'EXPENSE' },
      { unitPrice: 10.5, observedAt: day('2026-03-02'), source: 'EXPENSE' },
      { unitPrice: 11.0, observedAt: day('2026-03-01'), source: 'EXPENSE' },
      { unitPrice: 11.5, observedAt: day('2026-02-28'), source: 'EXPENSE' },
      { unitPrice: 12.0, observedAt: day('2026-02-27'), source: 'EXPENSE' },
      { unitPrice: 12.5, observedAt: day('2026-02-26'), source: 'EXPENSE' },
      { unitPrice: 13.0, observedAt: day('2026-02-25'), source: 'EXPENSE' },
      { unitPrice: 13.5, observedAt: day('2026-02-24'), source: 'EXPENSE' },
      { unitPrice: 14.0, observedAt: day('2026-02-23'), source: 'EXPENSE' },
      { unitPrice: 4.8, observedAt: day('2026-02-22'), source: 'EXPENSE' },
      { unitPrice: 4.7, observedAt: day('2026-02-21'), source: 'EXPENSE' },
      { unitPrice: 4.6, observedAt: day('2026-02-20'), source: 'EXPENSE' },
      { unitPrice: 4.5, observedAt: day('2026-02-19'), source: 'EXPENSE' },
      { unitPrice: 4.4, observedAt: day('2026-02-18'), source: 'EXPENSE' },
      { unitPrice: 4.3, observedAt: day('2026-02-17'), source: 'EXPENSE' },
      { unitPrice: 4.2, observedAt: day('2026-02-16'), source: 'EXPENSE' },
      { unitPrice: 4.1, observedAt: day('2026-02-15'), source: 'EXPENSE' },
      { unitPrice: 4.0, observedAt: day('2026-02-14'), source: 'EXPENSE' },
      { unitPrice: 3.9, observedAt: day('2026-02-13'), source: 'EXPENSE' },
      { unitPrice: 15.0, observedAt: day('2026-03-01'), source: 'PROMO' },
    ];

    const signal = computePriceSignal({
      observations,
      horizonDays: 7,
      now: day('2026-03-05'),
    });

    expect(signal.decision).toBe('WAIT');
    expect(signal.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('forces NEUTRAL when sample size is too sparse', () => {
    const observations: SignalObservation[] = [
      { unitPrice: 5.1, observedAt: day('2026-03-04'), source: 'EXPENSE' },
      { unitPrice: 5.0, observedAt: day('2026-03-03'), source: 'EXPENSE' },
      { unitPrice: 4.9, observedAt: day('2026-03-02'), source: 'EXPENSE' },
      { unitPrice: 4.8, observedAt: day('2026-03-01'), source: 'EXPENSE' },
    ];

    const signal = computePriceSignal({
      observations,
      horizonDays: 7,
      now: day('2026-03-05'),
    });

    expect(signal.decision).toBe('NEUTRAL');
    expect(signal.diagnostics.gateReason).toBe('LOW_DATA');
  });

  it('penalizes high volatility with lower confidence', () => {
    const observations: SignalObservation[] = [
      { unitPrice: 9.5, observedAt: day('2026-03-04'), source: 'EXPENSE' },
      { unitPrice: 2.0, observedAt: day('2026-03-03'), source: 'EXPENSE' },
      { unitPrice: 8.8, observedAt: day('2026-03-02'), source: 'EXPENSE' },
      { unitPrice: 2.2, observedAt: day('2026-03-01'), source: 'EXPENSE' },
      { unitPrice: 9.0, observedAt: day('2026-02-28'), source: 'EXPENSE' },
      { unitPrice: 2.1, observedAt: day('2026-02-27'), source: 'EXPENSE' },
      { unitPrice: 8.6, observedAt: day('2026-02-26'), source: 'EXPENSE' },
      { unitPrice: 2.3, observedAt: day('2026-02-25'), source: 'EXPENSE' },
      { unitPrice: 8.9, observedAt: day('2026-02-24'), source: 'EXPENSE' },
      { unitPrice: 2.4, observedAt: day('2026-02-23'), source: 'EXPENSE' },
      { unitPrice: 8.7, observedAt: day('2026-02-22'), source: 'EXPENSE' },
      { unitPrice: 2.5, observedAt: day('2026-02-21'), source: 'EXPENSE' },
      { unitPrice: 8.5, observedAt: day('2026-02-20'), source: 'EXPENSE' },
    ];

    const signal = computePriceSignal({
      observations,
      horizonDays: 7,
      now: day('2026-03-05'),
    });

    expect(signal.diagnostics.volatility30d).toBeGreaterThan(0.5);
    expect(signal.confidence).toBeLessThan(0.7);
  });
});
