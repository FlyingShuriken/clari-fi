import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ExpenseProvenance } from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { BackfillPricesDto } from './dto/backfill-prices.dto';
import { PriceCompareQueryDto } from './dto/price-compare-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { ItemNormalizerService } from './item-normalizer.service';
import {
  clamp01,
  computeTrustScore,
  deriveUnitPrice,
  haversineDistanceKm,
  HistoryInterval,
  isOutlierByRobustZ,
  roundTo,
  sourceWeightForProvenance,
  toBucketKey,
} from './price-intelligence.utils';
import { StoreResolverService } from './store-resolver.service';

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  return 0;
}

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly itemNormalizer: ItemNormalizerService,
    private readonly storeResolver: StoreResolverService,
  ) {}

  isEnabled(): boolean {
    const value =
      this.config.get<string>('PRICE_INTELLIGENCE_ENABLED')?.trim().toLowerCase() ??
      'true';
    return value !== 'false';
  }

  async ingestExpense(expenseId: string, options?: { dryRun?: boolean }) {
    if (!this.isEnabled()) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      };
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        user: {
          select: {
            locale: true,
          },
        },
        lineItems: true,
      },
    });

    if (!expense) {
      return {
        created: 0,
        updated: 0,
        skipped: 1,
        errors: 0,
      };
    }

    const createdOrUpdated = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    const storeContext = await this.storeResolver.resolveStore({
      merchantText: expense.merchantText,
      areaText: expense.areaText,
      locationLat: decimalToNumber(expense.locationLat),
      locationLng: decimalToNumber(expense.locationLng),
    });

    for (const lineItem of expense.lineItems) {
      try {
        const totalPrice = decimalToNumber(lineItem.totalPrice);
        const quantity =
          lineItem.quantity instanceof Prisma.Decimal
            ? lineItem.quantity.toNumber()
            : undefined;
        const lineUnitPrice =
          lineItem.unitPrice instanceof Prisma.Decimal
            ? lineItem.unitPrice.toNumber()
            : undefined;

        const unitPrice = deriveUnitPrice({
          totalPrice,
          quantity,
          unitPrice: lineUnitPrice,
        });

        if (!unitPrice) {
          createdOrUpdated.skipped += 1;
          continue;
        }

        const normalizedItem = await this.itemNormalizer.resolveCanonicalItem({
          descriptionRaw: lineItem.descriptionRaw,
          unitRaw: lineItem.unitRaw,
          locale: expense.user.locale,
        });

        const outlierEvaluation = await this.evaluateOutlier({
          canonicalItemId: normalizedItem.canonicalItem.id,
          storeId: storeContext.storeId,
          areaText: storeContext.areaText,
          unitPrice,
        });

        const provenance = expense.provenance;
        const sourceWeight = sourceWeightForProvenance(provenance as ExpenseProvenance);
        const fieldConfidence = clamp01(
          Number(lineItem.confidence ?? expense.confidence ?? normalizedItem.confidence ?? 0.6),
        );

        const trustScore = computeTrustScore({
          sourceWeight,
          fieldConfidence,
          locationConfidence: storeContext.locationConfidence,
          outlierComponent: outlierEvaluation.outlierComponent,
        });

        const observationData = {
          userId: expense.userId,
          expenseId: expense.id,
          canonicalItemId: normalizedItem.canonicalItem.id,
          storeId: storeContext.storeId,
          areaText: storeContext.areaText,
          currency: expense.currency,
          quantity:
            typeof quantity === 'number' && quantity > 0
              ? new Prisma.Decimal(quantity)
              : undefined,
          unitRaw: lineItem.unitRaw,
          unitPrice: new Prisma.Decimal(unitPrice),
          totalPrice: new Prisma.Decimal(totalPrice),
          observedAt: expense.transactionAt,
          provenance,
          trustScore: new Prisma.Decimal(trustScore),
          outlierFlag: outlierEvaluation.isOutlier,
          metadata: {
            canonicalization: {
              aliasText: normalizedItem.aliasText,
              confidence: normalizedItem.confidence,
            },
            geocode: {
              providerPlaceId: storeContext.providerPlaceId,
              locationConfidence: storeContext.locationConfidence,
            },
            outlier: {
              baselineSize: outlierEvaluation.baselineSize,
              threshold: outlierEvaluation.threshold,
            },
          } satisfies Prisma.InputJsonValue,
        };

        if (options?.dryRun) {
          createdOrUpdated.created += 1;
          continue;
        }

        const existing = await this.prisma.priceObservation.findUnique({
          where: {
            expenseLineItemId: lineItem.id,
          },
          select: { id: true },
        });

        await this.prisma.priceObservation.upsert({
          where: {
            expenseLineItemId: lineItem.id,
          },
          create: {
            expenseLineItemId: lineItem.id,
            ...observationData,
          },
          update: observationData,
        });

        if (existing) {
          createdOrUpdated.updated += 1;
        } else {
          createdOrUpdated.created += 1;
        }
      } catch {
        createdOrUpdated.errors += 1;
      }
    }

    this.metrics.trackCounter('prices.ingest.created.count', createdOrUpdated.created, {
      expenseId,
    });
    this.metrics.trackCounter('prices.ingest.updated.count', createdOrUpdated.updated, {
      expenseId,
    });
    this.metrics.trackCounter('prices.ingest.skipped.count', createdOrUpdated.skipped, {
      expenseId,
    });
    this.metrics.trackCounter('prices.ingest.errors.count', createdOrUpdated.errors, {
      expenseId,
    });

    return createdOrUpdated;
  }

  async getHistory(user: AuthenticatedUser, query: PriceHistoryQueryDto) {
    const canonicalItem = await this.itemNormalizer.findCanonicalItemByQuery(query.item);
    if (!canonicalItem) {
      return {
        item: null,
        interval: query.interval ?? 'day',
        points: [],
        totalObservations: 0,
        generatedAt: new Date().toISOString(),
        userId: user.id,
      };
    }

    const where: Prisma.PriceObservationWhereInput = {
      canonicalItemId: canonicalItem.id,
    };

    if (query.storeId) {
      where.storeId = query.storeId;
    }

    if (query.area) {
      where.areaText = {
        contains: query.area.trim(),
        mode: 'insensitive',
      };
    }

    if (query.from || query.to) {
      where.observedAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const observations = await this.prisma.priceObservation.findMany({
      where,
      orderBy: {
        observedAt: 'asc',
      },
      select: {
        observedAt: true,
        unitPrice: true,
      },
    });

    const interval = (query.interval ?? 'day') as HistoryInterval;
    const buckets = new Map<
      string,
      {
        min: number;
        max: number;
        sum: number;
        count: number;
      }
    >();

    for (const row of observations) {
      const key = toBucketKey(row.observedAt, interval);
      const unitPrice = decimalToNumber(row.unitPrice);
      const current = buckets.get(key);

      if (!current) {
        buckets.set(key, {
          min: unitPrice,
          max: unitPrice,
          sum: unitPrice,
          count: 1,
        });
        continue;
      }

      current.min = Math.min(current.min, unitPrice);
      current.max = Math.max(current.max, unitPrice);
      current.sum += unitPrice;
      current.count += 1;
    }

    return {
      item: {
        id: canonicalItem.id,
        canonicalName: canonicalItem.canonicalName,
        canonicalUnit: canonicalItem.canonicalUnit,
      },
      interval,
      totalObservations: observations.length,
      points: [...buckets.entries()].map(([bucket, stat]) => ({
        bucket,
        minUnitPrice: roundTo(stat.min, 2),
        avgUnitPrice: roundTo(stat.sum / stat.count, 2),
        maxUnitPrice: roundTo(stat.max, 2),
        sampleSize: stat.count,
      })),
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async compare(user: AuthenticatedUser, query: PriceCompareQueryDto) {
    const canonicalItem = await this.itemNormalizer.findCanonicalItemByQuery(query.item);
    if (!canonicalItem) {
      return {
        item: null,
        rows: [],
        generatedAt: new Date().toISOString(),
        userId: user.id,
      };
    }

    const where: Prisma.PriceObservationWhereInput = {
      canonicalItemId: canonicalItem.id,
    };

    if (query.area) {
      where.areaText = {
        contains: query.area.trim(),
        mode: 'insensitive',
      };
    }

    const observations = await this.prisma.priceObservation.findMany({
      where,
      orderBy: {
        observedAt: 'desc',
      },
      include: {
        store: true,
      },
      take: 2000,
    });

    const includeDistance =
      typeof query.lat === 'number' &&
      typeof query.lng === 'number' &&
      Number.isFinite(query.lat) &&
      Number.isFinite(query.lng);

    const radiusKm = query.radiusKm ?? 15;
    const grouped = new Map<
      string,
      {
        storeId?: string;
        storeName?: string;
        areaText?: string;
        latestUnitPrice: number;
        latestAt: Date;
        unitPriceSum: number;
        trustScoreSum: number;
        sampleSize: number;
        distanceKm?: number;
      }
    >();

    for (const observation of observations) {
      let distanceKm: number | undefined;

      if (includeDistance && observation.store?.lat && observation.store?.lng) {
        distanceKm = haversineDistanceKm(
          {
            lat: query.lat as number,
            lng: query.lng as number,
          },
          {
            lat: decimalToNumber(observation.store.lat),
            lng: decimalToNumber(observation.store.lng),
          },
        );

        if (distanceKm > radiusKm) {
          continue;
        }
      }

      const key = observation.storeId
        ? `store:${observation.storeId}`
        : `area:${(observation.areaText ?? 'unknown').toLowerCase()}`;

      const unitPrice = decimalToNumber(observation.unitPrice);
      const trustScore = decimalToNumber(observation.trustScore);
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          storeId: observation.storeId ?? undefined,
          storeName: observation.store?.displayName ?? undefined,
          areaText: observation.areaText ?? undefined,
          latestUnitPrice: unitPrice,
          latestAt: observation.observedAt,
          unitPriceSum: unitPrice,
          trustScoreSum: trustScore,
          sampleSize: 1,
          distanceKm: distanceKm !== undefined ? roundTo(distanceKm, 2) : undefined,
        });
        continue;
      }

      current.sampleSize += 1;
      current.unitPriceSum += unitPrice;
      current.trustScoreSum += trustScore;
      if (observation.observedAt > current.latestAt) {
        current.latestAt = observation.observedAt;
        current.latestUnitPrice = unitPrice;
        current.distanceKm = distanceKm !== undefined ? roundTo(distanceKm, 2) : undefined;
      }
    }

    const rows = [...grouped.values()]
      .map((row) => ({
        storeId: row.storeId,
        storeName: row.storeName,
        areaText: row.areaText,
        latestUnitPrice: roundTo(row.latestUnitPrice, 2),
        averageUnitPrice: roundTo(row.unitPriceSum / row.sampleSize, 2),
        averageTrustScore: roundTo(row.trustScoreSum / row.sampleSize, 4),
        sampleSize: row.sampleSize,
        lastObservedAt: row.latestAt.toISOString(),
        distanceKm: row.distanceKm,
      }))
      .sort((a, b) => {
        if (a.latestUnitPrice !== b.latestUnitPrice) {
          return a.latestUnitPrice - b.latestUnitPrice;
        }

        return b.averageTrustScore - a.averageTrustScore;
      })
      .slice(0, query.limit ?? 20);

    return {
      item: {
        id: canonicalItem.id,
        canonicalName: canonicalItem.canonicalName,
        canonicalUnit: canonicalItem.canonicalUnit,
      },
      radiusKm: includeDistance ? radiusKm : undefined,
      rows,
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async backfill(user: AuthenticatedUser, dto: BackfillPricesDto, backfillToken?: string) {
    const expectedToken = this.config.get<string>('PRICES_BACKFILL_TOKEN')?.trim();
    const allowAllScope =
      dto.scope === 'all' && expectedToken && backfillToken && expectedToken === backfillToken;

    if (dto.scope === 'all' && !allowAllScope) {
      throw new ForbiddenException(
        'All-scope backfill requires x-backfill-token with PRICES_BACKFILL_TOKEN',
      );
    }

    const where: Prisma.ExpenseWhereInput = {};

    if (!allowAllScope) {
      where.userId = user.id;
    }

    if (dto.from || dto.to) {
      where.transactionAt = {
        gte: dto.from ? new Date(dto.from) : undefined,
        lte: dto.to ? new Date(dto.to) : undefined,
      };
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        id: true,
      },
      orderBy: {
        transactionAt: 'asc',
      },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const expense of expenses) {
      const result = await this.ingestExpense(expense.id, { dryRun: dto.dryRun ?? false });
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      errors += result.errors;
    }

    return {
      scope: allowAllScope ? 'all' : 'user',
      dryRun: dto.dryRun ?? false,
      expensesProcessed: expenses.length,
      created,
      updated,
      skipped,
      errors,
      requestedByUserId: user.id,
      generatedAt: new Date().toISOString(),
    };
  }

  private async evaluateOutlier(input: {
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    unitPrice: number;
  }) {
    const threshold = Number(this.config.get<string>('PRICE_OUTLIER_ZSCORE_THRESHOLD') ?? '3.5');
    const where: Prisma.PriceObservationWhereInput = {
      canonicalItemId: input.canonicalItemId,
    };

    if (input.storeId) {
      where.storeId = input.storeId;
    } else if (input.areaText) {
      where.areaText = input.areaText;
    }

    const rows = await this.prisma.priceObservation.findMany({
      where,
      select: {
        unitPrice: true,
      },
      orderBy: {
        observedAt: 'desc',
      },
      take: 40,
    });

    const baseline = rows.map((row) => decimalToNumber(row.unitPrice)).filter((value) => value > 0);
    const isOutlier = baseline.length >= 5 && isOutlierByRobustZ(input.unitPrice, baseline, threshold);

    return {
      isOutlier,
      outlierComponent: isOutlier ? 0.2 : 1,
      baselineSize: baseline.length,
      threshold,
    };
  }
}
