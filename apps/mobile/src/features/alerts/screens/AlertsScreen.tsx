import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { SectionLabel } from '../../../components/ui/section-label';
import { EmptyState } from '../../../components/ui/empty-state';
import { RefreshScroll } from '../../../components/ui/refresh-scroll';
import { LoadingRows } from '../../../components/ui/loading-state';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type BadgeColor = 'green' | 'indigo' | 'coral' | 'amber';

interface BadgeSpec {
  label: string;
  color: BadgeColor;
  bg: string;
  border: string;
}

function getEventBadge(eventKind: string, decision?: string | null): BadgeSpec {
  if (eventKind === 'SIGNAL') {
    if (decision === 'BUY_NOW')  return { label: '● BUY NOW',   color: 'green',  bg: Colors.greenDim,  border: '#32D58330' };
    if (decision === 'WAIT')     return { label: '● WAIT',      color: 'coral',  bg: Colors.coralDim,  border: '#E85A4F30' };
    return                              { label: '● PRICE DROP', color: 'indigo', bg: Colors.indigoDim, border: '#6366F130' };
  }
  return { label: '● THRESHOLD', color: 'amber', bg: '#FFB54720', border: '#FFB54730' };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

export function AlertsScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const unread = controller.alertEvents.filter((e) => !e.readAt);
  const read   = controller.alertEvents.filter((e) => !!e.readAt);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Alerts</Text>
          <Text style={styles.subtitle}>
            {controller.alertUnreadCount} unread notification{controller.alertUnreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newAlertBtn}
          onPress={() => setShowCreateForm((v) => !v)}
        >
          <MaterialCommunityIcons name="plus" size={14} color={Colors.bg} />
          <Text style={styles.newAlertText}>New Alert</Text>
        </TouchableOpacity>
      </View>

      {controller.subscription ? (
        <View style={styles.limitBar}>
          <Text style={styles.limitText}>
            Active alerts {controller.subscription.alerts.activeCount} / {controller.subscription.alerts.activeLimit}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
            <Text style={styles.limitLink}>
              {controller.subscription.plan === 'PREMIUM' ? 'Manage plan' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <RefreshScroll
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onRefreshAsync={controller.loadAlertEvents}
        keyboardShouldPersistTaps="handled"
      >
        {/* Inline create form */}
        {showCreateForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create alert</Text>

            <View style={styles.kindRow}>
              {(['THRESHOLD', 'SIGNAL'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindChip, controller.alertKind === k && styles.kindChipActive]}
                  onPress={() => controller.setAlertKind(k)}
                >
                  <Text style={[styles.kindText, controller.alertKind === k && styles.kindTextActive]}>
                    {k}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label="Item"
              value={controller.alertItem}
              onChangeText={controller.setAlertItem}
              mode="outlined"
              style={styles.input}
              theme={inputTheme}
            />

            {controller.alertKind === 'THRESHOLD' ? (
              <TextInput
                label="Target unit price"
                value={controller.alertTargetUnitPrice}
                onChangeText={controller.setAlertTargetUnitPrice}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                theme={inputTheme}
              />
            ) : (
              <>
                <View style={styles.kindRow}>
                  {(['BOTH', 'BUY_NOW', 'WAIT'] as const).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.kindChip, controller.alertSignalDecisionFilter === f && styles.kindChipActive]}
                      onPress={() => controller.setAlertSignalDecisionFilter(f)}
                    >
                      <Text style={[styles.kindText, controller.alertSignalDecisionFilter === f && styles.kindTextActive]}>
                        {f === 'BOTH' ? 'Buy + Wait' : f === 'BUY_NOW' ? 'Buy' : 'Wait'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  label="Min confidence (0–1)"
                  value={controller.alertSignalMinConfidence}
                  onChangeText={controller.setAlertSignalMinConfidence}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                />
              </>
            )}

            <View style={styles.locationRow}>
              <TextInput
                label="Radius km"
                value={controller.alertRadiusKm}
                onChangeText={controller.setAlertRadiusKm}
                keyboardType="decimal-pad"
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                theme={inputTheme}
              />
              <TextInput
                label="Area"
                value={controller.alertAreaText}
                onChangeText={controller.setAlertAreaText}
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                theme={inputTheme}
              />
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={async () => {
                  await controller.createAlert();
                  setShowCreateForm(false);
                }}
                disabled={controller.loading}
                testID={TEST_IDS.alerts.createButton}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loadBtn}
                onPress={controller.loadAlerts}
                disabled={controller.loading}
                testID={TEST_IDS.alerts.loadAlertsButton}
              >
                <Text style={styles.loadBtnText}>Sync alerts</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Utility row */}
        <View style={styles.utilRow}>
          <TouchableOpacity
            onPress={controller.loadAlertEvents}
            disabled={controller.loading}
            style={styles.utilBtn}
            testID={TEST_IDS.alerts.loadEventsButton}
          >
            {controller.loading || controller.initialDataLoading ? (
              <ActivityIndicator size="small" color={Colors.green} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={16} color={Colors.textSecondary} />
            )}
            <Text style={styles.utilBtnText}>Sync</Text>
          </TouchableOpacity>
          {controller.alertUnreadCount > 0 ? (
            <TouchableOpacity
              onPress={controller.markAllEventsRead}
              disabled={controller.loading}
              style={styles.utilBtn}
              testID={TEST_IDS.alerts.markAllReadButton}
            >
              <Text style={styles.utilBtnText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Unread events */}
        {unread.length > 0 ? (
          <>
            <SectionLabel label="UNREAD" />
            {unread.map((event) => {
              const isSignal = event.eventKind === 'SIGNAL';
              const badge = getEventBadge(event.eventKind, event.signal?.decision);
              const confidence = event.signal?.confidence
                ? `${Math.round(event.signal.confidence * 100)}%`
                : null;

              return (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => controller.markEventRead(event.id)}
                  disabled={controller.loading}
                  activeOpacity={0.8}
                >
                  <View style={[styles.eventCard, { borderLeftColor: badge.border }]}>
                    {/* Top row: badge + time */}
                    <View style={styles.eventTopRow}>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color === 'green' ? Colors.green : badge.color === 'indigo' ? Colors.indigo : badge.color === 'coral' ? Colors.coral : Colors.amber }]}>
                          {badge.label}
                        </Text>
                      </View>
                      <Text style={styles.eventTime}>{formatRelativeTime(event.triggeredAt)}</Text>
                    </View>

                    {/* Item name */}
                    <Text style={styles.eventItem}>{event.item}</Text>

                    {/* Meta columns */}
                    <View style={styles.metaRow}>
                      {isSignal && event.signal ? (
                        <>
                          <View style={styles.metaBlock}>
                            <Text style={styles.metaLabel}>Current Price</Text>
                            <Text style={[styles.metaValue, { color: Colors.green }]}>
                              {controller.formatCurrency(event.triggerUnitPrice)}
                            </Text>
                          </View>
                          {confidence ? (
                            <View style={styles.metaBlock}>
                              <Text style={styles.metaLabel}>Confidence</Text>
                              <Text style={styles.metaValue}>{confidence}</Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <View style={styles.metaBlock}>
                            <Text style={styles.metaLabel}>Now</Text>
                            <Text style={[styles.metaValue, { color: Colors.green }]}>
                              {controller.formatCurrency(event.triggerUnitPrice)}
                            </Text>
                          </View>
                          {event.targetUnitPrice ? (
                            <View style={styles.metaBlock}>
                              <Text style={styles.metaLabel}>Target</Text>
                              <Text style={styles.metaValue}>
                                {controller.formatCurrency(event.targetUnitPrice)}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>

                    {/* Store */}
                    <Text style={styles.eventStore}>{event.areaText || 'Unknown area'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {/* Read events */}
        {read.length > 0 ? (
          <>
            <SectionLabel label="EARLIER" />
            {read.map((event) => {
              const badge = getEventBadge(event.eventKind, event.signal?.decision);
              return (
                <View key={event.id} style={[styles.eventCard, styles.eventCardRead]}>
                  <View style={styles.eventTopRow}>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: Colors.textMuted }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text style={styles.eventTime}>{formatRelativeTime(event.triggeredAt)}</Text>
                  </View>
                  <Text style={[styles.eventItem, { color: Colors.textTertiary }]}>{event.item}</Text>
                  <Text style={styles.eventStore}>
                    {event.areaText || 'Unknown area'} · Read
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        {controller.initialDataLoading && controller.alertEvents.length === 0 && !showCreateForm ? (
          <LoadingRows label="Syncing alerts" count={3} />
        ) : controller.alertEvents.length === 0 && !showCreateForm ? (
          <EmptyState
            icon="bell-outline"
            message="No alert events yet. Create an alert to start monitoring."
          />
        ) : null}
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  limitBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  limitText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  limitLink: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '700',
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
  newAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  newAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100,
    gap: 10,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kindChipActive: {
    backgroundColor: Colors.greenDim,
    borderColor: Colors.green,
  },
  kindText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  kindTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  loadBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  utilRow: {
    flexDirection: 'row',
    gap: 10,
  },
  utilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  utilBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  eventCardRead: {
    opacity: 0.6,
  },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  eventItem: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaBlock: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventStore: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
