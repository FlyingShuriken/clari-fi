import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { loadPriceCompare } from '../../../shared/api';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import type { StoreAggregate, StoreItemPrice } from '../types/store-aggregate';

interface UseMultiItemCompareResult {
  stores: StoreAggregate[];
  loading: boolean;
  error: string | null;
  refetch: (items: string[], lat: number, lng: number, radiusKm: number) => Promise<void>;
}

function makeStoreKey(storeName?: string, areaText?: string, storeId?: string): string {
  if (storeId) return storeId;
  return `${(storeName ?? '').toLowerCase().trim()}::${(areaText ?? '').toLowerCase().trim()}`;
}

export function useMultiItemCompare(): UseMultiItemCompareResult {
  const { getToken } = useAuth();
  const controller = useClariFiController();
  const [stores, setStores] = useState<StoreAggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(
    async (items: string[], lat: number, lng: number, radiusKm: number) => {
      if (items.length === 0) return;
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError('Not authenticated');
          return;
        }

        const results = await Promise.allSettled(
          items.map((item) =>
            loadPriceCompare(controller.apiBaseUrl, token, {
              item,
              lat,
              lng,
              radiusKm,
              includePromo: true,
            }),
          ),
        );

        const storeMap = new Map<
          string,
          {
            storeId: string;
            storeName: string;
            areaText: string;
            distanceKm: number;
            items: StoreItemPrice[];
          }
        >();

        results.forEach((result, idx) => {
          if (result.status !== 'fulfilled') return;
          const itemName = items[idx];
          for (const row of result.value.rows) {
            const key = makeStoreKey(row.storeName, row.areaText, row.storeId);
            if (!storeMap.has(key)) {
              storeMap.set(key, {
                storeId: row.storeId ?? key,
                storeName: row.storeName ?? 'Unknown store',
                areaText: row.areaText ?? '',
                distanceKm: row.distanceKm ?? 999,
                items: [],
              });
            }
            storeMap.get(key)!.items.push({
              itemName,
              latestUnitPrice: row.latestUnitPrice,
              averageUnitPrice: row.averageUnitPrice,
              averageTrustScore: row.averageTrustScore,
              sampleSize: row.sampleSize,
            });
          }
        });

        const aggregated: StoreAggregate[] = Array.from(storeMap.values()).map((s) => ({
          ...s,
          totalLatestPrice: s.items.reduce((sum, i) => sum + i.latestUnitPrice, 0),
          itemCoverage: s.items.length,
        }));

        aggregated.sort((a, b) => a.distanceKm - b.distanceKm);
        setStores(aggregated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch prices');
      } finally {
        setLoading(false);
      }
    },
    [getToken, controller.apiBaseUrl],
  );

  return { stores, loading, error, refetch };
}
