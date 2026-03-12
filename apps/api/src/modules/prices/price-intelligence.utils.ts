import { ExpenseProvenance } from '@prisma/client';

export type HistoryInterval = 'day' | 'week';

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function normalizeLooseText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveUnitPrice(input: {
  totalPrice: number;
  quantity?: number | null;
  unitPrice?: number | null;
}): number | null {
  if (typeof input.unitPrice === 'number' && Number.isFinite(input.unitPrice) && input.unitPrice > 0) {
    return roundTo(input.unitPrice, 2);
  }

  if (
    typeof input.quantity === 'number' &&
    Number.isFinite(input.quantity) &&
    input.quantity > 0 &&
    Number.isFinite(input.totalPrice) &&
    input.totalPrice > 0
  ) {
    return roundTo(input.totalPrice / input.quantity, 2);
  }

  return null;
}

export function derivePromoUnitPrice(input: {
  totalPrice: number;
  quantity?: number | null;
  unitPrice?: number | null;
}): number | null {
  const derived = deriveUnitPrice(input);
  if (derived !== null) {
    return derived;
  }

  if (Number.isFinite(input.totalPrice) && input.totalPrice > 0) {
    return roundTo(input.totalPrice, 2);
  }

  return null;
}

export function sourceWeightForProvenance(provenance: ExpenseProvenance): number {
  if (provenance === ExpenseProvenance.RECEIPT_OCR) {
    return 0.95;
  }
  if (provenance === ExpenseProvenance.VOICE_ON_DEVICE) {
    return 0.82;
  }
  if (provenance === ExpenseProvenance.VOICE_CLOUD) {
    return 0.78;
  }
  return 0.65;
}

export function isTrustedExpensePriceProvenance(provenance: ExpenseProvenance): boolean {
  return provenance === ExpenseProvenance.RECEIPT_OCR;
}

export function computeTrustScore(input: {
  sourceWeight: number;
  fieldConfidence: number;
  locationConfidence: number;
  outlierComponent: number;
}): number {
  const score =
    0.4 * clamp01(input.sourceWeight) +
    0.25 * clamp01(input.fieldConfidence) +
    0.2 * clamp01(input.locationConfidence) +
    0.15 * clamp01(input.outlierComponent);

  return roundTo(clamp01(score), 4);
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export function robustZScore(value: number, baseline: number[]): number {
  if (baseline.length < 3) {
    return 0;
  }

  const med = median(baseline);
  const deviations = baseline.map((item) => Math.abs(item - med));
  const mad = median(deviations);
  if (mad === 0) {
    return 0;
  }

  return 0.6745 * ((value - med) / mad);
}

export function isOutlierByRobustZ(value: number, baseline: number[], threshold: number): boolean {
  const z = robustZScore(value, baseline);
  return Math.abs(z) > threshold;
}

function startOfWeekUtc(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

export function toBucketKey(date: Date, interval: HistoryInterval): string {
  if (interval === 'week') {
    return startOfWeekUtc(date).toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return earthRadiusKm * c;
}

export function matchesAreaText(filterText?: string, candidateText?: string): boolean {
  const filter = normalizeLooseText(filterText ?? '');
  if (!filter) {
    return true;
  }

  const candidate = normalizeLooseText(candidateText ?? '');
  if (!candidate) {
    return false;
  }

  return candidate.includes(filter) || filter.includes(candidate);
}

export function evaluatePriceCandidateLocation(input: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  areaText?: string;
  candidate: {
    storeLat?: number;
    storeLng?: number;
    areaText?: string;
  };
}): {
  include: boolean;
  distanceKm?: number;
} {
  const areaMatches = matchesAreaText(input.areaText, input.candidate.areaText);
  const hasCoordinates =
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);

  if (!hasCoordinates) {
    return { include: areaMatches };
  }

  const radiusKm = input.radiusKm ?? 15;
  const { candidate } = input;

  if (
    typeof candidate.storeLat === 'number' &&
    typeof candidate.storeLng === 'number' &&
    Number.isFinite(candidate.storeLat) &&
    Number.isFinite(candidate.storeLng)
  ) {
    const distanceKm = haversineDistanceKm(
      {
        lat: input.lat as number,
        lng: input.lng as number,
      },
      {
        lat: candidate.storeLat,
        lng: candidate.storeLng,
      },
    );

    return {
      include: distanceKm <= radiusKm,
      distanceKm,
    };
  }

  if (!input.areaText?.trim()) {
    return { include: true };
  }

  return {
    include: areaMatches,
  };
}
