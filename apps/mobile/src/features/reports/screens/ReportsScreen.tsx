import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { CategoryProgress } from '../../../components/ui/category-progress';
import { EmptyState } from '../../../components/ui/empty-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';

const CATEGORY_COLORS: Record<string, string> = {
  groceries:  Colors.catFood,
  food:       Colors.catFood,
  transport:  Colors.catTransport,
  dining:     Colors.catDining,
  shopping:   Colors.catShopping,
  utilities:  Colors.catUtilities,
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? Colors.catOther;
}

const RANK_COLORS = [Colors.green, Colors.indigo, Colors.coral];

export function ReportsScreen() {
  const controller = useClariFiController();
  const insets = useSafeAreaInsets();
  const summary = controller.reportSummary;

  const now = new Date();
  const monthLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const trendColor =
    summary?.spendDelta.direction === 'DOWN' ? Colors.green
    : summary?.spendDelta.direction === 'UP' ? Colors.coral
    : Colors.amber;

  const trendBg =
    summary?.spendDelta.direction === 'DOWN' ? Colors.greenDim
    : summary?.spendDelta.direction === 'UP' ? Colors.coralDim
    : '#FFB54720';

  const trendLabel =
    summary?.spendDelta.direction === 'UP'
      ? `+${summary.spendDelta.percentage?.toFixed(0) ?? '0'}% vs prev`
      : summary?.spendDelta.direction === 'DOWN'
      ? `-${Math.abs(summary.spendDelta.percentage ?? 0).toFixed(0)}% vs prev`
      : summary?.spendDelta.direction === 'FLAT'
      ? '~0% vs prev'
      : 'First month';

  const trendIcon =
    summary?.spendDelta.direction === 'DOWN' ? 'trending-down'
    : summary?.spendDelta.direction === 'UP' ? 'trending-up'
    : 'minus';

  const maxCategoryAmount = summary
    ? Math.max(...summary.categoryBreakdown.map((c) => c.amount), 1)
    : 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>{monthLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.calBtn}
          onPress={controller.loadReport}
          disabled={controller.loading}
          testID={TEST_IDS.reports.loadButton}
        >
          <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!summary ? (
          <EmptyState
            icon="chart-line"
            message="Tap the calendar icon to load your monthly report."
          />
        ) : (
          <>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Text style={styles.heroLabel}>Total Spent</Text>
                <View style={[styles.trendBadge, { backgroundColor: trendBg }]}>
                  <MaterialCommunityIcons name={trendIcon as any} size={12} color={trendColor} />
                  <Text style={[styles.trendText, { color: trendColor }]}>{trendLabel}</Text>
                </View>
              </View>

              <Text style={styles.heroAmount}>
                {controller.formatCurrency(summary.cashOut)}
              </Text>

              <View style={styles.cashRow}>
                <View style={styles.cashBlock}>
                  <Text style={styles.cashLabel}>Cash In</Text>
                  <Text style={[styles.cashValue, { color: Colors.green }]}>
                    {controller.formatCurrency(summary.cashIn)}
                  </Text>
                </View>
                <View style={styles.cashBlock}>
                  <Text style={styles.cashLabel}>Cash Out</Text>
                  <Text style={[styles.cashValue, { color: Colors.coral }]}>
                    {controller.formatCurrency(summary.cashOut)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Categories card */}
            {summary.categoryBreakdown.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Categories</Text>
                <View style={styles.categoryList}>
                  {summary.categoryBreakdown.map((item) => {
                    const pct = Math.round((item.amount / summary.cashOut) * 100);
                    return (
                      <CategoryProgress
                        key={item.category}
                        category={item.category}
                        amount={`${controller.formatCurrency(item.amount)} · ${pct}%`}
                        percentage={(item.amount / maxCategoryAmount) * 100}
                        color={getCategoryColor(item.category)}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Top Merchants card */}
            {summary.topMerchants.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Merchants</Text>
                <View style={styles.merchantList}>
                  {summary.topMerchants.slice(0, 3).map((merchant, i) => (
                    <View key={merchant.merchant} style={styles.merchantRow}>
                      <View style={styles.merchantLeft}>
                        <Text style={[styles.rank, { color: RANK_COLORS[i] ?? Colors.textSecondary }]}>
                          {i + 1}
                        </Text>
                        <Text style={styles.merchantName}>{merchant.merchant}</Text>
                      </View>
                      <Text style={styles.merchantAmount}>
                        {controller.formatCurrency(merchant.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Insights */}
            {summary.insights.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Insights</Text>
                <View style={styles.insightList}>
                  {summary.insights.map((insight, i) => (
                    <View key={`insight-${i}`} style={styles.insightRow}>
                      <MaterialCommunityIcons name="lightbulb-outline" size={14} color={Colors.amber} />
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerLeft: {
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
  calBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: Colors.textPrimary,
  },
  cashRow: {
    flexDirection: 'row',
    gap: 20,
  },
  cashBlock: {
    gap: 2,
  },
  cashLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cashValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  categoryList: {
    gap: 12,
  },
  merchantList: {
    gap: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rank: {
    fontSize: 13,
    fontWeight: '700',
    width: 16,
  },
  merchantName: {
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
  },
  merchantAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  insightList: {
    gap: 10,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
