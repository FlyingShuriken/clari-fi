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

  private async lookupNominatim(input: {
    merchant: string;
    area: string;
    lat: number | null;
    lng: number | null;
  }): Promise<NominatimSearchResult | null> {
    const baseUrl = this.config.get<string>('NOMINATIM_BASE_URL')?.trim();
    const userAgent = this.config.get<string>('NOMINATIM_USER_AGENT')?.trim();

    if (!baseUrl || !userAgent) {
      this.metrics.trackCounter('prices.geocode.disabled.count', 1);
      return null;
    }

    const query = [input.merchant, input.area].filter(Boolean).join(' ').trim();
    if (!query) {
      return null;
    }

    const url = new URL('/search', baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '3');

    const startedAt = Date.now();

    try {
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

      if (!Array.isArray(payload) || payload.length === 0) {
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
}
