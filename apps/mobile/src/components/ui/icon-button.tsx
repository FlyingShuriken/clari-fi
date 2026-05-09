import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, type AccessibilityState } from 'react-native';
import { Colors, TouchTarget } from '../../theme';

interface IconButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export function IconButton({
  icon,
  label,
  onPress,
  color = Colors.textSecondary,
  disabled,
  selected,
  accessibilityHint,
  accessibilityState,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected, ...accessibilityState }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={selected ? Colors.green : color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TouchTarget.min,
    minHeight: TouchTarget.min,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selected: {
    backgroundColor: Colors.greenDim,
    borderColor: `${Colors.green}55`,
  },
  disabled: {
    opacity: 0.45,
  },
});
