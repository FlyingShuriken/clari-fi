import { StyleSheet, View, Text } from 'react-native';
import { ClerkEmailSignInSection } from '../ClerkEmailSignInSection';
import { Colors } from '../../../theme';

interface AuthScreenProps {
  message: string;
  onMessage: (message: string) => void;
}

export function AuthScreen({ message, onMessage }: AuthScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ClariFi</Text>
        <Text style={styles.subtitle}>
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
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.green,
    fontFamily: 'Georgia',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
