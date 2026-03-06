import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import type { StoreAggregate } from '../types/store-aggregate';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;

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
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  if (!store) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.storeName}>{store.storeName}</Text>
            {store.areaText ? <Text style={styles.areaText}>{store.areaText}</Text> : null}
            <Text style={styles.distance}>
              {store.distanceKm < 1
                ? `${(store.distanceKm * 1000).toFixed(0)}m away`
                : `${store.distanceKm.toFixed(1)}km away`}
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.body}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colLabel, styles.colItem]}>Item</Text>
            <Text style={[styles.colLabel, styles.colPrice]}>Latest</Text>
            <Text style={[styles.colLabel, styles.colPrice]}>Avg</Text>
          </View>
          {store.items.map((item) => (
            <View key={item.itemName} style={styles.tableRow}>
              <Text style={[styles.cellItem, styles.colItem]} numberOfLines={1}>
                {item.itemName}
              </Text>
              <Text style={[styles.cellPrice, styles.colPrice]}>
                {formatCurrency(item.latestUnitPrice)}
              </Text>
              <Text style={[styles.cellAvg, styles.colPrice]}>
                {formatCurrency(item.averageUnitPrice)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.colItem]}>Total</Text>
            <Text style={[styles.totalValue, styles.colPrice]}>
              {formatCurrency(store.totalLatestPrice)}
            </Text>
            <Text style={[styles.totalAvg, styles.colPrice]}>
              {formatCurrency(store.items.reduce((s, i) => s + i.averageUnitPrice, 0))}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  areaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  distance: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  body: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  colItem: {
    flex: 1,
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cellItem: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  cellPrice: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cellAvg: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    marginTop: 4,
  },
  totalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.green,
  },
  totalAvg: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
