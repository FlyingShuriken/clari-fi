import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme';

interface InlineSpinnerProps {
  label?: string;
}

export function InlineSpinner({ label = 'Loading' }: InlineSpinnerProps) {
  return (
    <View style={styles.inline}>
      <ActivityIndicator size="small" color={Colors.green} />
      <Text style={styles.inlineText}>{label}</Text>
    </View>
  );
}

interface LoadingRowsProps {
  count?: number;
  label?: string;
}

export function LoadingRows({ count = 3, label = 'Syncing data' }: LoadingRowsProps) {
  return (
    <View style={styles.container}>
      <InlineSpinner label={label} />
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.rowBody}>
            <View style={[styles.line, styles.lineLong]} />
            <View style={[styles.line, styles.lineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 8,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
  },
  rowBody: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceHigh,
  },
  lineLong: {
    width: '72%',
  },
  lineShort: {
    width: '42%',
  },
});
