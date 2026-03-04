import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ClerkEmailSignInSection } from '../ClerkEmailSignInSection';

interface AuthScreenProps {
  message: string;
  onMessage: (message: string) => void;
}

export function AuthScreen({ message, onMessage }: AuthScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          ClariFi
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Expense capture with voice, receipts, and price intelligence.
        </Text>
      </View>
      <ClerkEmailSignInSection message={message} onMessage={onMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    gap: 18,
  },
  header: {
    gap: 6,
  },
  title: {
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
  },
});
