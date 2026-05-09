import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import type { StoreAggregate } from '../types/store-aggregate';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.62;

function pctChange(latest: number, avg: number): number {
  if (avg === 0) return 0;
  return ((latest - avg) / avg) * 100;
}

interface StoreBottomSheetProps {
  store: StoreAggregate | null;
  visible: boolean;
  onDismiss: () => void;
  formatCurrency: (n: number) => string;
}

export function StoreBottomSheet({ store, visible, onDismiss, formatCurrency }: StoreBottomSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  if (!store) return null;

  const totalAvg = store.items.reduce((s, i) => s + i.averageUnitPrice, 0);
  const save = totalAvg - store.totalLatestPrice;
  const totalPct = pctChange(store.totalLatestPrice, totalAvg);

  const handleDirections = () => {
    const q = encodeURIComponent(`${store.storeName} ${store.areaText ?? ''}`.trim());
    void Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss store details"
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        accessibilityViewIsModal
        accessibilityLabel={`Store details for ${store.storeName}`}
      >
        <View style={styles.handle} />

        {/* Store header */}
        <View style={styles.storeHeader}>
          <View style={styles.storeIconWrap}>
            <MaterialCommunityIcons name="cart-outline" size={22} color={Colors.bg} />
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{store.storeName}</Text>
            <Text style={styles.storeMeta}>
              {store.distanceKm < 1
                ? `${(store.distanceKm * 1000).toFixed(0)}m`
                : `${store.distanceKm.toFixed(1)} km`}
              {store.areaText ? ` · ${store.areaText}` : ''}
            </Text>
          </View>
          {totalPct !== 0 && (
            <View style={[styles.vsAvgBadge, save >= 0 ? styles.vsAvgGood : styles.vsAvgBad]}>
              <Text style={[styles.vsAvgBadgeText, save >= 0 ? styles.vsAvgGoodText : styles.vsAvgBadText]}>
                {save >= 0 ? '↓' : '↑'}{Math.abs(totalPct).toFixed(0)}% vs avg
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Items label row */}
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionLabel}>ITEM / PRICES AVG</Text>
        </View>

        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          {store.items.map((item) => {
            const pct = pctChange(item.latestUnitPrice, item.averageUnitPrice);
            const isAbove = pct > 1;
            const isBelow = pct < -1;
            return (
              <View key={item.itemName} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.latestUnitPrice)}</Text>
                <View style={[
                  styles.pctBadge,
                  isBelow ? styles.pctGood : isAbove ? styles.pctBad : styles.pctNeutral,
                ]}>
                  <Text style={[
                    styles.pctText,
                    isBelow ? styles.pctGoodText : isAbove ? styles.pctBadText : styles.pctNeutralText,
                  ]}>
                    {isBelow
                      ? `↓${Math.abs(pct).toFixed(0)}%`
                      : isAbove
                      ? `↑${pct.toFixed(0)}%`
                      : 'avg'}
                  </Text>
                </View>
              </View>
            );
          })}

          <View style={styles.divider} />

          {/* Total section */}
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Total at this store</Text>
            <Text style={styles.totalValue}>{formatCurrency(store.totalLatestPrice)}</Text>
            {totalAvg > 0 && (
              <Text style={[styles.totalVsAvg, save >= 0 ? styles.totalSaveGood : styles.totalSaveBad]}>
                {'vs market avg '}
                {formatCurrency(totalAvg)}
                {save > 0
                  ? ` · Save ${formatCurrency(save)} · ↓${Math.abs(totalPct).toFixed(0)}%`
                  : save < 0
                  ? ` · +${formatCurrency(Math.abs(save))} · ↑${Math.abs(totalPct).toFixed(0)}%`
                  : ''}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={handleDirections}
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${store.storeName}`}
          >
            <MaterialCommunityIcons name="directions" size={18} color={Colors.bg} />
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close store details"
          >
            <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Store header
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: {
    flex: 1,
    gap: 3,
  },
  storeName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  storeMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  vsAvgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  vsAvgGood: {
    backgroundColor: Colors.greenDim,
    borderWidth: 1,
    borderColor: `${Colors.green}50`,
  },
  vsAvgBad: {
    backgroundColor: 'rgba(232,90,79,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,90,79,0.3)',
  },
  vsAvgBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  vsAvgGoodText: {
    color: Colors.green,
  },
  vsAvgBadText: {
    color: Colors.coral,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },

  // Items section
  itemsHeader: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  itemsList: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pctBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  pctGood: {
    backgroundColor: Colors.greenDim,
  },
  pctBad: {
    backgroundColor: 'rgba(232,90,79,0.12)',
  },
  pctNeutral: {
    backgroundColor: Colors.surfaceHigh,
  },
  pctText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pctGoodText: {
    color: Colors.green,
  },
  pctBadText: {
    color: Colors.coral,
  },
  pctNeutralText: {
    color: Colors.textMuted,
  },

  // Total section
  totalSection: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  totalVsAvg: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  totalSaveGood: {
    color: Colors.green,
  },
  totalSaveBad: {
    color: Colors.coral,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: Colors.green,
    borderRadius: 14,
  },
  directionsBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bg,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
