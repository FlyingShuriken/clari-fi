import { PrismaClient, PromoReviewStatus } from '@prisma/client';
import { computePriceSignal, type SignalObservation } from '../src/modules/prices/price-signal.utils';

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) {
      continue;
    }
    const key = part.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : 'true';
    args.set(key, value);
  }
  return args;
}

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyActualDirection(deltaPct: number): 'BUY_NOW' | 'WAIT' | 'NEUTRAL' {
  if (deltaPct >= 2) {
    return 'BUY_NOW';
  }
  if (deltaPct <= -2) {
    return 'WAIT';
  }
  return 'NEUTRAL';
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const itemQuery = args.get('item')?.trim();
  if (!itemQuery) {
    throw new Error('Usage: ts-node scripts/signal-backtest.ts --item <name> [--horizonDays 7] [--includePromo true]');
  }

  const horizonDays = Math.max(3, Math.min(14, Math.floor(asNumber(args.get('horizonDays'), 7))));
  const includePromo = String(args.get('includePromo') ?? 'true').toLowerCase() !== 'false';
  const areaText = args.get('areaText')?.trim();
  const lookbackDays = Math.max(30, Math.floor(asNumber(args.get('lookbackDays'), 120)));

  const prisma = new PrismaClient();
  try {
    const canonicalItem = await prisma.canonicalItem.findFirst({
      where: {
        OR: [
          { canonicalName: { equals: itemQuery, mode: 'insensitive' } },
          { canonicalName: { contains: itemQuery, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!canonicalItem) {
      throw new Error(`No canonical item found for query "${itemQuery}"`);
    }

    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const [expenseRows, promoRows] = await Promise.all([
      prisma.priceObservation.findMany({
        where: {
          canonicalItemId: canonicalItem.id,
          observedAt: { gte: from },
          areaText: areaText
            ? {
                contains: areaText,
                mode: 'insensitive',
              }
            : undefined,
        },
        orderBy: { observedAt: 'asc' },
        select: {
          unitPrice: true,
          observedAt: true,
        },
      }),
      includePromo
        ? prisma.promoObservation.findMany({
            where: {
              canonicalItemId: canonicalItem.id,
              observedAt: { gte: from },
              reviewStatus: PromoReviewStatus.APPROVED,
              areaText: areaText
                ? {
                    contains: areaText,
                    mode: 'insensitive',
                  }
                : undefined,
            },
            orderBy: { observedAt: 'asc' },
            select: {
              unitPrice: true,
              observedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const observations: SignalObservation[] = [
      ...expenseRows.map((row) => ({
        source: 'EXPENSE' as const,
        unitPrice: row.unitPrice.toNumber(),
        observedAt: row.observedAt,
      })),
      ...promoRows.map((row) => ({
        source: 'PROMO' as const,
        unitPrice: row.unitPrice.toNumber(),
        observedAt: row.observedAt,
      })),
    ].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

    if (observations.length < 20) {
      throw new Error(
        `Not enough observations for backtest: found ${observations.length}, need at least 20.`,
      );
    }

    const uniqueDays = [...new Set(observations.map((row) => dayKeyUtc(row.observedAt)))];
    let evaluated = 0;
    let correct = 0;
    const byDecision: Record<'BUY_NOW' | 'WAIT' | 'NEUTRAL', { total: number; correct: number }> = {
      BUY_NOW: { total: 0, correct: 0 },
      WAIT: { total: 0, correct: 0 },
      NEUTRAL: { total: 0, correct: 0 },
    };
    const byGate: Record<string, number> = {};

    for (const day of uniqueDays) {
      const cutoff = new Date(`${day}T23:59:59.999Z`);
      const pastWindowStart = new Date(cutoff.getTime() - 30 * 24 * 60 * 60 * 1000);
      const futureWindowEnd = new Date(cutoff.getTime() + horizonDays * 24 * 60 * 60 * 1000);

      const past = observations.filter(
        (row) => row.observedAt >= pastWindowStart && row.observedAt <= cutoff,
      );
      const future = observations.filter(
        (row) => row.observedAt > cutoff && row.observedAt <= futureWindowEnd,
      );
      if (past.length < 12 || future.length < 3) {
        continue;
      }

      const signal = computePriceSignal({
        observations: past,
        horizonDays,
        now: cutoff,
      });
      const latest = signal.diagnostics.latestUnitPrice;
      if (!latest || latest <= 0) {
        continue;
      }

      const futureAvg = mean(future.map((row) => row.unitPrice));
      const actualDeltaPct = ((futureAvg - latest) / latest) * 100;
      const actualDirection = classifyActualDirection(actualDeltaPct);
      const isCorrect = signal.decision === actualDirection;

      evaluated += 1;
      byDecision[signal.decision].total += 1;
      if (isCorrect) {
        correct += 1;
        byDecision[signal.decision].correct += 1;
      }

      if (signal.diagnostics.gatedNeutral && signal.diagnostics.gateReason) {
        byGate[signal.diagnostics.gateReason] = (byGate[signal.diagnostics.gateReason] ?? 0) + 1;
      }
    }

    const accuracy = evaluated > 0 ? correct / evaluated : 0;
    const output = {
      item: {
        id: canonicalItem.id,
        canonicalName: canonicalItem.canonicalName,
      },
      includePromo,
      horizonDays,
      areaText: areaText || null,
      observationCount: observations.length,
      evaluatedWindows: evaluated,
      accuracy: Number(accuracy.toFixed(4)),
      byDecision,
      neutralGateReasons: byGate,
      generatedAt: new Date().toISOString(),
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
