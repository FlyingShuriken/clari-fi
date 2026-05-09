import { StyleSheet, Text, TouchableOpacity, type AccessibilityState } from 'react-native';
import { Colors, TouchTarget } from '../../theme';

interface ActionChipProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

export function ActionChip({ label, onPress, selected, disabled, accessibilityLabel, accessibilityState }: ActionChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled, ...accessibilityState }}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TouchTarget.min,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Colors.greenDim,
    borderColor: Colors.green,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  textSelected: {
    color: Colors.green,
  },
});
