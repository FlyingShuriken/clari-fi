import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { ExpenseCard } from '../../../components/ui/expense-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { RefreshScroll } from '../../../components/ui/refresh-scroll';
import { LoadingRows } from '../../../components/ui/loading-state';
import { SectionLabel } from '../../../components/ui/section-label';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';
import { LedgerOverviewPanel } from '../components/LedgerOverviewPanel';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FilterCategory = 'All' | 'Food' | 'Transport' | 'Dining' | 'Shopping' | 'Utilities';
type LedgerSegment = 'entries' | 'reports';

const FILTERS: FilterCategory[] = ['All', 'Food', 'Transport', 'Dining', 'Shopping', 'Utilities'];

function inferCategory(lineItems: { description: string }[]): string {
  const text = lineItems.map((line) => line.description.toLowerCase()).join(' ');
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
    All: [],
    Food: ['groceries', 'food'],
    Transport: ['transport'],
    Dining: ['dining'],
    Shopping: ['shopping'],
    Utilities: ['utilities'],
  };
  return map[filter].includes(category);
}

function dateGroupKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('default', { month: 'long', day: 'numeric' });
}

export function LedgerScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All');
  const [segment, setSegment] = useState<LedgerSegment>('entries');
  const [showNudgeBanner, setShowNudgeBanner] = useState(false);
  const nudgeBannerShownRef = useRef(false);
  const nudgeOpacity = useRef(new Animated.Value(0)).current;
  const hasLoadedLedgerRef = useRef(false);
  const hasLoadedOverviewRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (
        hasLoadedLedgerRef.current ||
        controller.initialDataLoading ||
        controller.authSyncStatus !== 'ok' ||
        controller.ledgerItems.length > 0
      ) {
        return;
      }
      hasLoadedLedgerRef.current = true;
      void controller.loadLedger();
    }, [
      controller.authSyncStatus,
      controller.initialDataLoading,
      controller.ledgerItems.length,
      controller.loadLedger,
    ]),
  );

  useEffect(() => {
    if (nudgeBannerShownRef.current) {
      return;
    }
    const hasCheaper = controller.ledgerItems.some((item) => item.cheaperOption?.hasAlternative);
    if (!hasCheaper) {
      return;
    }
    nudgeBannerShownRef.current = true;
    setShowNudgeBanner(true);
    Animated.timing(nudgeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Banner stays visible until user dismisses — no auto-dismiss timer
  }, [controller.ledgerItems, nudgeOpacity]);

  const openReports = async () => {
    setSegment('reports');
    if (hasLoadedOverviewRef.current) {
      return;
    }
    hasLoadedOverviewRef.current = true;
    await controller.loadReport();
  };

  const now = new Date();
  const monthLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const filteredItems = controller.ledgerItems.filter((item) =>
    filterMatch(inferCategory(item.lineItems), selectedFilter),
  );

  const groupedItems = filteredItems.reduce<{ label: string; items: typeof filteredItems }[]>((groups, item) => {
    const key = dateGroupKey(item.transactionAt);
    const last = groups[groups.length - 1];
    if (last && last.label === key) {
      last.items.push(item);
    } else {
      groups.push({ label: key, items: [item] });
    }
    return groups;
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Ledger</Text>
          <Text style={styles.subtitle}>
            {monthLabel} · {controller.formatCurrency(controller.ledgerTotal)} tracked
          </Text>
        </View>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'entries' && styles.segmentBtnActive]}
          onPress={() => setSegment('entries')}
          accessibilityRole="button"
          accessibilityLabel="Show expenses"
          accessibilityState={{ selected: segment === 'entries' }}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={14}
            color={segment === 'entries' ? Colors.green : Colors.textSecondary}
          />
          <Text style={[styles.segmentText, segment === 'entries' && styles.segmentTextActive]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'reports' && styles.segmentBtnActive]}
          onPress={() => { void openReports(); }}
          accessibilityRole="button"
          accessibilityLabel="Show monthly reports"
          accessibilityState={{ selected: segment === 'reports' }}
        >
          <MaterialCommunityIcons
            name="trending-up"
            size={14}
            color={segment === 'reports' ? Colors.green : Colors.textSecondary}
          />
          <Text style={[styles.segmentText, segment === 'reports' && styles.segmentTextActive]}>Reports</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolsRow}>
        <TouchableOpacity
          style={styles.toolChip}
          onPress={segment === 'entries' ? controller.loadLedger : controller.loadReport}
          disabled={controller.loading || controller.initialDataLoading}
          testID={TEST_IDS.ledger.refreshButton}
          accessibilityRole="button"
          accessibilityLabel={segment === 'entries' ? 'Refresh expenses' : 'Refresh reports'}
          accessibilityState={{ disabled: controller.loading, busy: controller.loading || controller.initialDataLoading }}
        >
          {controller.loading || controller.initialDataLoading ? (
            <ActivityIndicator size="small" color={Colors.green} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={14} color={Colors.green} />
          )}
          <Text style={styles.toolChipText}>Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolChip}
          onPress={() => navigation.navigate('Families')}
          accessibilityRole="button"
          accessibilityLabel="Open family sharing"
        >
          <MaterialCommunityIcons name="account-group-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.toolChipText}>Families</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolChip}
          onPress={() => navigation.navigate('Splits')}
          accessibilityRole="button"
          accessibilityLabel="Open bill splits"
        >
          <MaterialCommunityIcons name="call-split" size={14} color={Colors.textSecondary} />
          <Text style={styles.toolChipText}>Split</Text>
        </TouchableOpacity>
      </View>

      {showNudgeBanner && (
        <Animated.View style={[styles.nudgeBanner, { opacity: nudgeOpacity }]}>
          <MaterialCommunityIcons name="tag-arrow-down-outline" size={14} color={Colors.green} />
          <Text style={styles.nudgeText}>Some transactions have cheaper nearby options. Tap to explore.</Text>
          <TouchableOpacity
            onPress={() => setShowNudgeBanner(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss cheaper options tip"
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <MaterialCommunityIcons name="close" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <RefreshScroll
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onRefreshAsync={segment === 'entries' ? controller.loadLedger : controller.loadReport}
      >
        {segment === 'reports' ? (
          <LedgerOverviewPanel />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedFilter(filter)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter expenses by ${filter}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {controller.initialDataLoading && filteredItems.length === 0 ? (
              <LoadingRows label="Syncing expenses" count={4} />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon="receipt-text-outline"
                title={selectedFilter === 'All' ? 'No expenses yet' : `No ${selectedFilter.toLowerCase()} expenses`}
                message={
                  selectedFilter === 'All'
                    ? 'Capture a voice entry, receipt, or flyer to start building your ledger.'
                    : 'Try a different filter or capture a new expense.'
                }
                actionLabel={selectedFilter === 'All' ? 'Go capture' : 'Show all'}
                onAction={selectedFilter === 'All' ? () => navigation.navigate('MainTabs', { screen: 'Home' }) : () => setSelectedFilter('All')}
              />
            ) : (
              groupedItems.map((group) => (
                <View key={group.label}>
                  <SectionLabel label={group.label.toUpperCase()} />
                  {group.items.map((item) => {
                    const category = inferCategory(item.lineItems);
                    const cheaperOption = item.cheaperOption;

                    return (
                      <ExpenseCard
                        key={item.id}
                        merchant={item.merchant}
                        meta={[category, item.paymentMethod].filter(Boolean).join(' · ')}
                        amount={controller.formatCurrency(item.totalAmount, item.currency)}
                        category={category}
                        hasCheaperOption={cheaperOption?.hasAlternative}
                        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
                      />
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}
      </RefreshScroll>
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
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
  toolChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: Colors.surface,
  },
  toolChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.green,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: Colors.green,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
    height: 44,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: Colors.surfaceHigh,
    justifyContent: 'center',
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
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.greenDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.green + '40',
  },
  nudgeText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
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
