import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { CategoryProgress } from '../../../components/ui/category-progress';
import { EmptyState } from '../../../components/ui/empty-state';
import { Colors } from '../../../theme';
import { WeeklyStoryModal } from './WeeklyStoryModal';

const CATEGORY_COLORS: Record<string, string> = {
  groceries: Colors.catFood,
  food: Colors.catFood,
  transport: Colors.catTransport,
  dining: Colors.catDining,
  shopping: Colors.catShopping,
  utilities: Colors.catUtilities,
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? Colors.catOther;
}

const RANK_COLORS = [Colors.green, Colors.indigo, Colors.coral];

export function LedgerOverviewPanel() {
  const controller = useClariFiController();
  const summary = controller.reportSummary;
  const [storyVisible, setStoryVisible] = useState(false);

  const handleOpenWeeklyReport = async () => {
    if (controller.weeklySlides.length === 0) {
      await controller.loadWeeklyReport();
    }
    setStoryVisible(true);
  };

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
    ? Math.max(...summary.categoryBreakdown.map((item) => item.amount), 1)
    : 1;

  if (!summary) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState icon="chart-line" message="Overview will appear after your monthly summary loads." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.weeklyCard} onPress={() => { void handleOpenWeeklyReport(); }}>
        <MaterialCommunityIcons name="creation" size={20} color={Colors.green} />
        <View style={styles.weeklyCardText}>
          <Text style={styles.weeklyTitle}>Your Week in Review</Text>
          <Text style={styles.weeklySub}>AI-powered insights · Story mode</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      <WeeklyStoryModal
        visible={storyVisible}
        slides={controller.weeklySlides}
        loading={controller.weeklyReportLoading}
        onClose={() => setStoryVisible(false)}
      />

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroLabel}>Overview</Text>
            <Text style={styles.heroSub}>A monthly snapshot, not a full financial report.</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={controller.loadReport} disabled={controller.loading}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroAmount}>{controller.formatCurrency(summary.cashOut)}</Text>
        <View style={[styles.trendBadge, { backgroundColor: trendBg }]}>
          <MaterialCommunityIcons name={trendIcon as never} size={12} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>{trendLabel}</Text>
        </View>
      </View>

      {summary.categoryBreakdown.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top categories</Text>
          <View style={styles.categoryList}>
            {summary.categoryBreakdown.map((item) => {
              const pct = Math.round((item.amount / Math.max(summary.cashOut, 1)) * 100);
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

      {summary.topMerchants.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top merchants</Text>
          <View style={styles.list}>
            {summary.topMerchants.slice(0, 3).map((merchant, index) => (
              <View key={merchant.merchant} style={styles.row}>
                <View style={styles.left}>
                  <Text style={[styles.rank, { color: RANK_COLORS[index] ?? Colors.textSecondary }]}>
                    {index + 1}
                  </Text>
                  <Text style={styles.name}>{merchant.merchant}</Text>
                </View>
                <Text style={styles.amount}>{controller.formatCurrency(merchant.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {summary.insights.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Insights</Text>
          <View style={styles.list}>
            {summary.insights.map((insight, index) => (
              <View key={`insight-${index}`} style={styles.insightRow}>
                <MaterialCommunityIcons name="lightbulb-outline" size={14} color={Colors.amber} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  weeklyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.green + '40',
  },
  weeklyCardText: {
    flex: 1,
    gap: 2,
  },
  weeklyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  weeklySub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  emptyWrap: {
    paddingTop: 20,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  heroSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmount: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryList: {
    gap: 12,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rank: {
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  amount: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
