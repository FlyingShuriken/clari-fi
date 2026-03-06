import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../theme';

interface CategoryProgressProps {
  category: string;
  amount: string;
  percentage: number;
  color: string;
}

export function CategoryProgress({ category, amount, percentage, color }: CategoryProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.name}>{category}</Text>
        <Text style={styles.amount}>{amount}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 13,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  track: {
    height: 6,
    backgroundColor: '#2A2A2E',
    borderRadius: 3,
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
