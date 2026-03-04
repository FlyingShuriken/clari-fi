import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function LedgerScreen() {
  const controller = useClariFiController();

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Expense Ledger" subtitle="Recent confirmed expenses" />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.loadLedger}
              loading={controller.loading}
              disabled={controller.loading}
              icon="refresh"
              testID={TEST_IDS.ledger.refreshButton}
            >
              Refresh
            </Button>
            <Text variant="bodyMedium" style={styles.totalText}>
              Total: {controller.formatCurrency(controller.ledgerTotal)}
            </Text>
          </View>

          {controller.ledgerItems.length === 0 ? (
            <Text variant="bodySmall" style={styles.emptyText}>
              No ledger rows yet. Capture or confirm an expense first.
            </Text>
          ) : (
            controller.ledgerItems.map((item) => (
              <Card key={item.id} mode="outlined" style={styles.itemCard}>
                <Card.Content style={styles.itemContent}>
                  <View style={styles.rowSpace}>
                    <Text variant="titleSmall" style={styles.itemTitle}>
                      {item.merchant}
                    </Text>
                    <Text variant="titleSmall">{controller.formatCurrency(item.totalAmount, item.currency)}</Text>
                  </View>

                  <Text variant="bodySmall" style={styles.meta}>
                    {new Date(item.transactionAt).toLocaleString()} · {item.paymentMethod}
                    {item.areaText ? ` · ${item.areaText}` : ''}
                  </Text>

                  {item.note ? (
                    <Text variant="bodySmall" style={styles.note}>
                      {item.note}
                    </Text>
                  ) : null}

                  {item.lineItems.map((line, index) => (
                    <Text key={`${line.description}-${index}`} variant="bodySmall" style={styles.lineItem}>
                      {line.description} · qty {line.quantity ?? 1} {line.unit ?? ''} ·{' '}
                      {controller.formatCurrency(line.totalPrice, item.currency)}
                    </Text>
                  ))}
                </Card.Content>
              </Card>
            ))
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  totalText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
  },
  itemCard: {
    borderRadius: 12,
  },
  itemContent: {
    gap: 6,
  },
  rowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemTitle: {
    color: '#0f172a',
    flexShrink: 1,
  },
  meta: {
    color: '#475569',
  },
  note: {
    color: '#334155',
  },
  lineItem: {
    color: '#0f172a',
  },
});
