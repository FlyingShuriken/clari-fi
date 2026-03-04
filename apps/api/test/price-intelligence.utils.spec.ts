import { ExpenseProvenance } from '@prisma/client';
import {
  computeTrustScore,
  deriveUnitPrice,
  isOutlierByRobustZ,
  sourceWeightForProvenance,
  toBucketKey,
} from '../src/modules/prices/price-intelligence.utils';

describe('price-intelligence.utils', () => {
  it('derives unit price from explicit unitPrice or quantity', () => {
    expect(deriveUnitPrice({ totalPrice: 10, unitPrice: 2.5, quantity: 4 })).toBe(2.5);
    expect(deriveUnitPrice({ totalPrice: 10, quantity: 4 })).toBe(2.5);
    expect(deriveUnitPrice({ totalPrice: 10 })).toBeNull();
  });

  it('computes bounded trust score using weighted formula', () => {
    const score = computeTrustScore({
      sourceWeight: sourceWeightForProvenance(ExpenseProvenance.RECEIPT_OCR),
      fieldConfidence: 0.9,
      locationConfidence: 1,
      outlierComponent: 1,
    });

    expect(score).toBeGreaterThan(0.9);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('flags outlier via robust z-score', () => {
    const baseline = [2.9, 3.0, 3.1, 3.05, 2.95, 3.0];
    expect(isOutlierByRobustZ(6.5, baseline, 3.5)).toBe(true);
    expect(isOutlierByRobustZ(3.02, baseline, 3.5)).toBe(false);
  });

  it('buckets dates by UTC day and week', () => {
    const date = new Date('2026-03-04T10:00:00.000Z');
    expect(toBucketKey(date, 'day')).toBe('2026-03-04');
    expect(toBucketKey(date, 'week')).toBe('2026-03-02');
  });
});
