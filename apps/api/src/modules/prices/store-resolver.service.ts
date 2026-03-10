import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StoreProvider } from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { haversineDistanceKm, normalizeLooseText, roundTo } from './price-intelligence.utils';

interface NominatimSearchResult {
  place_id?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface NominatimRequestInput {
  query: string;
  limit: number;
}

export interface PriceLocationSearchResult {
  providerPlaceId?: string;
  label: string;
  address: string;
  areaText: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

interface LocalLocationSuggestion {
  label: string;
  address: string;
  areaText: string;
  lat: number;
  lng: number;
}

function splitAddressSegments(value: string): string[] {
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isAdministrativeSegment(value: string): boolean {
  const normalized = normalizeLooseText(value);
  return (
    normalized.length <= 2 ||
    normalized.includes('county') ||
    normalized.includes('province') ||
    normalized.includes('state') ||
    normalized.includes('region') ||
    normalized.includes('territory') ||
    normalized.includes('country')
  );
}

function deriveQueryAreaText(label: string, address: string): string {
  const normalizedLabel = normalizeLooseText(label);
  const segments = splitAddressSegments(address);
  for (const segment of segments) {
    const normalizedSegment = normalizeLooseText(segment);
    if (!normalizedSegment || normalizedSegment === normalizedLabel) {
      continue;
    }
    if (isAdministrativeSegment(segment)) {
      continue;
    }
    return segment;
  }

  return label.trim() || segments[0] || address.trim();
}

function asNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toDecimal(value: number | null | undefined): Prisma.Decimal | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return new Prisma.Decimal(value);
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  return value.toNumber();
}

@Injectable()
export class StoreResolverService {
  private readonly logger = new Logger(StoreResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async resolveStore(input: {
    merchantText?: string | null;
    areaText?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
  }) {
    const merchant = normalizeLooseText(input.merchantText ?? '');
    const area = normalizeLooseText(input.areaText ?? '');

    if (!merchant) {
      return {
        storeId: undefined,
        areaText: area || undefined,
        locationConfidence: area ? 0.7 : 0.4,
        providerPlaceId: undefined,
      };
    }

    const existing = await this.prisma.store.findFirst({
      where: {
        normalizedName: merchant,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existing) {
      return {
        storeId: existing.id,
        areaText: area || undefined,
        locationConfidence: existing.providerPlaceId ? 1 : 0.85,
        providerPlaceId: existing.providerPlaceId ?? undefined,
      };
    }

    const nominatim = await this.lookupNominatim({
      merchant,
      area,
      lat: input.locationLat ?? null,
      lng: input.locationLng ?? null,
    });

    if (!nominatim) {
      return {
        storeId: undefined,
        areaText: area || undefined,
        locationConfidence: area ? 0.7 : 0.4,
        providerPlaceId: undefined,
      };
    }

    const providerPlaceId = String(nominatim.place_id ?? '').trim();
    const displayName = nominatim.display_name?.trim() || input.merchantText?.trim() || merchant;
    const lat = asNumber(nominatim.lat);
    const lng = asNumber(nominatim.lon);

    const store = providerPlaceId
      ? await this.prisma.store.upsert({
          where: {
            provider_providerPlaceId: {
              provider: StoreProvider.OSM_NOMINATIM,
              providerPlaceId,
            },
          },
          create: {
            displayName,
            normalizedName: merchant,
            provider: StoreProvider.OSM_NOMINATIM,
            providerPlaceId,
            lat: toDecimal(lat),
            lng: toDecimal(lng),
            address: displayName,
          },
          update: {
            displayName,
            normalizedName: merchant,
            lat: toDecimal(lat),
            lng: toDecimal(lng),
            address: displayName,
          },
        })
      : await this.prisma.store.create({
          data: {
            displayName,
            normalizedName: merchant,
            provider: StoreProvider.OSM_NOMINATIM,
            lat: toDecimal(lat),
            lng: toDecimal(lng),
            address: displayName,
          },
        });

    const hasCoordinates = lat !== null && lng !== null;
    return {
      storeId: store.id,
      areaText: area || undefined,
      locationConfidence: hasCoordinates ? 1 : 0.85,
      providerPlaceId: providerPlaceId || undefined,
    };
  }

  async searchLocations(input: {
    query: string;
    lat?: number;
    lng?: number;
    limit?: number;
  }): Promise<PriceLocationSearchResult[]> {
    const query = input.query.trim();
    if (!query) {
      return [];
    }
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 5), 1), 8);
    let externalResults: PriceLocationSearchResult[] = [];

    try {
      const payload = await this.searchNominatim({
        query,
        limit,
      });
      externalResults = this.mapLocationSearchResultsFromNominatim(payload, input);
    } catch (error) {
      this.logger.warn(`Nominatim autocomplete failed for query "${query}": ${String(error)}`);
      this.metrics.trackCounter('prices.geocode.error.count', 1);
    }

    const localResults = await this.searchLocalLocations({
      query,
      lat: input.lat,
      lng: input.lng,
      limit,
    });

    return this.mergeLocationSearchResults([...externalResults, ...localResults], limit);
  }

  private async lookupNominatim(input: {
    merchant: string;
    area: string;
    lat: number | null;
    lng: number | null;
  }): Promise<NominatimSearchResult | null> {
    const query = [input.merchant, input.area].filter(Boolean).join(' ').trim();
    if (!query) {
      return null;
    }

    try {
      const payload = await this.searchNominatim({
        query,
        limit: 3,
      });
      if (payload.length === 0) {
        return null;
      }

      const candidate = payload[0];
      if (input.lat === null || input.lng === null) {
        return candidate;
      }

      let best = candidate;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const row of payload) {
        const rowLat = asNumber(row.lat);
        const rowLng = asNumber(row.lon);
        if (rowLat === null || rowLng === null) {
          continue;
        }

        const distance = haversineDistanceKm(
          { lat: input.lat, lng: input.lng },
          { lat: rowLat, lng: rowLng },
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          best = row;
        }
      }

      this.metrics.trackTiming('prices.geocode.closest_distance_km', roundTo(bestDistance, 3));
      return best;
    } catch (error) {
      this.logger.warn(`Nominatim lookup failed for query "${query}": ${String(error)}`);
      this.metrics.trackCounter('prices.geocode.error.count', 1);
      return null;
    }
  }

  private async searchNominatim(input: NominatimRequestInput): Promise<NominatimSearchResult[]> {
    const baseUrl = this.config.get<string>('NOMINATIM_BASE_URL')?.trim();
    const userAgent = this.config.get<string>('NOMINATIM_USER_AGENT')?.trim();

    if (!baseUrl || !userAgent) {
      this.metrics.trackCounter('prices.geocode.disabled.count', 1);
      return [];
    }

    const url = new URL('/search', baseUrl);
    url.searchParams.set('q', input.query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', String(input.limit));

    const startedAt = Date.now();
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const payload = (await response.json()) as NominatimSearchResult[];
    this.metrics.trackCounter('prices.geocode.hit.count', 1);
    this.metrics.trackTiming('prices.geocode.latency_ms', Date.now() - startedAt);

    return Array.isArray(payload) ? payload : [];
  }

  private mapLocationSearchResultsFromNominatim(
    payload: NominatimSearchResult[],
    input: {
      lat?: number;
      lng?: number;
    },
  ): PriceLocationSearchResult[] {
    const hasOrigin = typeof input.lat === 'number' && typeof input.lng === 'number';
    const mapped: PriceLocationSearchResult[] = payload.flatMap((row) => {
      const lat = asNumber(row.lat);
      const lng = asNumber(row.lon);
      const address = row.display_name?.trim() ?? '';

      if (lat === null || lng === null || !address) {
        return [];
      }

      const label = address.split(',')[0]?.trim() || address;
      const distanceKm = hasOrigin
        ? roundTo(
            haversineDistanceKm(
              { lat: input.lat as number, lng: input.lng as number },
              { lat, lng },
            ),
            3,
          )
        : undefined;

      return [{
        providerPlaceId: String(row.place_id ?? '').trim() || undefined,
        label,
        address,
        areaText: deriveQueryAreaText(label, address),
        lat,
        lng,
        distanceKm,
      } satisfies PriceLocationSearchResult];
    });

    if (hasOrigin) {
      mapped.sort(
        (left, right) =>
          (left.distanceKm ?? Number.POSITIVE_INFINITY) -
          (right.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    }

    return mapped;
  }

  private async searchLocalLocations(input: {
    query: string;
    lat?: number;
    lng?: number;
    limit: number;
  }): Promise<PriceLocationSearchResult[]> {
    const normalizedQuery = normalizeLooseText(input.query);
    const hasOrigin = typeof input.lat === 'number' && typeof input.lng === 'number';
    const storeWhereOr: Prisma.StoreWhereInput[] = [
      { displayName: { contains: input.query, mode: 'insensitive' } },
      { address: { contains: input.query, mode: 'insensitive' } },
    ];

    if (normalizedQuery) {
      storeWhereOr.push({ normalizedName: { contains: normalizedQuery } });
    }

    const [stores, expenses] = await Promise.all([
      this.prisma.store.findMany({
        where: {
          OR: storeWhereOr,
        },
        take: input.limit,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.prisma.expense.findMany({
        where: {
          areaText: { contains: input.query, mode: 'insensitive' },
          locationLat: { not: null },
          locationLng: { not: null },
        },
        select: {
          areaText: true,
          locationLat: true,
          locationLng: true,
          updatedAt: true,
        },
        distinct: ['areaText'],
        take: input.limit,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    const storeSuggestions: LocalLocationSuggestion[] = stores.flatMap((store) => {
      const lat = decimalToNumber(store.lat);
      const lng = decimalToNumber(store.lng);
      if (lat === null || lng === null) {
        return [];
      }

      const address = store.address?.trim() || store.displayName.trim();
      return [{
        label: store.displayName.trim(),
        address,
        areaText: deriveQueryAreaText(store.displayName.trim(), address),
        lat,
        lng,
      }];
    });

    const areaSuggestions: LocalLocationSuggestion[] = expenses.flatMap((expense) => {
      const lat = decimalToNumber(expense.locationLat);
      const lng = decimalToNumber(expense.locationLng);
      const areaText = expense.areaText?.trim() ?? '';

      if (!areaText || lat === null || lng === null) {
        return [];
      }

      return [{
        label: areaText.split(',')[0]?.trim() || areaText,
        address: areaText,
        areaText: deriveQueryAreaText(areaText.split(',')[0]?.trim() || areaText, areaText),
        lat,
        lng,
      }];
    });

    const mapped = [...storeSuggestions, ...areaSuggestions].map((row) => ({
      providerPlaceId: undefined,
      label: row.label,
      address: row.address,
      areaText: row.areaText,
      lat: row.lat,
      lng: row.lng,
      distanceKm: hasOrigin
        ? roundTo(
            haversineDistanceKm(
              { lat: input.lat as number, lng: input.lng as number },
              { lat: row.lat, lng: row.lng },
            ),
            3,
          )
        : undefined,
    }));

    if (hasOrigin) {
      mapped.sort(
        (left, right) =>
          (left.distanceKm ?? Number.POSITIVE_INFINITY) -
          (right.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    }

    return mapped.slice(0, input.limit);
  }

  private mergeLocationSearchResults(
    items: PriceLocationSearchResult[],
    limit: number,
  ): PriceLocationSearchResult[] {
    const seen = new Set<string>();
    const deduped: PriceLocationSearchResult[] = [];

    for (const item of items) {
      const key = `${normalizeLooseText(item.address)}:${roundTo(item.lat, 4)}:${roundTo(item.lng, 4)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
  }
}
