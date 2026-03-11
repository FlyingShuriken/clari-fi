import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { loadMultiPriceCompare } from '../../../shared/api';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import type { StoreAggregate, StoreItemPrice } from '../types/store-aggregate';

interface UseMultiItemCompareResult {
  stores: StoreAggregate[];
  loading: boolean;
  error: string | null;
  refetch: (items: string[], lat: number, lng: number, radiusKm: number, areaText?: string) => Promise<void>;
}

export function useMultiItemCompare(): UseMultiItemCompareResult {
  const { getToken } = useAuth();
  const controller = useClariFiController();
  const [stores, setStores] = useState<StoreAggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(
    async (items: string[], lat: number, lng: number, radiusKm: number, areaText?: string) => {
      if (items.length === 0) return;
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError('Not authenticated');
          return;
        }

        const result = await loadMultiPriceCompare(controller.apiBaseUrl, token, {
          items,
          area: areaText,
          lat,
          lng,
          radiusKm,
          includePromo: true,
        });

        const aggregated: StoreAggregate[] = result.stores.map((store) => ({
          storeId: store.storeId ?? `${store.storeName ?? 'unknown'}::${store.areaText ?? ''}`,
          storeName: store.storeName ?? 'Unknown store',
          areaText: store.areaText ?? '',
          distanceKm: store.distanceKm ?? 999,
          totalLatestPrice: store.totalLatestPrice,
          itemCoverage: store.itemCoverage,
          items: store.items.map(
            (item): StoreItemPrice => ({
              itemName: item.item,
              latestUnitPrice: item.latestUnitPrice,
              averageUnitPrice: item.averageUnitPrice,
              averageTrustScore: item.averageTrustScore,
              sampleSize: item.sampleSize,
            }),
          ),
        }));

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
