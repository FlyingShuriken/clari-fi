import { useSignIn } from '@clerk/clerk-expo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { TEST_IDS } from '../../core/testing/test-ids';

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
      onMessage(
        `Sign-in needs ${phase.replace('_', ' ')}, but no usable factor was returned. Available: ${available}.`,
      );
      return;
    }

    if (factor.strategy === 'password') {
      onMessage(
        'Password first-factor is required. Verify this user has password sign-in enabled in Clerk.',
      );
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
    <Card mode="contained" style={styles.card}>
      <Card.Title title="Sign in to ClariFi" subtitle="Use your Clerk credentials" />
      <Card.Content style={styles.content}>
        {!pendingFactor ? (
          <>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              mode="outlined"
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry
              mode="outlined"
            />

            <Button
              mode="contained"
              onPress={handleSignIn}
              loading={loading}
              disabled={loading || !isLoaded || !email.trim() || !password}
              testID={TEST_IDS.auth.signInButton}
            >
              Sign in
            </Button>
          </>
        ) : (
          <>
            <Text variant="bodyMedium" style={styles.helpText}>
              Verification required: {pendingFactor.phase.replace('_', ' ')} via {pendingFactor.label}
            </Text>
            <TextInput
              label="Verification code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              mode="outlined"
            />

            <View style={styles.row}>
              <Button
                mode="contained"
                onPress={handleVerifyFactor}
                loading={loading}
                disabled={loading || !isLoaded}
                testID={TEST_IDS.auth.verifyCodeButton}
              >
                Verify
              </Button>
              <Button
                mode="outlined"
                onPress={handleResendCode}
                disabled={
                  loading ||
                  !isLoaded ||
                  (pendingFactor.strategy !== 'email_code' &&
                    pendingFactor.strategy !== 'phone_code')
                }
                testID={TEST_IDS.auth.resendCodeButton}
              >
                Resend
              </Button>
            </View>

            <Button
              mode="text"
              onPress={() => {
                setPendingFactor(null);
                setVerificationCode('');
                onMessage('');
              }}
              disabled={loading}
            >
              Back to email/password
            </Button>
          </>
        )}

        {message ? (
          <Text variant="bodySmall" style={styles.message}>
            {message}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  content: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  helpText: {
    color: '#334155',
  },
  message: {
    color: '#0f172a',
  },
});
