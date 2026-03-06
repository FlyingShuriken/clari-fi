import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../theme';

type BadgeColor = 'green' | 'indigo' | 'coral' | 'amber';

interface PillBadgeProps {
  label: string;
  color?: BadgeColor;
  dotted?: boolean;
}

const colorMap: Record<BadgeColor, { bg: string; text: string; dot: string }> = {
  green:  { bg: Colors.greenDim,  text: Colors.green,  dot: Colors.green },
  indigo: { bg: Colors.indigoDim, text: Colors.indigo, dot: Colors.indigo },
  coral:  { bg: Colors.coralDim,  text: Colors.coral,  dot: Colors.coral },
  amber:  { bg: '#FFB54720',      text: Colors.amber,  dot: Colors.amber },
};

export function PillBadge({ label, color = 'green', dotted = true }: PillBadgeProps) {
  const theme = colorMap[color];
  return (
    <View style={[styles.pill, { backgroundColor: theme.bg }]}>
      {dotted && <View style={[styles.dot, { backgroundColor: theme.dot }]} />}
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
