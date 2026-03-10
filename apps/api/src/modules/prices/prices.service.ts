import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ObservationSource,
  Prisma,
  ProcessingStatus,
  PromoReviewStatus,
  type ExpenseProvenance,
} from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import {
  EXPENSE_PARSER_PROVIDER,
  OCR_PROVIDER,
  ExpenseParserProvider,
  OcrProvider,
} from '../../infrastructure/providers/provider.interfaces';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseStorageService } from '../../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  NotificationsService,
  type AlertPushDispatchResult,
} from '../notifications/notifications.service';
import { BackfillPricesDto } from './dto/backfill-prices.dto';
import { CheckAlertsDto } from './dto/check-alerts.dto';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { IngestPromoDto } from './dto/ingest-promo.dto';
import { ListAlertEventsDto } from './dto/list-alert-events.dto';
import { ListPromosDto } from './dto/list-promos.dto';
import { PriceCompareQueryDto } from './dto/price-compare-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceSignalQueryDto } from './dto/price-signal-query.dto';
import { ReviewPromoObservationsDto } from './dto/review-promo-observations.dto';
import { SearchPriceLocationsQueryDto } from './dto/search-price-locations-query.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';
import { ItemNormalizerService } from './item-normalizer.service';
import {
  computePriceSignal,
  type PriceSignalResult,
} from './price-signal.utils';
import {
  hasSignalAlertCooldownElapsed,
  matchesSignalDecisionFilter,
} from './signal-alerts.utils';
import {
  clamp01,
  computeTrustScore,
  deriveUnitPrice,
  evaluatePriceCandidateLocation,
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

function decimalToOptionalNumber(value: Prisma.Decimal | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return decimalToNumber(value);
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

interface PriceCandidate {
  source: ObservationSource;
  canonicalItemId: string;
  storeId?: string;
  storeName?: string;
  storeLat?: number;
  storeLng?: number;
  areaText?: string;
  unitPrice: number;
  trustScore: number;
  observedAt: Date;
  distanceKm?: number;
}

const DEFAULT_SIGNAL_MIN_CONFIDENCE = 0.65;
const DEFAULT_SIGNAL_COOLDOWN_MINUTES = 360;

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly itemNormalizer: ItemNormalizerService,
    private readonly storeResolver: StoreResolverService,
    private readonly notificationsService: NotificationsService,
    private readonly storage: SupabaseStorageService,
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
    @Inject(EXPENSE_PARSER_PROVIDER) private readonly parserProvider: ExpenseParserProvider,
  ) {}

  isEnabled(): boolean {
    const value =
      this.config.get<string>('PRICE_INTELLIGENCE_ENABLED')?.trim().toLowerCase() ??
      'true';
    return value !== 'false';
  }

  private isAlertsEnabled(): boolean {
    const value = this.config.get<string>('PRICE_ALERTS_ENABLED')?.trim().toLowerCase() ?? 'true';
    return value !== 'false';
  }

  private isPromoEnabled(): boolean {
    const value =
      this.config.get<string>('PROMO_INGESTION_ENABLED')?.trim().toLowerCase() ?? 'true';
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
    const includePromo = query.includePromo === true && this.isPromoEnabled();
    const canonicalItem = await this.itemNormalizer.findCanonicalItemByQuery(query.item);
    if (!canonicalItem) {
      return {
        item: null,
        interval: query.interval ?? 'day',
        points: [],
        totalObservations: 0,
        generatedAt: new Date().toISOString(),
        userId: user.id,
        includePromo,
      };
    }

    const observations = await this.loadPriceCandidates({
      canonicalItemId: canonicalItem.id,
      areaText: query.area,
      storeId: query.storeId,
      from: query.from,
      to: query.to,
      includePromo,
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
      const current = buckets.get(key);

      if (!current) {
        buckets.set(key, {
          min: row.unitPrice,
          max: row.unitPrice,
          sum: row.unitPrice,
          count: 1,
        });
        continue;
      }

      current.min = Math.min(current.min, row.unitPrice);
      current.max = Math.max(current.max, row.unitPrice);
      current.sum += row.unitPrice;
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
      includePromo,
    };
  }

  async compare(user: AuthenticatedUser, query: PriceCompareQueryDto) {
    const includePromo = query.includePromo === true && this.isPromoEnabled();
    const canonicalItem = await this.itemNormalizer.findCanonicalItemByQuery(query.item);
    if (!canonicalItem) {
      return {
        item: null,
        rows: [],
        generatedAt: new Date().toISOString(),
        userId: user.id,
        includePromo,
      };
    }

    const includeDistance =
      typeof query.lat === 'number' &&
      typeof query.lng === 'number' &&
      Number.isFinite(query.lat) &&
      Number.isFinite(query.lng);

    const observations = await this.loadPriceCandidates({
      canonicalItemId: canonicalItem.id,
      areaText: query.area,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm ?? 15,
      includePromo,
    });

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
      const key = observation.storeId
        ? `store:${observation.storeId}`
        : `area:${(observation.areaText ?? 'unknown').toLowerCase()}`;

      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          storeId: observation.storeId,
          storeName: observation.storeName,
          areaText: observation.areaText,
          latestUnitPrice: observation.unitPrice,
          latestAt: observation.observedAt,
          unitPriceSum: observation.unitPrice,
          trustScoreSum: observation.trustScore,
          sampleSize: 1,
          distanceKm: observation.distanceKm,
        });
        continue;
      }

      current.sampleSize += 1;
      current.unitPriceSum += observation.unitPrice;
      current.trustScoreSum += observation.trustScore;
      if (observation.observedAt > current.latestAt) {
        current.latestAt = observation.observedAt;
        current.latestUnitPrice = observation.unitPrice;
        current.distanceKm = observation.distanceKm;
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
      radiusKm: includeDistance ? query.radiusKm ?? 15 : undefined,
      rows,
      generatedAt: new Date().toISOString(),
      userId: user.id,
      includePromo,
    };
  }

  async searchLocations(user: AuthenticatedUser, query: SearchPriceLocationsQueryDto) {
    if (!this.isEnabled()) {
      return {
        items: [],
        generatedAt: new Date().toISOString(),
        userId: user.id,
      };
    }

    const items = await this.storeResolver.searchLocations({
      query: query.q,
      lat: query.lat,
      lng: query.lng,
      limit: query.limit ?? 5,
    });

    return {
      items,
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async getSignal(user: AuthenticatedUser, query: PriceSignalQueryDto) {
    const startedAt = Date.now();
    const includePromo = query.includePromo === true && this.isPromoEnabled();
    const canonicalItem = await this.itemNormalizer.findCanonicalItemByQuery(query.item);

    if (!canonicalItem) {
      this.metrics.trackCounter('signals.request.count', 1, { result: 'item_not_found' });
      this.metrics.trackCounter('signals.decision.count', 1, { decision: 'NEUTRAL' });
      this.metrics.trackCounter('signals.neutral.low_data.count', 1);
      this.metrics.trackTiming('signals.latency_ms', Date.now() - startedAt);
      return {
        item: null,
        decision: 'NEUTRAL',
        confidence: 0,
        expectedDeltaPct: 0,
        horizonDays: query.horizonDays ?? 7,
        sampleSize: 0,
        reasons: [
          {
            code: 'ITEM_NOT_FOUND',
            label: 'No canonical item matched this query',
            value: 0,
            weight: 1,
          },
        ],
        diagnostics: {
          score: 0,
          latestUnitPrice: 0,
          avg7d: 0,
          avg30d: 0,
          trendSlope7d: 0,
          volatility30d: 0,
          sampleSize30d: 0,
          distinctDays30d: 0,
          gatedNeutral: true,
          gateReason: 'LOW_DATA',
        },
        generatedAt: new Date().toISOString(),
        userId: user.id,
        includePromo,
      };
    }

    const horizonDays =
      typeof query.horizonDays === 'number' && Number.isFinite(query.horizonDays)
        ? Math.max(3, Math.min(14, Math.floor(query.horizonDays)))
        : 7;

    const signal = await this.computeSignalForCanonicalItem({
      canonicalItemId: canonicalItem.id,
      storeId: undefined,
      areaText: query.areaText,
      radiusKm: query.radiusKm ?? 15,
      lat: query.lat,
      lng: query.lng,
      includePromo,
      horizonDays,
    });

    this.metrics.trackCounter('signals.request.count', 1, { result: 'ok' });
    this.metrics.trackCounter('signals.decision.count', 1, { decision: signal.decision });
    this.metrics.trackCounter('signals.confidence.score_x1000', Math.round(signal.confidence * 1000), {
      decision: signal.decision,
    });
    if (signal.decision === 'NEUTRAL' && signal.diagnostics.gateReason === 'LOW_DATA') {
      this.metrics.trackCounter('signals.neutral.low_data.count', 1);
    }
    this.metrics.trackTiming('signals.latency_ms', Date.now() - startedAt);

    return {
      item: {
        id: canonicalItem.id,
        canonicalName: canonicalItem.canonicalName,
        canonicalUnit: canonicalItem.canonicalUnit,
      },
      decision: signal.decision,
      confidence: signal.confidence,
      expectedDeltaPct: signal.expectedDeltaPct,
      horizonDays,
      sampleSize: signal.sampleSize,
      reasons: signal.reasons,
      diagnostics: signal.diagnostics,
      generatedAt: new Date().toISOString(),
      userId: user.id,
      includePromo,
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

  async createAlert(user: AuthenticatedUser, dto: CreatePriceAlertDto) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const kind = dto.kind ?? 'THRESHOLD';
    if (kind === 'THRESHOLD' && typeof dto.targetUnitPrice !== 'number') {
      throw new BadRequestException('targetUnitPrice is required for threshold alerts');
    }

    const canonicalItem = await this.resolveCanonicalItemForUser(user.id, dto.item);

    const alert = await this.prisma.priceAlert.create({
      data: {
        userId: user.id,
        canonicalItemId: canonicalItem.id,
        kind,
        storeId: dto.storeId?.trim() || undefined,
        areaText: dto.areaText?.trim() || undefined,
        targetUnitPrice:
          kind === 'THRESHOLD' ? new Prisma.Decimal(dto.targetUnitPrice as number) : null,
        radiusKm:
          typeof dto.radiusKm === 'number'
            ? new Prisma.Decimal(dto.radiusKm)
            : new Prisma.Decimal(10),
        signalDecisionFilter:
          kind === 'SIGNAL' ? (dto.signalDecisionFilter ?? 'BOTH') : null,
        signalMinConfidence: new Prisma.Decimal(
          typeof dto.signalMinConfidence === 'number'
            ? dto.signalMinConfidence
            : DEFAULT_SIGNAL_MIN_CONFIDENCE,
        ),
        signalCooldownMinutes:
          typeof dto.signalCooldownMinutes === 'number'
            ? Math.floor(dto.signalCooldownMinutes)
            : DEFAULT_SIGNAL_COOLDOWN_MINUTES,
        active: dto.active ?? true,
      },
      include: {
        canonicalItem: true,
        store: true,
      },
    });

    return this.serializeAlert(alert);
  }

  async listAlerts(user: AuthenticatedUser) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const alerts = await this.prisma.priceAlert.findMany({
      where: {
        userId: user.id,
      },
      include: {
        canonicalItem: true,
        store: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      total: alerts.length,
      items: alerts.map((alert) => this.serializeAlert(alert)),
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async updateAlert(user: AuthenticatedUser, alertId: string, dto: UpdatePriceAlertDto) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const existing = await this.prisma.priceAlert.findFirst({
      where: {
        id: alertId,
        userId: user.id,
      },
      include: {
        canonicalItem: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found');
    }

    const nextKind = dto.kind ?? existing.kind;
    const isThreshold = nextKind === 'THRESHOLD';
    const nextTargetUnitPrice =
      typeof dto.targetUnitPrice === 'number'
        ? new Prisma.Decimal(dto.targetUnitPrice)
        : undefined;

    if (isThreshold && !nextTargetUnitPrice && !existing.targetUnitPrice) {
      throw new BadRequestException('targetUnitPrice is required for threshold alerts');
    }

    let canonicalItemId: string | undefined;
    if (dto.item?.trim()) {
      const canonicalItem = await this.resolveCanonicalItemForUser(user.id, dto.item);
      canonicalItemId = canonicalItem.id;
    }

    const updated = await this.prisma.priceAlert.update({
      where: {
        id: existing.id,
      },
      data: {
        canonicalItemId,
        kind: nextKind,
        targetUnitPrice: isThreshold ? nextTargetUnitPrice : null,
        radiusKm:
          typeof dto.radiusKm === 'number'
            ? new Prisma.Decimal(dto.radiusKm)
            : undefined,
        signalDecisionFilter: isThreshold
          ? null
          : dto.signalDecisionFilter ?? existing.signalDecisionFilter ?? 'BOTH',
        signalMinConfidence:
          typeof dto.signalMinConfidence === 'number'
            ? new Prisma.Decimal(dto.signalMinConfidence)
            : undefined,
        signalCooldownMinutes:
          typeof dto.signalCooldownMinutes === 'number'
            ? Math.floor(dto.signalCooldownMinutes)
            : undefined,
        areaText:
          typeof dto.areaText === 'string' ? dto.areaText.trim() || null : undefined,
        storeId:
          typeof dto.storeId === 'string' ? dto.storeId.trim() || null : undefined,
        active: typeof dto.active === 'boolean' ? dto.active : undefined,
      },
      include: {
        canonicalItem: true,
        store: true,
      },
    });

    return this.serializeAlert(updated);
  }

  async disableAlert(user: AuthenticatedUser, alertId: string) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const existing = await this.prisma.priceAlert.findFirst({
      where: {
        id: alertId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found');
    }

    await this.prisma.priceAlert.update({
      where: {
        id: existing.id,
      },
      data: {
        active: false,
      },
    });

    return {
      alertId: existing.id,
      active: false,
      updatedAt: new Date().toISOString(),
    };
  }

  async checkAlerts(user: AuthenticatedUser, dto: CheckAlertsDto) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const hasCoordinates =
      typeof dto.lat === 'number' &&
      typeof dto.lng === 'number' &&
      Number.isFinite(dto.lat) &&
      Number.isFinite(dto.lng);

    if (!hasCoordinates && !dto.areaText?.trim()) {
      throw new BadRequestException('Provide lat/lng or areaText for alert check');
    }

    const alerts = await this.prisma.priceAlert.findMany({
      where: {
        userId: user.id,
        active: true,
        kind: 'THRESHOLD',
      },
      include: {
        canonicalItem: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: dto.limit ?? 50,
    });

    const triggered: Array<Record<string, unknown>> = [];
    let pushAttempted = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const alert of alerts) {
      if (!alert.targetUnitPrice) {
        continue;
      }
      const targetUnitPrice = decimalToNumber(alert.targetUnitPrice);
      const radiusKm = decimalToNumber(alert.radiusKm);
      const best = await this.findBestPriceCandidate({
        canonicalItemId: alert.canonicalItemId,
        storeId: alert.storeId ?? undefined,
        areaText: alert.areaText ?? dto.areaText ?? undefined,
        lat: dto.lat,
        lng: dto.lng,
        radiusKm,
        includePromo: dto.includePromo !== false && this.isPromoEnabled(),
      });

      if (!best || best.unitPrice > targetUnitPrice) {
        continue;
      }

      const basePayload = {
        observedAt: best.observedAt.toISOString(),
        trustScore: best.trustScore,
        storeName: best.storeName,
      } satisfies Prisma.InputJsonValue;

      const event = await this.createAlertEventWithCooldown({
        alertId: alert.id,
        userId: user.id,
        canonicalItemId: alert.canonicalItemId,
        storeId: best.storeId,
        areaText: best.areaText,
        source: best.source,
        triggerUnitPrice: best.unitPrice,
        targetUnitPrice,
        distanceKm: best.distanceKm,
        payload: basePayload,
      });

      if (!event) {
        continue;
      }

      const delivery = await this.notificationsService.sendPriceAlertEvent({
        userId: user.id,
        eventId: event.id,
        itemName: alert.canonicalItem.canonicalName,
        triggerUnitPrice: roundTo(best.unitPrice, 2),
        targetUnitPrice: roundTo(targetUnitPrice, 2),
        source: best.source,
        storeName: best.storeName,
        areaText: best.areaText,
      });
      pushAttempted += delivery.attempted;
      pushSent += delivery.sent;
      pushFailed += delivery.failed;

      await this.updateAlertEventDeliveryMetadata(event.id, basePayload, delivery);

      triggered.push({
        eventId: event.id,
        alertId: alert.id,
        item: alert.canonicalItem.canonicalName,
        source: best.source,
        triggerUnitPrice: roundTo(best.unitPrice, 2),
        targetUnitPrice: roundTo(targetUnitPrice, 2),
        distanceKm: best.distanceKm,
        storeId: best.storeId,
        storeName: best.storeName,
        areaText: best.areaText,
        triggeredAt: event.triggeredAt.toISOString(),
        delivery,
      });
    }

    return {
      checked: alerts.length,
      triggeredCount: triggered.length,
      pushAttempted,
      pushSent,
      pushFailed,
      triggered,
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async runScheduledAlertChecks() {
    if (!this.isAlertsEnabled()) {
      return {
        checked: 0,
        triggeredCount: 0,
        pushAttempted: 0,
        pushSent: 0,
        pushFailed: 0,
        generatedAt: new Date().toISOString(),
        alertsEnabled: false,
      };
    }

    const includePromo = this.isPromoEnabled();
    const batchSize = this.getAlertCheckBatchSize();
    let checked = 0;
    let triggeredCount = 0;
    let pushAttempted = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let cursorId: string | undefined;

    while (true) {
      const alerts = await this.prisma.priceAlert.findMany({
        where: {
          active: true,
          kind: 'THRESHOLD',
        },
        include: {
          canonicalItem: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursorId
          ? {
              cursor: { id: cursorId },
              skip: 1,
            }
          : {}),
      });

      if (alerts.length === 0) {
        break;
      }

      for (const alert of alerts) {
        checked += 1;
        if (!alert.targetUnitPrice) {
          continue;
        }

        const targetUnitPrice = decimalToNumber(alert.targetUnitPrice);
        const radiusKm = decimalToNumber(alert.radiusKm);
        const best = await this.findBestPriceCandidate({
          canonicalItemId: alert.canonicalItemId,
          storeId: alert.storeId ?? undefined,
          areaText: alert.areaText ?? undefined,
          radiusKm,
          includePromo,
        });

        if (!best || best.unitPrice > targetUnitPrice) {
          continue;
        }

        const basePayload = {
          observedAt: best.observedAt.toISOString(),
          trustScore: best.trustScore,
          storeName: best.storeName,
          scheduler: true,
        } satisfies Prisma.InputJsonValue;

        const event = await this.createAlertEventWithCooldown({
          alertId: alert.id,
          userId: alert.userId,
          canonicalItemId: alert.canonicalItemId,
          storeId: best.storeId,
          areaText: best.areaText,
          source: best.source,
          triggerUnitPrice: best.unitPrice,
          targetUnitPrice,
          distanceKm: best.distanceKm,
          payload: basePayload,
        });

        if (!event) {
          continue;
        }

        const delivery = await this.notificationsService.sendPriceAlertEvent({
          userId: alert.userId,
          eventId: event.id,
          itemName: alert.canonicalItem.canonicalName,
          triggerUnitPrice: roundTo(best.unitPrice, 2),
          targetUnitPrice: roundTo(targetUnitPrice, 2),
          source: best.source,
          storeName: best.storeName,
          areaText: best.areaText,
        });

        pushAttempted += delivery.attempted;
        pushSent += delivery.sent;
        pushFailed += delivery.failed;
        triggeredCount += 1;

        await this.updateAlertEventDeliveryMetadata(event.id, basePayload, delivery);
      }

      cursorId = alerts[alerts.length - 1]?.id;
      if (!cursorId || alerts.length < batchSize) {
        break;
      }
    }

    return {
      checked,
      triggeredCount,
      pushAttempted,
      pushSent,
      pushFailed,
      generatedAt: new Date().toISOString(),
      alertsEnabled: true,
      includePromo,
    };
  }

  async runScheduledSignalChecks() {
    if (!this.isAlertsEnabled()) {
      return {
        checked: 0,
        triggeredCount: 0,
        cooldownSkipped: 0,
        pushAttempted: 0,
        pushSent: 0,
        pushFailed: 0,
        generatedAt: new Date().toISOString(),
        alertsEnabled: false,
      };
    }

    const includePromo = this.isPromoEnabled();
    const batchSize = this.getAlertCheckBatchSize();
    let checked = 0;
    let triggeredCount = 0;
    let cooldownSkipped = 0;
    let pushAttempted = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let cursorId: string | undefined;

    while (true) {
      const alerts = await this.prisma.priceAlert.findMany({
        where: {
          active: true,
          kind: 'SIGNAL',
        },
        include: {
          canonicalItem: true,
          store: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursorId
          ? {
              cursor: { id: cursorId },
              skip: 1,
            }
          : {}),
      });

      if (alerts.length === 0) {
        break;
      }

      for (const alert of alerts) {
        checked += 1;
        const signal = await this.computeSignalForCanonicalItem({
          canonicalItemId: alert.canonicalItemId,
          storeId: alert.storeId ?? undefined,
          areaText: alert.areaText ?? undefined,
          radiusKm: decimalToNumber(alert.radiusKm),
          includePromo,
          horizonDays: 7,
        });

        if (signal.decision === 'NEUTRAL') {
          continue;
        }

        const decisionFilter = alert.signalDecisionFilter ?? 'BOTH';
        if (!matchesSignalDecisionFilter(decisionFilter, signal.decision)) {
          continue;
        }

        const minConfidence =
          decimalToOptionalNumber(alert.signalMinConfidence) ?? DEFAULT_SIGNAL_MIN_CONFIDENCE;
        if (signal.confidence < minConfidence) {
          continue;
        }

        const latestUnitPrice = signal.diagnostics.latestUnitPrice;
        if (!Number.isFinite(latestUnitPrice) || latestUnitPrice <= 0) {
          continue;
        }

        const basePayload = JSON.parse(
          JSON.stringify({
            scheduler: true,
            signal: {
              decision: signal.decision,
              confidence: signal.confidence,
              expectedDeltaPct: signal.expectedDeltaPct,
              reasons: signal.reasons.map((reason) => ({
                code: reason.code,
                label: reason.label,
                value: reason.value,
                weight: reason.weight,
              })),
              diagnostics: signal.diagnostics,
            },
          }),
        ) as Prisma.InputJsonValue;

        const event = await this.createSignalAlertEventWithCooldown({
          alertId: alert.id,
          userId: alert.userId,
          canonicalItemId: alert.canonicalItemId,
          storeId: alert.storeId ?? undefined,
          areaText: alert.areaText ?? undefined,
          triggerUnitPrice: latestUnitPrice,
          cooldownMinutes: alert.signalCooldownMinutes || DEFAULT_SIGNAL_COOLDOWN_MINUTES,
          payload: basePayload,
        });

        if (!event) {
          cooldownSkipped += 1;
          continue;
        }

        const delivery = await this.notificationsService.sendSignalAlertEvent({
          userId: alert.userId,
          eventId: event.id,
          itemName: alert.canonicalItem.canonicalName,
          decision: signal.decision,
          confidence: signal.confidence,
          expectedDeltaPct: signal.expectedDeltaPct,
          latestUnitPrice: roundTo(latestUnitPrice, 2),
          storeName: alert.store?.displayName ?? undefined,
          areaText: alert.areaText ?? undefined,
        });

        pushAttempted += delivery.attempted;
        pushSent += delivery.sent;
        pushFailed += delivery.failed;
        triggeredCount += 1;

        await this.updateAlertEventDeliveryMetadata(event.id, basePayload, delivery);
      }

      cursorId = alerts[alerts.length - 1]?.id;
      if (!cursorId || alerts.length < batchSize) {
        break;
      }
    }

    this.metrics.trackCounter('signals.alerts.checked.count', checked);
    this.metrics.trackCounter('signals.alerts.triggered.count', triggeredCount);
    this.metrics.trackCounter('signals.alerts.cooldown_skipped.count', cooldownSkipped);

    return {
      checked,
      triggeredCount,
      cooldownSkipped,
      pushAttempted,
      pushSent,
      pushFailed,
      generatedAt: new Date().toISOString(),
      alertsEnabled: true,
      includePromo,
    };
  }

  async listAlertEvents(user: AuthenticatedUser, query: ListAlertEventsDto) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const events = await this.prisma.alertEvent.findMany({
      where: {
        userId: user.id,
        readAt: query.unreadOnly ? null : undefined,
      },
      include: {
        canonicalItem: true,
        store: true,
      },
      orderBy: {
        triggeredAt: 'desc',
      },
      take: query.limit ?? 20,
    });

    return {
      total: events.length,
      items: events.map((event) => {
        const payload = asRecord(event.payload);
        const delivery = asRecord(payload.delivery as Prisma.JsonValue | undefined);
        const signal = asRecord(payload.signal as Prisma.JsonValue | undefined);
        const attempted = Number(delivery.attempted ?? 0);
        return {
          id: event.id,
          alertId: event.alertId,
          eventKind: event.eventKind,
          item: event.canonicalItem.canonicalName,
          source: event.source,
          triggerUnitPrice: decimalToNumber(event.triggerUnitPrice),
          targetUnitPrice: decimalToOptionalNumber(event.targetUnitPrice),
          distanceKm: event.distanceKm ? decimalToNumber(event.distanceKm) : undefined,
          storeId: event.storeId ?? undefined,
          storeName: event.store?.displayName ?? undefined,
          areaText: event.areaText ?? undefined,
          signal:
            typeof signal.decision === 'string'
              ? {
                  decision: signal.decision,
                  confidence:
                    typeof signal.confidence === 'number' ? signal.confidence : undefined,
                  expectedDeltaPct:
                    typeof signal.expectedDeltaPct === 'number'
                      ? signal.expectedDeltaPct
                      : undefined,
                }
              : undefined,
          triggeredAt: event.triggeredAt.toISOString(),
          readAt: event.readAt?.toISOString() ?? null,
          deliveryStatus:
            (typeof delivery.status === 'string' ? delivery.status : undefined) ?? undefined,
          notificationSentAt:
            typeof delivery.sentAt === 'string' ? delivery.sentAt : undefined,
          pushAttempted:
            Number.isFinite(attempted) && attempted > 0 ? Math.floor(attempted) : undefined,
        };
      }),
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async markAlertEventRead(user: AuthenticatedUser, eventId: string) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const event = await this.prisma.alertEvent.findFirst({
      where: {
        id: eventId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Alert event not found');
    }

    const updated = await this.prisma.alertEvent.update({
      where: { id: event.id },
      data: {
        readAt: new Date(),
      },
    });

    return {
      id: updated.id,
      readAt: updated.readAt?.toISOString() ?? null,
    };
  }

  async markAllAlertEventsRead(user: AuthenticatedUser) {
    if (!this.isAlertsEnabled()) {
      throw new ForbiddenException('Price alerts are disabled');
    }
    const now = new Date();
    const updated = await this.prisma.alertEvent.updateMany({
      where: {
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });

    return {
      updated: updated.count,
      readAt: now.toISOString(),
      userId: user.id,
    };
  }

  async ingestPromo(user: AuthenticatedUser, dto: IngestPromoDto) {
    if (!this.isPromoEnabled()) {
      throw new ForbiddenException('Promo ingestion is disabled');
    }
    const ingestion = await this.prisma.promoIngestion.create({
      data: {
        userId: user.id,
        fileRef: dto.fileRef,
        mimeType: dto.mimeType,
        merchantText: dto.merchantText?.trim() || undefined,
        areaText: dto.areaText?.trim() || undefined,
        status: ProcessingStatus.PROCESSING,
      },
    });

    try {
      const imageBase64 = await this.storage.downloadAsBase64(dto.fileRef);
      if (!imageBase64) {
        throw new BadRequestException('Unable to download promo artifact from storage');
      }

      const ocr = await this.ocrProvider.extract({
        imageUrl: `data:${dto.mimeType};base64,${imageBase64}`,
      });
      const parsed = await this.parserProvider.parseReceipt(ocr.rawText);

      const storeContext = await this.storeResolver.resolveStore({
        merchantText: dto.merchantText ?? parsed.merchantText,
        areaText: dto.areaText,
        locationLat: null,
        locationLng: null,
      });

      let created = 0;
      let skipped = 0;

      for (const lineItem of parsed.lineItems) {
        const unitPrice = deriveUnitPrice({
          totalPrice: lineItem.totalPrice,
          quantity: lineItem.quantity,
          unitPrice: lineItem.unitPrice,
        });

        if (!unitPrice || !lineItem.descriptionRaw?.trim()) {
          skipped += 1;
          continue;
        }

        const normalizedItem = await this.itemNormalizer.resolveCanonicalItem({
          descriptionRaw: lineItem.descriptionRaw,
          unitRaw: lineItem.unitRaw,
          locale: 'en-MY',
        });

        const outlierEvaluation = await this.evaluateOutlier({
          canonicalItemId: normalizedItem.canonicalItem.id,
          storeId: storeContext.storeId,
          areaText: storeContext.areaText,
          unitPrice,
        });

        const trustScore = computeTrustScore({
          sourceWeight: 0.7,
          fieldConfidence: clamp01(lineItem.confidence ?? 0.7),
          locationConfidence: storeContext.locationConfidence,
          outlierComponent: outlierEvaluation.outlierComponent,
        });

        await this.prisma.promoObservation.create({
          data: {
            ingestionId: ingestion.id,
            userId: user.id,
            canonicalItemId: normalizedItem.canonicalItem.id,
            storeId: storeContext.storeId,
            areaText: storeContext.areaText,
            currency: parsed.currency,
            quantity:
              typeof lineItem.quantity === 'number' && lineItem.quantity > 0
                ? new Prisma.Decimal(lineItem.quantity)
                : undefined,
            unitRaw: lineItem.unitRaw,
            unitPrice: new Prisma.Decimal(unitPrice),
            totalPrice:
              typeof lineItem.totalPrice === 'number'
                ? new Prisma.Decimal(lineItem.totalPrice)
                : undefined,
            trustScore: new Prisma.Decimal(trustScore),
            reviewStatus: dto.autoApprove ? PromoReviewStatus.APPROVED : PromoReviewStatus.PENDING,
            validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
            validTo: dto.validTo ? new Date(dto.validTo) : undefined,
            metadata: {
              source: 'promo_ocr',
              confidence: lineItem.confidence ?? null,
              canonicalization: {
                aliasText: normalizedItem.aliasText,
                confidence: normalizedItem.confidence,
              },
            } satisfies Prisma.InputJsonValue,
          },
        });
        created += 1;
      }

      await this.prisma.promoIngestion.update({
        where: {
          id: ingestion.id,
        },
        data: {
          status: ProcessingStatus.COMPLETED,
          rawText: ocr.rawText,
          ocrRaw: ocr.rawPayload as Prisma.InputJsonValue,
          parsedPayload: parsed as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        ingestionId: ingestion.id,
        status: ProcessingStatus.COMPLETED,
        created,
        skipped,
        reviewStatus: dto.autoApprove ? PromoReviewStatus.APPROVED : PromoReviewStatus.PENDING,
      };
    } catch (error) {
      await this.prisma.promoIngestion.update({
        where: {
          id: ingestion.id,
        },
        data: {
          status: ProcessingStatus.FAILED,
          errorText: String(error),
        },
      });
      throw error;
    }
  }

  async listPromos(user: AuthenticatedUser, query: ListPromosDto) {
    if (!this.isPromoEnabled()) {
      throw new ForbiddenException('Promo ingestion is disabled');
    }
    const ingestions = await this.prisma.promoIngestion.findMany({
      where: {
        userId: user.id,
        status: query.status,
      },
      include: {
        observations: {
          where: {
            reviewStatus: query.reviewStatus,
          },
          include: {
            canonicalItem: true,
            store: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 10,
    });

    return {
      total: ingestions.length,
      items: ingestions.map((ingestion) => ({
        id: ingestion.id,
        fileRef: ingestion.fileRef,
        mimeType: ingestion.mimeType,
        merchantText: ingestion.merchantText,
        areaText: ingestion.areaText,
        status: ingestion.status,
        errorText: ingestion.errorText,
        createdAt: ingestion.createdAt.toISOString(),
        observations: ingestion.observations.map((observation) => ({
          id: observation.id,
          item: observation.canonicalItem.canonicalName,
          reviewStatus: observation.reviewStatus,
          unitPrice: decimalToNumber(observation.unitPrice),
          trustScore: decimalToNumber(observation.trustScore),
          storeId: observation.storeId ?? undefined,
          storeName: observation.store?.displayName ?? undefined,
          areaText: observation.areaText ?? undefined,
          validFrom: observation.validFrom?.toISOString() ?? null,
          validTo: observation.validTo?.toISOString() ?? null,
        })),
      })),
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async reviewPromoObservations(user: AuthenticatedUser, dto: ReviewPromoObservationsDto) {
    if (!this.isPromoEnabled()) {
      throw new ForbiddenException('Promo ingestion is disabled');
    }
    const ids = dto.observations.map((item) => item.id);
    const result = await this.prisma.promoObservation.updateMany({
      where: {
        id: {
          in: ids,
        },
        userId: user.id,
      },
      data: {
        reviewStatus: dto.reviewStatus,
      },
    });

    return {
      updated: result.count,
      reviewStatus: dto.reviewStatus,
      updatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  private async loadPriceCandidates(input: {
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    from?: string;
    to?: string;
    includePromo: boolean;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<PriceCandidate[]> {
    const expenseWhere: Prisma.PriceObservationWhereInput = {
      canonicalItemId: input.canonicalItemId,
    };

    if (input.storeId) {
      expenseWhere.storeId = input.storeId;
    }
    if (input.from || input.to) {
      expenseWhere.observedAt = {
        gte: input.from ? new Date(input.from) : undefined,
        lte: input.to ? new Date(input.to) : undefined,
      };
    }

    const now = new Date();
    const promoWhere: Prisma.PromoObservationWhereInput = {
      canonicalItemId: input.canonicalItemId,
      reviewStatus: PromoReviewStatus.APPROVED,
      AND: [
        {
          OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        },
        {
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      ],
    };

    if (input.storeId) {
      promoWhere.storeId = input.storeId;
    }
    if (input.from || input.to) {
      promoWhere.observedAt = {
        gte: input.from ? new Date(input.from) : undefined,
        lte: input.to ? new Date(input.to) : undefined,
      };
    }

    const [expenseRows, promoRows] = await Promise.all([
      this.prisma.priceObservation.findMany({
        where: expenseWhere,
        include: {
          store: true,
        },
        orderBy: {
          observedAt: 'desc',
        },
        take: 3000,
      }),
      input.includePromo
        ? this.prisma.promoObservation.findMany({
            where: promoWhere,
            include: {
              store: true,
            },
            orderBy: {
              observedAt: 'desc',
            },
            take: 1000,
          })
        : Promise.resolve([]),
    ]);

    const rawCandidates: PriceCandidate[] = [
      ...expenseRows.map((row) => ({
        source: ObservationSource.EXPENSE,
        canonicalItemId: row.canonicalItemId,
        storeId: row.storeId ?? undefined,
        storeName: row.store?.displayName ?? undefined,
        storeLat: row.store?.lat ? decimalToNumber(row.store.lat) : undefined,
        storeLng: row.store?.lng ? decimalToNumber(row.store.lng) : undefined,
        areaText: row.areaText ?? undefined,
        unitPrice: decimalToNumber(row.unitPrice),
        trustScore: decimalToNumber(row.trustScore),
        observedAt: row.observedAt,
      })),
      ...promoRows.map((row) => ({
        source: ObservationSource.PROMO,
        canonicalItemId: row.canonicalItemId,
        storeId: row.storeId ?? undefined,
        storeName: row.store?.displayName ?? undefined,
        storeLat: row.store?.lat ? decimalToNumber(row.store.lat) : undefined,
        storeLng: row.store?.lng ? decimalToNumber(row.store.lng) : undefined,
        areaText: row.areaText ?? undefined,
        unitPrice: decimalToNumber(row.unitPrice),
        trustScore: decimalToNumber(row.trustScore),
        observedAt: row.observedAt,
      })),
    ];

    const candidates: PriceCandidate[] = [];
    for (const row of rawCandidates) {
      const locationMatch = evaluatePriceCandidateLocation({
        lat: input.lat,
        lng: input.lng,
        radiusKm: input.radiusKm,
        areaText: input.areaText,
        candidate: {
          storeLat: row.storeLat,
          storeLng: row.storeLng,
          areaText: row.areaText,
        },
      });

      if (!locationMatch.include) {
        continue;
      }

      candidates.push({
        ...row,
        distanceKm:
          typeof locationMatch.distanceKm === 'number'
            ? roundTo(locationMatch.distanceKm, 2)
            : undefined,
      });
    }

    return candidates;
  }

  private async findBestPriceCandidate(input: {
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    lat?: number;
    lng?: number;
    radiusKm: number;
    includePromo: boolean;
  }): Promise<PriceCandidate | null> {
    const rows = await this.loadPriceCandidates({
      canonicalItemId: input.canonicalItemId,
      storeId: input.storeId,
      areaText: input.areaText,
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      includePromo: input.includePromo,
    });

    if (rows.length === 0) {
      return null;
    }

    rows.sort((a, b) => {
      if (a.unitPrice !== b.unitPrice) {
        return a.unitPrice - b.unitPrice;
      }
      if (a.trustScore !== b.trustScore) {
        return b.trustScore - a.trustScore;
      }
      return b.observedAt.getTime() - a.observedAt.getTime();
    });

    return rows[0];
  }

  private async createAlertEventWithCooldown(input: {
    alertId: string;
    userId: string;
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    source: ObservationSource;
    triggerUnitPrice: number;
    targetUnitPrice: number;
    distanceKm?: number;
    payload: Prisma.InputJsonValue;
  }) {
    const latest = await this.prisma.alertEvent.findFirst({
      where: {
        alertId: input.alertId,
        eventKind: 'THRESHOLD',
      },
      orderBy: {
        triggeredAt: 'desc',
      },
    });

    if (latest) {
      const cooldownMinutes = this.getAlertCooldownMinutes();
      const elapsedMs = Date.now() - latest.triggeredAt.getTime();
      const sameStore = (latest.storeId ?? '') === (input.storeId ?? '');
      const samePrice =
        Math.abs(decimalToNumber(latest.triggerUnitPrice) - input.triggerUnitPrice) < 0.01;

      if (sameStore && samePrice && elapsedMs < cooldownMinutes * 60 * 1000) {
        return null;
      }
    }

    return this.prisma.alertEvent.create({
      data: {
        alertId: input.alertId,
        userId: input.userId,
        canonicalItemId: input.canonicalItemId,
        eventKind: 'THRESHOLD',
        storeId: input.storeId,
        areaText: input.areaText,
        source: input.source,
        triggerUnitPrice: new Prisma.Decimal(input.triggerUnitPrice),
        targetUnitPrice: new Prisma.Decimal(input.targetUnitPrice),
        distanceKm:
          typeof input.distanceKm === 'number'
            ? new Prisma.Decimal(input.distanceKm)
            : undefined,
        payload: input.payload,
      },
    });
  }

  private async createSignalAlertEventWithCooldown(input: {
    alertId: string;
    userId: string;
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    triggerUnitPrice: number;
    cooldownMinutes: number;
    payload: Prisma.InputJsonValue;
  }) {
    const latest = await this.prisma.alertEvent.findFirst({
      where: {
        alertId: input.alertId,
        eventKind: 'SIGNAL',
      },
      orderBy: {
        triggeredAt: 'desc',
      },
    });

    if (latest) {
      if (!hasSignalAlertCooldownElapsed(latest.triggeredAt, input.cooldownMinutes)) {
        return null;
      }
    }

    return this.prisma.alertEvent.create({
      data: {
        alertId: input.alertId,
        userId: input.userId,
        canonicalItemId: input.canonicalItemId,
        eventKind: 'SIGNAL',
        storeId: input.storeId,
        areaText: input.areaText,
        source: ObservationSource.EXPENSE,
        triggerUnitPrice: new Prisma.Decimal(input.triggerUnitPrice),
        targetUnitPrice: null,
        payload: input.payload,
      },
    });
  }

  private getAlertCheckBatchSize(): number {
    const raw = this.config.get<string>('ALERT_CHECK_BATCH_SIZE')?.trim();
    const parsed = Number(raw ?? '200');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 200;
    }
    return Math.floor(parsed);
  }

  private async updateAlertEventDeliveryMetadata(
    eventId: string,
    basePayload: Prisma.InputJsonValue,
    delivery: AlertPushDispatchResult,
  ) {
    const status = !delivery.enabled
      ? 'DISABLED'
      : delivery.attempted <= 0
        ? 'SKIPPED'
        : delivery.failed === 0
          ? 'SENT'
          : delivery.sent > 0
            ? 'PARTIAL'
            : 'FAILED';

    const payload = {
      ...asRecord(basePayload as Prisma.JsonValue),
      delivery: {
        status,
        enabled: delivery.enabled,
        provider: delivery.provider,
        attempted: delivery.attempted,
        sent: delivery.sent,
        failed: delivery.failed,
        revoked: delivery.revoked,
        failures: delivery.failures,
        sentAt: delivery.sentAt,
      },
    } satisfies Prisma.InputJsonValue;

    await this.prisma.alertEvent.update({
      where: { id: eventId },
      data: {
        payload,
      },
    });
  }

  private getAlertCooldownMinutes(): number {
    const raw = this.config.get<string>('ALERT_EVENT_COOLDOWN_MINUTES')?.trim();
    const parsed = Number(raw ?? '180');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 180;
    }
    return parsed;
  }

  private async computeSignalForCanonicalItem(input: {
    canonicalItemId: string;
    storeId?: string;
    areaText?: string;
    lat?: number;
    lng?: number;
    radiusKm: number;
    includePromo: boolean;
    horizonDays: number;
  }): Promise<PriceSignalResult> {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const observations = await this.loadPriceCandidates({
      canonicalItemId: input.canonicalItemId,
      storeId: input.storeId,
      areaText: input.areaText,
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      from,
      includePromo: input.includePromo,
    });

    return computePriceSignal({
      observations: observations.map((row) => ({
        unitPrice: row.unitPrice,
        observedAt: row.observedAt,
        source: row.source,
      })),
      horizonDays: input.horizonDays,
    });
  }

  private async resolveCanonicalItemForUser(userId: string, itemText: string) {
    const text = itemText.trim();
    if (!text) {
      throw new BadRequestException('item is required');
    }

    const existing = await this.itemNormalizer.findCanonicalItemByQuery(text);
    if (existing) {
      return existing;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        locale: true,
      },
    });

    const result = await this.itemNormalizer.resolveCanonicalItem({
      descriptionRaw: text,
      locale: user?.locale ?? 'en-MY',
    });

    return result.canonicalItem;
  }

  private serializeAlert(
    alert: Prisma.PriceAlertGetPayload<{
      include: {
        canonicalItem: true;
        store: true;
      };
    }>,
  ) {
    return {
      id: alert.id,
      item: {
        id: alert.canonicalItem.id,
        canonicalName: alert.canonicalItem.canonicalName,
        canonicalUnit: alert.canonicalItem.canonicalUnit,
      },
      kind: alert.kind,
      targetUnitPrice: decimalToOptionalNumber(alert.targetUnitPrice),
      radiusKm: decimalToNumber(alert.radiusKm),
      active: alert.active,
      areaText: alert.areaText ?? undefined,
      storeId: alert.storeId ?? undefined,
      storeName: alert.store?.displayName ?? undefined,
      signalDecisionFilter: alert.signalDecisionFilter ?? undefined,
      signalMinConfidence: decimalToNumber(alert.signalMinConfidence),
      signalCooldownMinutes: alert.signalCooldownMinutes,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
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
