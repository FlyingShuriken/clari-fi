import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../theme';

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
    fontSize: 13,
    color: Colors.textSecondary,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
