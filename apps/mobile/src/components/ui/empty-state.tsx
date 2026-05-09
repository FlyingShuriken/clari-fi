import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, TouchTarget } from '../../theme';

interface EmptyStateProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  message?: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, actionAccessibilityLabel }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={40} color={Colors.textMuted} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onAction}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, actionLabel = 'Try again', onAction }: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title={title}
      message={message}
      actionLabel={onAction ? actionLabel : undefined}
      onAction={onAction}
      actionAccessibilityLabel={onAction ? `${actionLabel}: ${title}` : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    minHeight: TouchTarget.min,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
});
