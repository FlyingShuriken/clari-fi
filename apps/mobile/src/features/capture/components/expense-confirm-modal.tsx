import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ExpenseConfirmEditor, type ExpenseConfirmLocation } from './expense-confirm-editor';
import { Colors } from '../../../theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;

export type ConfirmKind = 'voice' | 'receipt' | 'flyer';

const KIND_META: Record<ConfirmKind, { label: string; icon: string; color: string }> = {
  voice: { label: 'Voice Expense', icon: 'microphone', color: Colors.green },
  receipt: { label: 'Receipt', icon: 'receipt', color: Colors.indigo },
  flyer: { label: 'Flyer Promo', icon: 'tag-multiple-outline', color: Colors.amber },
};

interface LineItem {
  descriptionRaw: string;
  totalPrice: number;
  currency: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  kind: ConfirmKind;
  merchantText: string;
  amount: number;
  currency: string;
  lineItems: LineItem[];
  validFrom?: string | null;
  validTo?: string | null;
  merchantValue: string;
  onMerchantChange: (v: string) => void;
  locationValue: ExpenseConfirmLocation;
  onLocationChange: (v: ExpenseConfirmLocation) => void;
  onConfirm: () => void;
  loading: boolean;
  confirmLabel: string;
  apiBaseUrl: string;
  formatCurrency: (n: number, currency?: string) => string;
}

export function ExpenseConfirmModal({
  visible, onDismiss, kind,
  merchantText, amount, currency, lineItems, validFrom, validTo,
  merchantValue, onMerchantChange, locationValue, onLocationChange,
  onConfirm, loading, confirmLabel, apiBaseUrl, formatCurrency,
}: Props) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const meta = KIND_META[kind];
  const displayMerchant = (kind !== 'flyer' ? merchantValue.trim() : '') || merchantText || 'Unknown merchant';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss confirmation sheet"
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        accessibilityViewIsModal
        accessibilityLabel={`${meta.label} confirmation`}
      >
        <View style={styles.handle} />

        {/* Sheet header row */}
        <View style={styles.sheetTop}>
          <View style={[styles.kindBadge, { backgroundColor: `${meta.color}20`, borderColor: `${meta.color}40` }]}>
            <MaterialCommunityIcons name={meta.icon as never} size={12} color={meta.color} />
            <Text style={[styles.kindLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close confirmation sheet"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <MaterialCommunityIcons name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Merchant + amount hero */}
        <View style={styles.heroBlock}>
          <Text style={styles.merchantName} numberOfLines={2}>{displayMerchant}</Text>
          <Text style={[styles.amountText, { color: meta.color }]}>
            {formatCurrency(amount, currency)}
          </Text>
          {(validFrom ?? validTo) ? (
            <View style={styles.validityRow}>
              <MaterialCommunityIcons name="calendar-range" size={13} color={Colors.textSecondary} />
              <Text style={styles.validityText}>
                Valid {validFrom ?? '?'} → {validTo ?? '?'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Line items */}
          {lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ITEMS</Text>
              <View style={styles.itemsCard}>
                {lineItems.map((item, i) => (
                  <View
                    key={`${item.descriptionRaw}-${i}`}
                    style={[styles.itemRow, i === lineItems.length - 1 && styles.itemRowLast]}
                  >
                    <Text style={styles.itemDesc} numberOfLines={1}>{item.descriptionRaw}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.totalPrice, item.currency)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Merchant + location editor (voice and receipt) */}
          {kind !== 'flyer' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EDIT DETAILS</Text>
              <ExpenseConfirmEditor
                apiBaseUrl={apiBaseUrl}
                merchantValue={merchantValue}
                onMerchantChange={onMerchantChange}
                locationValue={locationValue}
                onLocationChange={onLocationChange}
              />
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: meta.color }, loading && styles.confirmBtnDisabled]}
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator size={18} color={Colors.bg} />
            ) : (
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={Colors.bg} />
            )}
            <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  kindLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBlock: {
    gap: 4,
    marginBottom: 16,
  },
  merchantName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  validityText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  itemsCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemDesc: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 16,
    marginTop: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.bg,
  },
});
