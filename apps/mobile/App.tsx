import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/core/navigation/AppNavigator';
import { ClariFiControllerProvider } from './src/core/state/clariFi-controller';
import { AuthScreen } from './src/features/auth/screens/AuthScreen';

const publishableKey =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim() ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const apiBaseUrl =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ?? '').trim() ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  '';

function SignedOutRoot() {
  const [message, setMessage] = useState('');
  return <AuthScreen message={message} onMessage={setMessage} />;
}

function SignedInRoot() {
  return (
    <ClariFiControllerProvider>
      <AppNavigator />
    </ClariFiControllerProvider>
  );
}

export default function App() {
  const missingPublicEnv: string[] = [];
  if (!publishableKey) {
    missingPublicEnv.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }
  if (!apiBaseUrl) {
    missingPublicEnv.push('EXPO_PUBLIC_API_BASE_URL');
  }

  if (missingPublicEnv.length > 0) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <Text variant="bodyLarge" style={styles.fallbackText}>
          Missing required mobile env key(s): {missingPublicEnv.join(', ')}.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <PaperProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <SignedOut>
            <SignedOutRoot />
          </SignedOut>
          <SignedIn>
            <SignedInRoot />
          </SignedIn>
        </SafeAreaProvider>
      </PaperProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  fallbackText: {
    color: '#0f172a',
    textAlign: 'center',
  },
});
