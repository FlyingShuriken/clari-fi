import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, TouchTarget } from '../../theme';

interface ActionCardProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  actionLabel?: string;
  tone?: 'green' | 'indigo' | 'coral' | 'amber';
}

const toneColor = {
  green: Colors.green,
  indigo: Colors.indigo,
  coral: Colors.coral,
  amber: Colors.amber,
};

export function ActionCard({ icon, title, subtitle, onPress, actionLabel, tone = 'green' }: ActionCardProps) {
  const color = toneColor[tone];
  const content = (
    <View style={styles.inner}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {actionLabel ? <Text style={[styles.action, { color }]}>{actionLabel}</Text> : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}${actionLabel ? `. ${actionLabel}` : ''}`}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  inner: {
    minHeight: TouchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  action: {
    fontSize: 12,
    fontWeight: '800',
  },
});
