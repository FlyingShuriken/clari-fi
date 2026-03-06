import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function AlertsScreen() {
  const controller = useClariFiController();

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Price Alerts" subtitle="Create and evaluate threshold alerts" />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            <Chip
              selected={controller.alertKind === 'THRESHOLD'}
              onPress={() => controller.setAlertKind('THRESHOLD')}
              icon="bell-outline"
            >
              Threshold
            </Chip>
            <Chip
              selected={controller.alertKind === 'SIGNAL'}
              onPress={() => controller.setAlertKind('SIGNAL')}
              icon="lightning-bolt-outline"
            >
              Signal
            </Chip>
          </View>

          <TextInput
            label="Item"
            value={controller.alertItem}
            onChangeText={controller.setAlertItem}
            mode="outlined"
          />

          {controller.alertKind === 'THRESHOLD' ? (
            <TextInput
              label="Target unit price"
              value={controller.alertTargetUnitPrice}
              onChangeText={controller.setAlertTargetUnitPrice}
              keyboardType="decimal-pad"
              mode="outlined"
            />
          ) : (
            <>
              <View style={styles.row}>
                <Chip
                  selected={controller.alertSignalDecisionFilter === 'BOTH'}
                  onPress={() => controller.setAlertSignalDecisionFilter('BOTH')}
                >
                  Buy + Wait
                </Chip>
                <Chip
                  selected={controller.alertSignalDecisionFilter === 'BUY_NOW'}
                  onPress={() => controller.setAlertSignalDecisionFilter('BUY_NOW')}
                >
                  Buy only
                </Chip>
                <Chip
                  selected={controller.alertSignalDecisionFilter === 'WAIT'}
                  onPress={() => controller.setAlertSignalDecisionFilter('WAIT')}
                >
                  Wait only
                </Chip>
              </View>
              <TextInput
                label="Min confidence (0-1)"
                value={controller.alertSignalMinConfidence}
                onChangeText={controller.setAlertSignalMinConfidence}
                keyboardType="decimal-pad"
                mode="outlined"
              />
            </>
          )}

          <View style={styles.row}>
            <TextInput
              style={styles.flexInput}
              label="Radius km"
              value={controller.alertRadiusKm}
              onChangeText={controller.setAlertRadiusKm}
              keyboardType="decimal-pad"
              mode="outlined"
            />
            <TextInput
              style={styles.flexInput}
              label="Area"
              value={controller.alertAreaText}
              onChangeText={controller.setAlertAreaText}
              mode="outlined"
            />
          </View>

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.createAlert}
              disabled={controller.loading}
              icon="plus"
              testID={TEST_IDS.alerts.createButton}
            >
              Create
            </Button>
            <Button
              mode="outlined"
              onPress={controller.loadAlerts}
              disabled={controller.loading}
              icon="refresh"
              testID={TEST_IDS.alerts.loadAlertsButton}
            >
              Load alerts
            </Button>
          </View>

          <Divider />

          <View style={styles.rowBetween}>
            <Text variant="titleSmall">Alert inbox</Text>
            <Chip compact icon="bell-outline">
              Unread: {controller.alertUnreadCount}
            </Chip>
          </View>

          <View style={styles.row}>
            <Button
              mode="outlined"
              onPress={controller.loadAlertEvents}
              disabled={controller.loading}
              testID={TEST_IDS.alerts.loadEventsButton}
            >
              Load events
            </Button>
            <Button
              mode="text"
              onPress={controller.markAllEventsRead}
              disabled={controller.loading || controller.alertEvents.length === 0}
              testID={TEST_IDS.alerts.markAllReadButton}
            >
              Mark all read
            </Button>
          </View>

          {controller.alerts.length > 0 ? (
            <>
              <Text variant="titleSmall">Configured alerts</Text>
              {controller.alerts.map((alert) => (
                <Card key={alert.id} mode="outlined" style={styles.innerCard}>
                  <Card.Content style={styles.listBlock}>
                    <Text variant="bodyMedium">
                      {alert.item.canonicalName}{' '}
                      {alert.kind === 'THRESHOLD'
                        ? `≤ ${controller.formatCurrency(alert.targetUnitPrice ?? 0)}`
                        : `(${alert.signalDecisionFilter ?? 'BOTH'})`}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {alert.kind} · Radius {alert.radiusKm} km · {alert.areaText || 'No area'} ·{' '}
                      {alert.active ? 'Active' : 'Inactive'}
                    </Text>
                    {alert.kind === 'SIGNAL' ? (
                      <Text variant="bodySmall" style={styles.meta}>
                        Min confidence {(alert.signalMinConfidence ?? 0.65).toFixed(2)} · Cooldown{' '}
                        {alert.signalCooldownMinutes ?? 360} min
                      </Text>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}
            </>
          ) : null}

          {controller.alertEvents.length > 0 ? (
            <>
              <Text variant="titleSmall">Recent events</Text>
              {controller.alertEvents.map((event) => (
                <Card key={event.id} mode="outlined" style={styles.innerCard}>
                  <Card.Content style={styles.listBlock}>
                    <Text variant="bodyMedium">
                      {event.item}: {controller.formatCurrency(event.triggerUnitPrice)}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {event.eventKind === 'SIGNAL'
                        ? `${event.signal?.decision ?? 'SIGNAL'} · ${event.signal?.confidence ? `${Math.round(event.signal.confidence * 100)}%` : 'n/a'}`
                        : `Target ${controller.formatCurrency(event.targetUnitPrice ?? 0)}`}{' '}
                      · {event.areaText || 'Unknown area'}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {event.eventKind} · {new Date(event.triggeredAt).toLocaleString()} ·{' '}
                      {event.readAt ? 'Read' : 'Unread'} · {event.deliveryStatus || 'N/A'}
                    </Text>
                    {event.readAt === null ? (
                      <View style={styles.row}>
                        <Button
                          mode="text"
                          compact
                          onPress={() => controller.markEventRead(event.id)}
                          disabled={controller.loading}
                        >
                          Mark read
                        </Button>
                      </View>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}
            </>
          ) : null}
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
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flexInput: {
    flex: 1,
  },
  meta: {
    color: '#64748b',
  },
  innerCard: {
    borderRadius: 12,
  },
  listBlock: {
    gap: 4,
  },
});
