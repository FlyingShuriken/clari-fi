import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { MetaRow } from '../../../components/ui/meta-row';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function AccountScreen() {
  const controller = useClariFiController();

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Account" subtitle="Auth and environment configuration" />
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
          <MetaRow label="Push status" value={controller.pushStatus || '-'} />
          <MetaRow label="Push token" value={controller.pushTokenPreview || '-'} />

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
  },
  helpText: {
    color: '#475569',
  },
});
