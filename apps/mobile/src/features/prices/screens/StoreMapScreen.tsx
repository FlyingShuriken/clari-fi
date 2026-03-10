import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';
import { LeafletMap } from '../components/leaflet-map';
import { StoreListItem } from '../components/store-list-item';
import { StoreBottomSheet } from '../components/store-bottom-sheet';
import { useMultiItemCompare } from '../hooks/use-multi-item-compare';
import type { StoreAggregate } from '../types/store-aggregate';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreMap'>;

const RADIUS_OPTIONS = [5, 10, 15, 25];

export function StoreMapScreen({ route }: Props) {
  const { items, lat, lng, radiusKm: initialRadius, areaText } = route.params;
  const controller = useClariFiController();
  const { stores, loading, error, refetch } = useMultiItemCompare();
  const [radiusKm, setRadiusKm] = useState(initialRadius);
  const [selectedStore, setSelectedStore] = useState<StoreAggregate | null>(null);

  useEffect(() => {
    refetch(items, lat, lng, radiusKm, areaText);
  }, [radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  const cheapestId = stores.length > 0
    ? stores.reduce((best, s) => (s.totalLatestPrice < best.totalLatestPrice ? s : best), stores[0]).storeId
    : null;

  const handleRadiusChange = useCallback((r: number) => {
    setRadiusKm(r);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: StoreAggregate }) => (
      <StoreListItem
        store={item}
        totalItemsQueried={items.length}
        isCheapest={item.storeId === cheapestId}
        onPress={() => setSelectedStore(item)}
        formatCurrency={controller.formatCurrency}
      />
    ),
    [items.length, cheapestId, controller.formatCurrency],
  );

  return (
    <View style={styles.container}>
      <LeafletMap lat={lat} lng={lng} radiusKm={radiusKm} />

      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.radiusChip, r === radiusKm && styles.radiusChipActive]}
            onPress={() => handleRadiusChange(r)}
          >
            <Text style={[styles.radiusText, r === radiusKm && styles.radiusTextActive]}>
              {r}km
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {stores.length} store{stores.length !== 1 ? 's' : ''} found
        </Text>
        <Text style={styles.summaryDot}> · </Text>
        <Text style={styles.summaryText}>{items.length} items</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.green} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.storeId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No stores found in this radius.</Text>}
        />
      )}

      <StoreBottomSheet
        store={selectedStore}
        visible={selectedStore !== null}
        onDismiss={() => setSelectedStore(null)}
        formatCurrency={controller.formatCurrency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusChipActive: {
    backgroundColor: Colors.greenDim,
    borderColor: Colors.green,
  },
  radiusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  radiusTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  loader: {
    marginTop: 40,
  },
  errorText: {
    fontSize: 13,
    color: Colors.coral,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
