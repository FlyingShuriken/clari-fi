import { useSignIn } from '@clerk/clerk-expo';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface ClerkEmailSignInSectionProps {
  message: string;
  onMessage: (message: string) => void;
}

type FactorPhase = 'first_factor' | 'second_factor';

interface PendingFactor {
  phase: FactorPhase;
  strategy: string;
  label: string;
  params: Record<string, string>;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function listStrategies(attempt: Record<string, unknown>, phase: FactorPhase): string[] {
  const key = phase === 'first_factor' ? 'supportedFirstFactors' : 'supportedSecondFactors';
  const factors = attempt[key];
  if (!Array.isArray(factors)) {
    return [];
  }

  return factors
    .map((factor) => {
      const value = asRecord(factor);
      if (!value) {
        return '';
      }
      return pickString(value, 'strategy');
    })
    .filter(Boolean);
}

function pickPreferredFactor(
  attempt: Record<string, unknown>,
  phase: FactorPhase,
): PendingFactor | null {
  const key = phase === 'first_factor' ? 'supportedFirstFactors' : 'supportedSecondFactors';
  const factors = attempt[key];
  if (!Array.isArray(factors)) {
    return null;
  }

  const mapped = factors
    .map((factor) => asRecord(factor))
    .filter((factor): factor is Record<string, unknown> => Boolean(factor));
  if (!mapped.length) {
    return null;
  }

  const preferredStrategies = ['email_code', 'phone_code', 'totp', 'backup_code'];
  const selected =
    mapped.find((factor) => preferredStrategies.includes(pickString(factor, 'strategy'))) ??
    mapped[0];

  const strategy = pickString(selected, 'strategy');
  if (!strategy) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const field of [
    'emailAddressId',
    'phoneNumberId',
    'web3WalletId',
    'enterpriseConnectionId',
  ]) {
    const value = pickString(selected, field);
    if (value) {
      params[field] = value;
    }
  }

  const safeIdentifier = pickString(selected, 'safeIdentifier');
  const channel = safeIdentifier ? `${strategy} (${safeIdentifier})` : strategy;

  return {
    phase,
    strategy,
    label: channel,
    params,
  };
}

export function ClerkEmailSignInSection({
  message,
  onMessage,
}: ClerkEmailSignInSectionProps) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingFactor, setPendingFactor] = useState<PendingFactor | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAttemptResult(attemptInput: unknown): Promise<void> {
    if (!signIn) {
      onMessage('Clerk sign-in is not ready yet.');
      return;
    }

    const attempt = asRecord(attemptInput);
    if (!attempt) {
      onMessage('Invalid sign-in response from Clerk.');
      return;
    }

    const status = pickString(attempt, 'status') || 'unknown';
    const createdSessionId = pickString(attempt, 'createdSessionId');

    if (status === 'complete' && createdSessionId) {
      await setActive({ session: createdSessionId });
      setPendingFactor(null);
      setVerificationCode('');
      onMessage('Signed in with Clerk.');
      return;
    }

    if (status !== 'needs_first_factor' && status !== 'needs_second_factor') {
      onMessage(
        `Sign-in is not complete (status: ${status}). Check Clerk sign-in settings for this user.`,
      );
      return;
    }

    const phase: FactorPhase =
      status === 'needs_first_factor' ? 'first_factor' : 'second_factor';
    const factor = pickPreferredFactor(attempt, phase);

    if (!factor) {
      const available = listStrategies(attempt, phase).join(', ') || 'none';
      onMessage(`Sign-in needs ${phase.replace('_', ' ')}, but no usable factor was returned. Available: ${available}.`);
      return;
    }

    if (factor.strategy === 'password') {
      onMessage('Password first-factor is required. Verify this user has password sign-in enabled in Clerk.');
      return;
    }

    setPendingFactor(factor);
    setVerificationCode('');

    if (factor.strategy === 'email_code' || factor.strategy === 'phone_code') {
      if (phase === 'first_factor') {
        await signIn.prepareFirstFactor({
          strategy: factor.strategy as never,
          ...factor.params,
        });
      } else {
        await signIn.prepareSecondFactor({
          strategy: factor.strategy as never,
          ...factor.params,
        });
      }

      onMessage(`Verification code sent via ${factor.label}. Enter it to continue.`);
      return;
    }

    if (factor.strategy === 'totp' || factor.strategy === 'backup_code') {
      const instruction =
        factor.strategy === 'totp'
          ? 'Enter your authenticator app code.'
          : 'Enter one of your backup codes.';
      onMessage(`${instruction} (step: ${phase.replace('_', ' ')})`);
      return;
    }

    onMessage(
      `Unsupported Clerk factor "${factor.strategy}" (status: ${status}). Enable email code, phone code, or TOTP in Clerk.`,
    );
  }

  async function handleSignIn(): Promise<void> {
    if (!isLoaded || !signIn) {
      return;
    }

    setLoading(true);
    onMessage('');
    setPendingFactor(null);
    setVerificationCode('');

    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      await handleAttemptResult(attempt);
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyFactor(): Promise<void> {
    if (!isLoaded || !signIn || !pendingFactor) {
      return;
    }

    if (!verificationCode.trim()) {
      onMessage('Please enter the verification code.');
      return;
    }

    setLoading(true);
    onMessage('');

    try {
      const params = {
        strategy: pendingFactor.strategy as never,
        code: verificationCode.trim(),
      };

      const attempt =
        pendingFactor.phase === 'first_factor'
          ? await signIn.attemptFirstFactor(params)
          : await signIn.attemptSecondFactor(params);

      await handleAttemptResult(attempt);
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode(): Promise<void> {
    if (!isLoaded || !signIn || !pendingFactor) {
      return;
    }
    if (pendingFactor.strategy !== 'email_code' && pendingFactor.strategy !== 'phone_code') {
      return;
    }

    setLoading(true);
    onMessage('');

    try {
      if (pendingFactor.phase === 'first_factor') {
        await signIn.prepareFirstFactor({
          strategy: pendingFactor.strategy as never,
          ...pendingFactor.params,
        });
      } else {
        await signIn.prepareSecondFactor({
          strategy: pendingFactor.strategy as never,
          ...pendingFactor.params,
        });
      }
      onMessage(`Verification code resent via ${pendingFactor.label}.`);
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clerk Sign-In</Text>
      <Text style={styles.subtitle}>Use your Clerk email and password.</Text>

      {!pendingFactor ? (
        <>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
          />

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            placeholder="Password"
          />

          <Button
            title={loading ? 'Signing in...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={loading || !isLoaded}
          />
        </>
      ) : (
        <>
          <Text style={styles.helpText}>
            Verification required: {pendingFactor.phase.replace('_', ' ')} via{' '}
            {pendingFactor.label}
          </Text>

          <TextInput
            style={styles.input}
            value={verificationCode}
            onChangeText={setVerificationCode}
            autoCapitalize="none"
            keyboardType="number-pad"
            placeholder="Verification code"
          />

          <View style={styles.row}>
            <Button
              title={loading ? 'Verifying...' : 'Verify'}
              onPress={handleVerifyFactor}
              disabled={loading || !isLoaded}
            />
            <Button
              title={loading ? 'Resending...' : 'Resend'}
              onPress={handleResendCode}
              disabled={
                loading ||
                !isLoaded ||
                (pendingFactor.strategy !== 'email_code' &&
                  pendingFactor.strategy !== 'phone_code')
              }
            />
          </View>

          <Button
            title="Back to email/password"
            onPress={() => {
              setPendingFactor(null);
              setVerificationCode('');
              onMessage('');
            }}
            disabled={loading}
          />
        </>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  helpText: {
    fontSize: 12,
    color: '#334155',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  message: {
    fontSize: 12,
    color: '#0f172a',
  },
});
