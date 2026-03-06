import { StyleSheet, Text } from 'react-native';
import { Colors } from '../../theme';

export function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.text}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
});
