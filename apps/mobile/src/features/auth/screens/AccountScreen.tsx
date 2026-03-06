import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { MetaRow } from '../../../components/ui/meta-row';
import { TEST_IDS } from '../../../core/testing/test-ids';

function formatTimestamp(value: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AccountScreen() {
  const controller = useClariFiController();
  const activePushDeviceCount = controller.pushDevices.filter((device) => device.active).length;

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Account" subtitle="Auth, backend health, and push diagnostics" />
        <Card.Content style={styles.content}>
          <TextInput
            label="API Base URL"
            value={controller.apiBaseUrl}
            onChangeText={controller.setApiBaseUrl}
            autoCapitalize="none"
            mode="outlined"
            testID={TEST_IDS.account.apiBaseInput}
          />

          <MetaRow label="Clerk user" value={controller.signedInEmail || '-'} />
          <MetaRow label="API user id" value={controller.backendUserId || '-'} />
          <MetaRow label="Backend live" value={controller.backendLiveHealth?.status || '-'} />
          <MetaRow label="Backend ready" value={controller.backendReadyHealth?.status || '-'} />
          <MetaRow
            label="Health checked"
            value={formatTimestamp(controller.backendHealthCheckedAt)}
          />
          <MetaRow label="Push status" value={controller.pushStatus || '-'} />
          <MetaRow label="Push token" value={controller.pushTokenPreview || '-'} />
          <MetaRow
            label="Active push devices"
            value={`${activePushDeviceCount} / ${controller.pushDevices.length}`}
          />

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.syncBackendUser}
              loading={controller.loading}
              disabled={controller.loading}
              testID={TEST_IDS.account.syncBackendButton}
            >
              Sync user
            </Button>
            <Button
              mode="outlined"
              onPress={controller.checkBackendHealth}
              disabled={controller.loading}
              testID={TEST_IDS.account.checkHealthButton}
            >
              Check health
            </Button>
          </View>

          <View style={styles.row}>
            <Button
              mode="outlined"
              onPress={controller.loadPushDevices}
              disabled={controller.loading}
              testID={TEST_IDS.account.refreshPushDevicesButton}
            >
              Refresh devices
            </Button>
            <Button
              mode="outlined"
              onPress={controller.revokeCurrentPushDevice}
              disabled={controller.loading || controller.pushTokenPreview === '-'}
              testID={TEST_IDS.account.revokePushDeviceButton}
            >
              Revoke device
            </Button>
            <Button
              mode="outlined"
              onPress={controller.signOutUser}
              disabled={controller.loading}
              testID={TEST_IDS.account.signOutButton}
            >
              Sign out
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Notes" />
        <Card.Content style={styles.content}>
          <Text variant="bodySmall" style={styles.helpText}>
            Use a reachable API URL on your phone, for example your machine LAN IP: `http://192.168.x.x:3000/v1`.
          </Text>
          <Text variant="bodySmall" style={styles.helpText}>
            Internal beta flow: Sync user, Check health, Refresh devices, then run Capture, Ledger, Reports, Prices, Families, Splits, and Alerts smoke.
          </Text>
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
    gap: 12,
    flexWrap: 'wrap',
  },
  helpText: {
    color: '#475569',
  },
});
