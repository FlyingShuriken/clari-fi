import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { MetaRow } from '../../../components/ui/meta-row';
import { DarkCard } from '../../../components/ui/dark-card';
import { PillBadge } from '../../../components/ui/pill-badge';
import { InlineSpinner } from '../../../components/ui/loading-state';
import { TEST_IDS } from '../../../core/testing/test-ids';
import { Colors } from '../../../theme';

function formatTimestamp(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AccountScreen() {
  const controller = useClariFiController();
  const activePushDeviceCount = controller.pushDevices.filter((d) => d.active).length;
  const isLive = controller.backendLiveHealth?.status === 'live';
  const isReady = controller.backendReadyHealth?.status === 'ready';
  const syncInProgress = controller.authSyncStatus === 'syncing' || controller.initialDataLoading;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <DarkCard radius={20}>
        <Text style={styles.cardTitle}>Status</Text>
        <View style={styles.statusRow}>
          <PillBadge label={isLive ? 'Live' : 'Offline'} color={isLive ? 'green' : 'coral'} />
          <PillBadge label={isReady ? 'Ready' : 'Not ready'} color={isReady ? 'green' : 'amber'} />
          <PillBadge
            label={
              controller.authSyncStatus === 'error'
                ? 'Sync error'
                : controller.authSyncStatus === 'ok'
                ? 'Synced'
                : 'Syncing'
            }
            color={controller.authSyncStatus === 'error' ? 'coral' : 'green'}
          />
        </View>
        {syncInProgress ? <InlineSpinner label="Syncing account data" /> : null}
        <View style={styles.metaGroup}>
          <MetaRow label="Signed in as" value={controller.signedInEmail || '-'} />
          <MetaRow label="Backend user" value={controller.backendUserId || '-'} />
          <MetaRow label="Health checked" value={formatTimestamp(controller.backendHealthCheckedAt)} />
          <MetaRow label="Data synced" value={formatTimestamp(controller.initialDataSyncedAt)} />
        </View>
        {controller.authSyncError ? (
          <Text style={styles.errorText}>{controller.authSyncError}</Text>
        ) : null}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={controller.syncBackendUser}
            disabled={controller.loading}
            testID={TEST_IDS.account.syncBackendButton}
          >
            <Text style={styles.btnOutlineText}>Sync now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={controller.checkBackendHealth}
            disabled={controller.loading}
            testID={TEST_IDS.account.checkHealthButton}
          >
            <Text style={styles.btnOutlineText}>Check health</Text>
          </TouchableOpacity>
        </View>
      </DarkCard>

      <DarkCard radius={16}>
        <Text style={styles.cardTitle}>Push notifications</Text>
        <MetaRow label="Status" value={controller.pushStatus || '-'} />
        <MetaRow label="Token" value={controller.pushTokenPreview || '-'} />
        <MetaRow
          label="Active devices"
          value={`${activePushDeviceCount} / ${controller.pushDevices.length}`}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={controller.loadPushDevices}
            disabled={controller.loading}
            testID={TEST_IDS.account.refreshPushDevicesButton}
          >
            <Text style={styles.btnOutlineText}>Sync devices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={controller.revokeCurrentPushDevice}
            disabled={controller.loading || controller.pushTokenPreview === '-'}
            testID={TEST_IDS.account.revokePushDeviceButton}
          >
            <Text style={styles.btnOutlineText}>Revoke device</Text>
          </TouchableOpacity>
        </View>
      </DarkCard>

      <DarkCard radius={16}>
        <Text style={styles.cardTitle}>Developer</Text>
        <TextInput
          label="API Base URL"
          value={controller.apiBaseUrl}
          onChangeText={controller.setApiBaseUrl}
          autoCapitalize="none"
          mode="outlined"
          testID={TEST_IDS.account.apiBaseInput}
          theme={{ colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary } }}
          style={styles.apiInput}
        />
        <Text style={styles.hint}>
          Use your machine's LAN IP, e.g. http://192.168.x.x:3000/v1
        </Text>
      </DarkCard>

      <TouchableOpacity
        style={[styles.btn, styles.btnDestructive]}
        onPress={controller.signOutUser}
        disabled={controller.loading}
        testID={TEST_IDS.account.signOutButton}
      >
        <Text style={styles.btnDestructiveText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metaGroup: {
    gap: 8,
    marginBottom: 16,
    marginTop: 12,
  },
  errorText: {
    color: Colors.coral,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.green,
  },
  btnPrimaryText: {
    color: '#0B0B0E',
    fontWeight: '700',
    fontSize: 14,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnOutlineText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  btnDestructive: {
    backgroundColor: Colors.coralDim,
    borderWidth: 1,
    borderColor: Colors.coral,
  },
  btnDestructiveText: {
    color: Colors.coral,
    fontWeight: '700',
    fontSize: 14,
  },
  apiInput: {
    backgroundColor: Colors.surface,
    fontSize: 13,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
