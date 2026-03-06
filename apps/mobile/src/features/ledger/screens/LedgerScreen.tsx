import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { ExpenseCard } from '../../../components/ui/expense-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterCategory = 'All' | 'Food' | 'Transport' | 'Dining' | 'Shopping' | 'Utilities';
const FILTERS: FilterCategory[] = ['All', 'Food', 'Transport', 'Dining', 'Shopping', 'Utilities'];

function inferCategory(lineItems: { description: string }[]): string {
  const text = lineItems.map((l) => l.description.toLowerCase()).join(' ');
  if (/food|grocer|mart|market|vegeta|fruit|meat|bread|rice|nasi|makan|coffee|cafe/.test(text)) return 'groceries';
  if (/transport|grab|taxi|mrt|bus|petrol|fuel|parking|toll|tng/.test(text)) return 'transport';
  if (/dining|restaurant|mamak|hawker|meal|lunch|dinner|breakfast|kwan|madam/.test(text)) return 'dining';
  if (/shopping|clothes|fashion|apparel|mall|retail|uniqlo|zara|h&m/.test(text)) return 'shopping';
  if (/utility|electric|water|telco|internet|phone|bill|subscription|tenaga|astro/.test(text)) return 'utilities';
  return 'other';
}

function filterMatch(category: string, filter: FilterCategory): boolean {
  if (filter === 'All') return true;
  const map: Record<FilterCategory, string[]> = {
    All:       [],
    Food:      ['groceries', 'food'],
    Transport: ['transport'],
    Dining:    ['dining'],
    Shopping:  ['shopping'],
    Utilities: ['utilities'],
  };
  return map[filter].includes(category);
}

export function LedgerScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All');

  const now = new Date();
  const monthLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const filteredItems = controller.ledgerItems.filter((item) =>
    filterMatch(inferCategory(item.lineItems), selectedFilter),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header: title + subtitle + action icons */}
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>
            {monthLabel} · {controller.formatCurrency(controller.ledgerTotal)} total
          </Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={controller.loadLedger}
            disabled={controller.loading}
            testID={TEST_IDS.ledger.refreshButton}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Families')}
          >
            <MaterialCommunityIcons name="account-group-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Splits')}
          >
            <MaterialCommunityIcons name="call-split" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const active = selectedFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Expense list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            icon="receipt-text-outline"
            message={
              selectedFilter === 'All'
                ? 'No expenses yet. Capture one first.'
                : `No ${selectedFilter.toLowerCase()} expenses found.`
            }
          />
        ) : (
          filteredItems.map((item) => {
            const category = inferCategory(item.lineItems);
            const date = new Date(item.transactionAt);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            let timeStr: string;
            if (date.toDateString() === today.toDateString()) {
              timeStr = `Today ${date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}`;
            } else if (date.toDateString() === yesterday.toDateString()) {
              timeStr = `Yesterday ${date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}`;
            } else {
              timeStr = date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            }

            const meta = [category, item.paymentMethod, timeStr]
              .filter(Boolean)
              .join(' · ');

            return (
              <ExpenseCard
                key={item.id}
                merchant={item.merchant}
                meta={meta}
                amount={controller.formatCurrency(item.totalAmount, item.currency)}
                category={category}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTextBlock: {
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 4,
    paddingTop: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
    height: 44,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: Colors.surfaceHigh,
  },
  chipActive: {
    backgroundColor: Colors.green,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.bg,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
    gap: 8,
  },
});
