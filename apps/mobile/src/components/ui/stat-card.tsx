import { StyleSheet, Text } from 'react-native';
import { Colors } from '../../theme';
import { DarkCard } from './dark-card';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color = Colors.textPrimary }: StatCardProps) {
  return (
    <DarkCard style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
});
