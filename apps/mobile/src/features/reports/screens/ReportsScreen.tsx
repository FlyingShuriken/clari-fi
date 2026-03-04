import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function ReportsScreen() {
  const controller = useClariFiController();
  const summary = controller.reportSummary;

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Monthly Report" subtitle="Cash flow and category breakdown" />
        <Card.Content style={styles.content}>
          <Button
            mode="contained"
            onPress={controller.loadReport}
            loading={controller.loading}
            disabled={controller.loading}
            icon="chart-box-outline"
            testID={TEST_IDS.reports.loadButton}
          >
            Load current month
          </Button>

          {!summary ? (
            <Text variant="bodySmall" style={styles.emptyText}>
              Load report to view monthly cash flow and spending insights.
            </Text>
          ) : (
            <>
              <View style={styles.metricRow}>
                <Card mode="outlined" style={styles.metricCard}>
                  <Card.Content>
                    <Text variant="labelSmall">Cash In</Text>
                    <Text variant="titleMedium">{controller.formatCurrency(summary.cashIn)}</Text>
                  </Card.Content>
                </Card>
                <Card mode="outlined" style={styles.metricCard}>
                  <Card.Content>
                    <Text variant="labelSmall">Cash Out</Text>
                    <Text variant="titleMedium">{controller.formatCurrency(summary.cashOut)}</Text>
                  </Card.Content>
                </Card>
              </View>

              <Card mode="outlined" style={styles.metricCard}>
                <Card.Content>
                  <Text variant="labelSmall">Net Cash Flow</Text>
                  <Text variant="titleMedium">{controller.formatCurrency(summary.netCashFlow)}</Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    {summary.year}-{String(summary.month).padStart(2, '0')}
                  </Text>
                </Card.Content>
              </Card>

              <Card mode="outlined" style={styles.metricCard}>
                <Card.Title title="Category Breakdown" />
                <Card.Content style={styles.listBlock}>
                  {summary.categoryBreakdown.length === 0 ? (
                    <Text variant="bodySmall" style={styles.meta}>
                      No category data yet.
                    </Text>
                  ) : (
                    summary.categoryBreakdown.map((item) => (
                      <View style={styles.row} key={item.category}>
                        <Text variant="bodyMedium">{item.category}</Text>
                        <Text variant="bodyMedium">{controller.formatCurrency(item.amount)}</Text>
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>

              <Card mode="outlined" style={styles.metricCard}>
                <Card.Title title="Insights" />
                <Card.Content style={styles.listBlock}>
                  {summary.insights.length === 0 ? (
                    <Text variant="bodySmall" style={styles.meta}>
                      No insights available yet.
                    </Text>
                  ) : (
                    summary.insights.map((insight, index) => (
                      <Text key={`${insight}-${index}`} variant="bodySmall" style={styles.insightText}>
                        • {insight}
                      </Text>
                    ))
                  )}
                </Card.Content>
              </Card>
            </>
          )}
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  content: {
    gap: 12,
  },
  emptyText: {
    color: '#64748b',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    borderRadius: 12,
    flex: 1,
  },
  meta: {
    color: '#64748b',
  },
  listBlock: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  insightText: {
    color: '#334155',
  },
});
