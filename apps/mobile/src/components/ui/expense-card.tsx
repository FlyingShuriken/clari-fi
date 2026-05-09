import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme';

interface ExpenseCardProps {
  merchant: string;
  meta: string;
  amount: string;
  category?: string;
  hasCheaperOption?: boolean;
  onPress?: () => void;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    groceries:  Colors.catFood,
    food:       Colors.catFood,
    transport:  Colors.catTransport,
    dining:     Colors.catDining,
    restaurant: Colors.catDining,
    shopping:   Colors.catShopping,
    utilities:  Colors.catUtilities,
  };
  return map[category.toLowerCase()] ?? Colors.catOther;
}

export function ExpenseCard({ merchant, meta, amount, category = 'other', hasCheaperOption, onPress }: ExpenseCardProps) {
  const barColor = getCategoryColor(category);

  const inner = (
    <View style={styles.card}>
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={styles.info}>
        <Text style={styles.merchant} numberOfLines={1}>{merchant}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
      {hasCheaperOption && (
        <View style={styles.badge}>
          <MaterialCommunityIcons name="tag-arrow-down-outline" size={12} color={Colors.green} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  }

  return inner;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  bar: {
    width: 4,
    height: 40,
    borderRadius: 4,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  merchant: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.greenDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
