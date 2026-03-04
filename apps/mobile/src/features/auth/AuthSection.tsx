import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface AuthSectionProps {
  apiBaseUrl: string;
  onApiBaseUrlChange: (value: string) => void;
  signedInEmail: string;
  backendUserId: string;
  onSyncBackendUser: () => void;
  onSignOut: () => void;
}

export function AuthSection(props: AuthSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>1) Auth (Clerk SDK)</Text>

      <Text style={styles.label}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={props.apiBaseUrl}
        onChangeText={props.onApiBaseUrlChange}
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <Button title="Sync User to API" onPress={props.onSyncBackendUser} />
        <Button title="Sign Out" onPress={props.onSignOut} />
      </View>

      <Text style={styles.meta}>Clerk user: {props.signedInEmail || '-'}</Text>
      <Text style={styles.meta}>API user id: {props.backendUserId || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: {
    fontSize: 12,
    color: '#334155',
  },
});
