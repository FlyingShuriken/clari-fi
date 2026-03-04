import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="labelMedium" style={styles.label}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: '#475569',
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    color: '#0f172a',
  },
});
