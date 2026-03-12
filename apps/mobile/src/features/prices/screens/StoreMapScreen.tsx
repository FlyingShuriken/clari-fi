import { useEffect, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';
import { LeafletMap } from '../components/leaflet-map';
import { StoreListItem } from '../components/store-list-item';
import { StoreBottomSheet } from '../components/store-bottom-sheet';
import { useMultiItemCompare } from '../hooks/use-multi-item-compare';
import type { StoreAggregate } from '../types/store-aggregate';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreMap'>;
type SortMode = 'cheapest' | 'closest' | 'best';

const RADIUS_OPTIONS = [1, 2, 5, 10];
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'closest', label: 'Closest' },
  { key: 'best', label: 'Best match' },
];

const MAP_HEIGHT = Dimensions.get('window').height * 0.52;

export function StoreMapScreen({ route, navigation }: Props) {
  const { items, lat, lng, radiusKm: initialRadius, areaText } = route.params;
  const controller = useClariFiController();
  const insets = useSafeAreaInsets();
  const { stores, loading, error, refetch } = useMultiItemCompare();
  const [radiusKm, setRadiusKm] = useState(initialRadius);
  const [sort, setSort] = useState<SortMode>('cheapest');
  const [selectedStore, setSelectedStore] = useState<StoreAggregate | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    refetch(items, lat, lng, radiusKm, areaText);
  }, [radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  const cheapestId =
    stores.length > 0
      ? stores.reduce((best, s) => (s.totalLatestPrice < best.totalLatestPrice ? s : best), stores[0]).storeId
      : null;

  const sortedStores = [...stores].sort((a, b) => {
    if (sort === 'cheapest') return a.totalLatestPrice - b.totalLatestPrice;
    if (sort === 'closest') return a.distanceKm - b.distanceKm;
    if (b.itemCoverage !== a.itemCoverage) return b.itemCoverage - a.itemCoverage;
    return a.totalLatestPrice - b.totalLatestPrice;
  });

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <LeafletMap lat={lat} lng={lng} radiusKm={radiusKm} />

        {/* Overlay header */}
        <View style={[styles.mapHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.mapHeaderBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.mapHeaderTitle}>
            {loading ? 'Searching…' : `${stores.length} stores found`}
          </Text>
          <View style={styles.mapHeaderBtn}>
            <MaterialCommunityIcons name="view-grid-outline" size={20} color={Colors.textPrimary} />
          </View>
        </View>

        {/* Radius pills overlay */}
        <View style={styles.radiusOverlay}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusPill, r === radiusKm && styles.radiusPillActive]}
              onPress={() => setRadiusKm(r)}
            >
              <Text style={[styles.radiusPillText, r === radiusKm && styles.radiusPillTextActive]}>
                {r}km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <View style={styles.panelHandle} />

        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Nearby Stores</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{stores.length} found</Text>
          </View>
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORT_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.sortChip, sort === key && styles.sortChipActive]}
              onPress={() => setSort(key)}
            >
              <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.green} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : sortedStores.length === 0 ? (
          <Text style={styles.emptyText}>No stores found in this radius.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
          >
            {sortedStores.map((store) => (
              <StoreListItem
                key={store.storeId}
                store={store}
                totalItemsQueried={items.length}
                isCheapest={store.storeId === cheapestId}
                onPress={() => setSelectedStore(store)}
                formatCurrency={controller.formatCurrency}
              />
            ))}
          </ScrollView>
        )}
      </View>

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
  mapContainer: {
    height: MAP_HEIGHT,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  mapHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(11,11,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  radiusOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(22,22,26,0.88)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusPillActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  radiusPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  radiusPillTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },

  // Bottom panel
  panel: {
    flex: 1,
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.green}50`,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.green,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  sortChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    fontSize: 13,
    color: Colors.coral,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});
