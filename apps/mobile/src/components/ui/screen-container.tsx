import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export function ScreenContainer({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  inner: {
    gap: 12,
  },
});
