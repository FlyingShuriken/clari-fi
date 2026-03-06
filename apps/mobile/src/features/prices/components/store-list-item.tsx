import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import type { StoreAggregate } from '../types/store-aggregate';

interface StoreListItemProps {
  store: StoreAggregate;
  totalItemsQueried: number;
  isCheapest: boolean;
  onPress: () => void;
  formatCurrency: (n: number) => string;
}

export function StoreListItem({ store, totalItemsQueried, isCheapest, onPress, formatCurrency }: StoreListItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{store.storeName}</Text>
          {isCheapest && (
            <View style={styles.cheapestBadge}>
              <Text style={styles.cheapestText}>Best</Text>
            </View>
          )}
        </View>
        {store.areaText ? <Text style={styles.area} numberOfLines={1}>{store.areaText}</Text> : null}
        <Text style={styles.coverage}>
          {store.itemCoverage}/{totalItemsQueried} items
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, isCheapest && styles.priceCheapest]}>
          {formatCurrency(store.totalLatestPrice)}
        </Text>
        <View style={styles.distanceBadge}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.distanceText}>
            {store.distanceKm < 1 ? `${(store.distanceKm * 1000).toFixed(0)}m` : `${store.distanceKm.toFixed(1)}km`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  left: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  cheapestBadge: {
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cheapestText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.green,
  },
  area: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  coverage: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  priceCheapest: {
    color: Colors.green,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
