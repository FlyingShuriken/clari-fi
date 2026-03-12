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

export function StoreListItem({ store, isCheapest, onPress, formatCurrency }: StoreListItemProps) {
  const distanceShort =
    store.distanceKm < 1
      ? `${(store.distanceKm * 1000).toFixed(0)}m`
      : `${store.distanceKm.toFixed(1)}km`;

  return (
    <TouchableOpacity
      style={[styles.card, isCheapest && styles.cardCheapest]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={styles.storeIcon}>
          <MaterialCommunityIcons name="cart-outline" size={20} color={Colors.bg} />
        </View>
        {isCheapest ? (
          <View style={styles.bestBadge}>
            <Text style={styles.bestText}>BEST</Text>
          </View>
        ) : (
          <View style={styles.distBadge}>
            <MaterialCommunityIcons name="map-marker-outline" size={10} color={Colors.textSecondary} />
            <Text style={styles.distBadgeText}>{distanceShort}</Text>
          </View>
        )}
      </View>

      <Text style={styles.storeName} numberOfLines={2}>{store.storeName}</Text>
      <Text style={styles.distanceAway}>{distanceShort} away</Text>
      <Text style={[styles.totalPrice, isCheapest && styles.totalPriceCheapest]}>
        {formatCurrency(store.totalLatestPrice)} total
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
  },
  cardCheapest: {
    borderColor: Colors.green,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestBadge: {
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.green}60`,
  },
  bestText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.green,
    letterSpacing: 0.5,
  },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distBadgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  distanceAway: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  totalPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  totalPriceCheapest: {
    color: Colors.green,
  },
});
