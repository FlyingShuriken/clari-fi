import { ExpenseProvenance } from '@prisma/client';
import {
  computeTrustScore,
  derivePromoUnitPrice,
  deriveUnitPrice,
  evaluatePriceCandidateLocation,
  isTrustedExpensePriceProvenance,
  isOutlierByRobustZ,
  matchesAreaText,
  sourceWeightForProvenance,
  toBucketKey,
} from '../src/modules/prices/price-intelligence.utils';

describe('price-intelligence.utils', () => {
  it('derives unit price from explicit unitPrice or quantity', () => {
    expect(deriveUnitPrice({ totalPrice: 10, unitPrice: 2.5, quantity: 4 })).toBe(2.5);
    expect(deriveUnitPrice({ totalPrice: 10, quantity: 4 })).toBe(2.5);
    expect(deriveUnitPrice({ totalPrice: 10 })).toBeNull();
  });

  it('treats flyer display price as unit price when quantity is absent', () => {
    expect(derivePromoUnitPrice({ totalPrice: 12.9 })).toBe(12.9);
    expect(derivePromoUnitPrice({ totalPrice: 10, quantity: 2 })).toBe(5);
    expect(derivePromoUnitPrice({ totalPrice: 8, unitPrice: 4, quantity: 2 })).toBe(4);
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

  it('treats only receipt OCR as a trusted expense price source', () => {
    expect(isTrustedExpensePriceProvenance(ExpenseProvenance.RECEIPT_OCR)).toBe(true);
    expect(isTrustedExpensePriceProvenance(ExpenseProvenance.VOICE_ON_DEVICE)).toBe(false);
    expect(isTrustedExpensePriceProvenance(ExpenseProvenance.VOICE_CLOUD)).toBe(false);
    expect(isTrustedExpensePriceProvenance(ExpenseProvenance.MANUAL)).toBe(false);
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

  it('keeps area-only candidates when coordinates are present but no area filter is supplied', () => {
    const result = evaluatePriceCandidateLocation({
      lat: 37.785834,
      lng: -122.406417,
      radiusKm: 10,
      candidate: {
        areaText: 'mission district san francisco',
      },
    });

    expect(result.include).toBe(true);
    expect(result.distanceKm).toBeUndefined();
  });

  it('matches area-only candidates against selected area text when provided', () => {
    expect(
      evaluatePriceCandidateLocation({
        lat: 37.785834,
        lng: -122.406417,
        areaText: 'San Francisco',
        candidate: {
          areaText: 'mission district san francisco',
        },
      }).include,
    ).toBe(true);

    expect(
      evaluatePriceCandidateLocation({
        lat: 37.785834,
        lng: -122.406417,
        areaText: 'Oakland',
        candidate: {
          areaText: 'mission district san francisco',
        },
      }).include,
    ).toBe(false);
  });

  it('matches coarse area records against richer place labels', () => {
    expect(matchesAreaText('Union Square, San Francisco, California, United States', 'San Francisco')).toBe(true);
    expect(matchesAreaText('Bukit Bintang, Kuala Lumpur, Malaysia', 'Kuala Lumpur')).toBe(true);
  });

  it('filters by area text even when coordinates are not supplied', () => {
    expect(
      evaluatePriceCandidateLocation({
        areaText: 'San Francisco',
        candidate: {
          areaText: 'mission district san francisco',
        },
      }).include,
    ).toBe(true);

    expect(
      evaluatePriceCandidateLocation({
        areaText: 'Oakland',
        candidate: {
          areaText: 'mission district san francisco',
        },
      }).include,
    ).toBe(false);
  });
});
