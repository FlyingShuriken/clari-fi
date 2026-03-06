import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors } from '../../theme';

export function ScreenContainer({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  inner: {
    gap: 16,
  },
});
