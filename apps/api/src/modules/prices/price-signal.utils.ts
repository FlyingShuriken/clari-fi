import { roundTo } from './price-intelligence.utils';

export type PriceSignalDecision = 'BUY_NOW' | 'WAIT' | 'NEUTRAL';
export type SignalGateReason = 'LOW_DATA' | 'LOW_CONFIDENCE';

export interface SignalObservation {
  unitPrice: number;
  observedAt: Date;
  source: 'EXPENSE' | 'PROMO';
}

export interface PriceSignalReason {
  code: string;
  label: string;
  value: number;
  weight: number;
}

export interface PriceSignalResult {
  decision: PriceSignalDecision;
  confidence: number;
  expectedDeltaPct: number;
  sampleSize: number;
  reasons: PriceSignalReason[];
  diagnostics: {
    score: number;
    latestUnitPrice: number;
    avg7d: number;
    avg30d: number;
    trendSlope7d: number;
    volatility30d: number;
    sampleSize30d: number;
    distinctDays30d: number;
    promoBestUnitPrice?: number;
    gatedNeutral: boolean;
    gateReason?: SignalGateReason;
  };
}

interface ComputeSignalInput {
  observations: SignalObservation[];
  horizonDays: number;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function regressionSlopeByDay(observations: SignalObservation[]): number {
  if (observations.length < 2) {
    return 0;
  }

  const byDay = new Map<string, { total: number; count: number }>();
  for (const row of observations) {
    const key = dayKeyUtc(row.observedAt);
    const existing = byDay.get(key);
    if (existing) {
      existing.total += row.unitPrice;
      existing.count += 1;
      continue;
    }
    byDay.set(key, { total: row.unitPrice, count: 1 });
  }

  const points = [...byDay.entries()]
    .map(([key, stat]) => ({
      dayOffset: Math.floor((new Date(`${key}T00:00:00.000Z`).getTime() - Date.UTC(1970, 0, 1)) / DAY_MS),
      avgPrice: stat.total / stat.count,
    }))
    .sort((a, b) => a.dayOffset - b.dayOffset);

  if (points.length < 2) {
    return 0;
  }

  const xMean = mean(points.map((point) => point.dayOffset));
  const yMean = mean(points.map((point) => point.avgPrice));

  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.dayOffset - xMean) * (point.avgPrice - yMean);
    denominator += (point.dayOffset - xMean) ** 2;
  }

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function buildNeutralResult(reason: SignalGateReason, latestUnitPrice = 0): PriceSignalResult {
  const label = reason === 'LOW_DATA' ? 'Not enough recent observations yet' : 'Confidence below threshold';

  return {
    decision: 'NEUTRAL',
    confidence: 0,
    expectedDeltaPct: 0,
    sampleSize: 0,
    reasons: [
      {
        code: reason,
        label,
        value: 0,
        weight: 1,
      },
    ],
    diagnostics: {
      score: 0,
      latestUnitPrice,
      avg7d: 0,
      avg30d: 0,
      trendSlope7d: 0,
      volatility30d: 0,
      sampleSize30d: 0,
      distinctDays30d: 0,
      gatedNeutral: true,
      gateReason: reason,
    },
  };
}

export function computePriceSignal(input: ComputeSignalInput): PriceSignalResult {
  const now = input.now ?? new Date();
  const horizonDays = clamp(Math.round(input.horizonDays || 7), 3, 14);
  const observations = input.observations
    .filter((item) => Number.isFinite(item.unitPrice) && item.unitPrice > 0)
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

  if (observations.length === 0) {
    return buildNeutralResult('LOW_DATA', 0);
  }

  const start30 = new Date(now.getTime() - 30 * DAY_MS);
  const start7 = new Date(now.getTime() - 7 * DAY_MS);
  const observations30 = observations.filter((item) => item.observedAt >= start30);
  const observations7 = observations.filter((item) => item.observedAt >= start7);

  const sampleSize30d = observations30.length;
  const distinctDays30d = new Set(observations30.map((row) => dayKeyUtc(row.observedAt))).size;
  const latestUnitPrice = observations[0]?.unitPrice ?? 0;

  if (sampleSize30d === 0) {
    return buildNeutralResult('LOW_DATA', latestUnitPrice);
  }

  const prices30 = observations30.map((row) => row.unitPrice);
  const prices7 = (observations7.length > 0 ? observations7 : observations30).map((row) => row.unitPrice);
  const avg30d = mean(prices30);
  const avg7d = mean(prices7);
  const trendSlope7d = regressionSlopeByDay(observations7.length > 0 ? observations7 : observations30);
  const volatility30d = avg30d > 0 ? standardDeviation(prices30) / avg30d : 0;

  const promoRows = observations30.filter((row) => row.source === 'PROMO');
  const promoBestUnitPrice =
    promoRows.length > 0 ? Math.min(...promoRows.map((row) => row.unitPrice)) : undefined;

  const valueGapComponent = avg30d > 0 ? clamp((avg30d - latestUnitPrice) / avg30d, -1, 1) : 0;
  const trendComponent =
    avg7d > 0 ? clamp((trendSlope7d * horizonDays) / avg7d, -1, 1) : 0;
  const promoComponent =
    typeof promoBestUnitPrice === 'number' && latestUnitPrice > 0
      ? clamp((latestUnitPrice - promoBestUnitPrice) / latestUnitPrice, -1, 1)
      : 0;
  const volatilityPenalty = clamp(volatility30d / 0.35, 0, 1);

  const weightedReasons: PriceSignalReason[] = [
    {
      code: 'VALUE_GAP_30D',
      label: 'Current price vs 30-day average',
      value: roundTo(valueGapComponent, 4),
      weight: 0.45,
    },
    {
      code: 'TREND_7D',
      label: '7-day trend projection',
      value: roundTo(trendComponent, 4),
      weight: 0.35,
    },
    {
      code: 'PROMO_SPREAD',
      label: 'Best active promo spread',
      value: roundTo(promoComponent, 4),
      weight: 0.2,
    },
    {
      code: 'VOLATILITY_30D',
      label: '30-day volatility penalty',
      value: roundTo(-volatilityPenalty, 4),
      weight: 0.25,
    },
  ];

  const directionalScore = clamp(
    0.45 * valueGapComponent + 0.35 * trendComponent + 0.2 * promoComponent,
    -1,
    1,
  );
  const rawScore = directionalScore;

  const featureSignals = [valueGapComponent, trendComponent];
  if (typeof promoBestUnitPrice === 'number') {
    featureSignals.push(promoComponent);
  }
  const directionalFeatures = featureSignals.filter((value) => Math.abs(value) >= 0.03);
  const agreement =
    directionalFeatures.length === 0
      ? 0.5
      : directionalFeatures.filter((value) => Math.sign(value) === Math.sign(directionalScore))
          .length /
        directionalFeatures.length;

  const sampleCoverage = clamp(sampleSize30d / 30, 0, 1);
  const stability = 1 - clamp(volatility30d / 0.8, 0, 1);
  const confidence = clamp(
    0.45 * sampleCoverage + 0.35 * stability + 0.2 * agreement,
    0,
    1,
  );

  let decision: PriceSignalDecision = 'NEUTRAL';
  if (rawScore >= 0.25) {
    decision = 'BUY_NOW';
  } else if (rawScore <= -0.25) {
    decision = 'WAIT';
  }

  let gateReason: SignalGateReason | undefined;
  if (sampleSize30d < 12 || distinctDays30d < 5) {
    decision = 'NEUTRAL';
    gateReason = 'LOW_DATA';
  } else if (confidence < 0.6) {
    decision = 'NEUTRAL';
    gateReason = 'LOW_CONFIDENCE';
  }

  const reasons = [...weightedReasons]
    .sort((a, b) => Math.abs(b.value * b.weight) - Math.abs(a.value * a.weight))
    .slice(0, 3);

  if (gateReason === 'LOW_DATA') {
    reasons.unshift({
      code: 'LOW_DATA',
      label: 'Not enough recent observations',
      value: roundTo(sampleSize30d / 12, 4),
      weight: 1,
    });
  } else if (gateReason === 'LOW_CONFIDENCE') {
    reasons.unshift({
      code: 'LOW_CONFIDENCE',
      label: 'Signal confidence is below threshold',
      value: roundTo(confidence, 4),
      weight: 1,
    });
  }

  return {
    decision,
    confidence: roundTo(confidence, 4),
    expectedDeltaPct: roundTo(trendComponent * 100, 2),
    sampleSize: sampleSize30d,
    reasons,
    diagnostics: {
      score: roundTo(rawScore, 4),
      latestUnitPrice: roundTo(latestUnitPrice, 2),
      avg7d: roundTo(avg7d, 2),
      avg30d: roundTo(avg30d, 2),
      trendSlope7d: roundTo(trendSlope7d, 4),
      volatility30d: roundTo(volatility30d, 4),
      sampleSize30d,
      distinctDays30d,
      promoBestUnitPrice:
        typeof promoBestUnitPrice === 'number' ? roundTo(promoBestUnitPrice, 2) : undefined,
      gatedNeutral: gateReason !== undefined,
      gateReason,
    },
  };
}
