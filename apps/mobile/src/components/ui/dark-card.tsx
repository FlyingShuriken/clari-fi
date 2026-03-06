import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Shadows } from '../../theme';

interface DarkCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: 16 | 20;
  glow?: 'green' | 'indigo' | 'coral';
}

export function DarkCard({ children, style, radius = 16, glow }: DarkCardProps) {
  const glowStyle = glow === 'green'
    ? Shadows.greenGlow
    : glow === 'indigo'
    ? Shadows.indigoGlow
    : glow === 'coral'
    ? Shadows.coralGlow
    : Shadows.card;

  return (
    <View style={[styles.card, { borderRadius: radius }, glowStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: 16,
  },
});
