import { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../../../components/ui/empty-state';
import { MetaRow } from '../../../components/ui/meta-row';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';
import { Colors } from '../../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('default', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQuantity(quantity?: number, unit?: string): string | null {
  if (quantity === undefined && !unit) {
    return null;
  }

  return [quantity === undefined ? null : String(quantity), unit].filter(Boolean).join(' ');
}

function normalizeItemLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const controller = useClariFiController();
  const expense = controller.ledgerItems.find((item) => item.id === route.params.expenseId);

  useEffect(() => {
    if (!expense && controller.ledgerItems.length === 0) {
      void controller.loadLedger();
    }
  }, [controller.ledgerItems.length, controller.loadLedger, expense]);

  if (!expense) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="receipt-text-outline" message="Expense details are not available yet." />
      </View>
    );
  }

  const cheaperOption = expense.cheaperOption;
  const openStoreMap = cheaperOption?.hasAlternative
    ? () => {
        const first = cheaperOption.items[0];
        navigation.navigate('StoreMap', {
          items: cheaperOption.items.map((item) => item.description),
          lat: first?.lat ?? expense.locationLat ?? 0,
          lng: first?.lng ?? expense.locationLng ?? 0,
          radiusKm: 5,
          areaText: expense.areaText,
        });
      }
    : undefined;

  const handleDeleteExpense = () => {
    Alert.alert(
      'Delete expense?',
      'This removes the expense from your ledger.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const deleted = await controller.deleteExpenseById(expense.id);
              if (deleted) {
                navigation.goBack();
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="receipt-text-outline" size={24} color={Colors.green} />
        </View>
        <Text style={styles.merchant}>{expense.merchant}</Text>
        <Text style={styles.amount}>{controller.formatCurrency(expense.totalAmount, expense.currency)}</Text>
        <Text style={styles.timestamp}>{formatDateTime(expense.transactionAt)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Transaction</Text>
        <View style={styles.metaStack}>
          <MetaRow label="Payment" value={expense.paymentMethod} />
          <MetaRow label="Currency" value={expense.currency} />
          {expense.areaText && <MetaRow label="Area" value={expense.areaText} />}
          {expense.note && <MetaRow label="Note" value={expense.note} />}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemStack}>
          {expense.lineItems.map((lineItem, index) => {
            const quantityText = formatQuantity(lineItem.quantity, lineItem.unit);
            const cheaperItem = cheaperOption?.items.find((item) => {
              const optionLabel = normalizeItemLabel(item.description);
              const lineLabel = normalizeItemLabel(lineItem.description);
              return optionLabel === lineLabel || optionLabel.includes(lineLabel) || lineLabel.includes(optionLabel);
            });
            return (
              <View
                key={`${lineItem.description}-${index}`}
                style={[styles.lineItem, cheaperItem && styles.lineItemWithSavings]}
              >
                <View style={styles.lineItemText}>
                  <View style={styles.lineItemTitleRow}>
                    <Text style={styles.lineItemTitle}>{lineItem.description}</Text>
                    {cheaperItem && (
                      <View style={styles.itemSavingsBadge}>
                        <MaterialCommunityIcons name="tag-arrow-down-outline" size={11} color={Colors.green} />
                        <Text style={styles.itemSavingsBadgeText}>Cheaper</Text>
                      </View>
                    )}
                  </View>
                  {quantityText && <Text style={styles.lineItemMeta}>{quantityText}</Text>}
                  {cheaperItem && (
                    <Text style={styles.cheaperItemMeta}>
                      Save {controller.formatCurrency(cheaperItem.savingsPerUnit, expense.currency)} each at{' '}
                      {cheaperItem.cheapestStore}
                    </Text>
                  )}
                </View>
                <View style={styles.lineItemAmountBlock}>
                  <Text style={styles.lineItemAmount}>
                    {controller.formatCurrency(lineItem.totalPrice, expense.currency)}
                  </Text>
                  {lineItem.unitPrice !== undefined && (
                    <Text style={styles.lineItemMeta}>
                      {controller.formatCurrency(lineItem.unitPrice, expense.currency)} each
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {cheaperOption?.hasAlternative && openStoreMap && (
        <TouchableOpacity style={styles.savingsCard} onPress={openStoreMap} activeOpacity={0.75}>
          <View style={styles.savingsIcon}>
            <MaterialCommunityIcons name="tag-arrow-down-outline" size={18} color={Colors.green} />
          </View>
          <View style={styles.savingsTextBlock}>
            <Text style={styles.savingsTitle}>Cheaper nearby options found</Text>
            <Text style={styles.savingsBody}>
              Estimated savings {controller.formatCurrency(cheaperOption.totalSavingsEstimate, expense.currency)}.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.deleteButton, controller.loading && styles.deleteButtonDisabled]}
        onPress={handleDeleteExpense}
        disabled={controller.loading}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Delete expense"
        accessibilityState={{ disabled: controller.loading, busy: controller.loading }}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.coral} />
        <Text style={styles.deleteButtonText}>
          {controller.loading ? 'Deleting...' : 'Delete expense'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  heroCard: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: 24,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenDim,
  },
  merchant: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  amount: {
    color: Colors.green,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  timestamp: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  metaStack: {
    gap: 10,
  },
  itemStack: {
    gap: 10,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lineItemWithSavings: {
    backgroundColor: Colors.greenDim,
    borderBottomColor: Colors.green + '45',
  },
  lineItemText: {
    flex: 1,
    gap: 3,
  },
  lineItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  lineItemTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  lineItemMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  cheaperItemMeta: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '600',
  },
  itemSavingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.green + '45',
  },
  itemSavingsBadgeText: {
    color: Colors.green,
    fontSize: 10,
    fontWeight: '800',
  },
  lineItemAmountBlock: {
    alignItems: 'flex-end',
    gap: 3,
  },
  lineItemAmount: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.greenDim,
    borderWidth: 1,
    borderColor: Colors.green + '45',
  },
  savingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  savingsTextBlock: {
    flex: 1,
    gap: 3,
  },
  savingsTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  savingsBody: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  deleteButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.coralDim,
    borderWidth: 1,
    borderColor: Colors.coral + '55',
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: {
    color: Colors.coral,
    fontSize: 14,
    fontWeight: '800',
  },
});
