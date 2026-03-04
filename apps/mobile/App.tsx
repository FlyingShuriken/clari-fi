import { ClerkProvider, SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthSection } from './src/features/auth/AuthSection';
import { ClerkEmailSignInSection } from './src/features/auth/ClerkEmailSignInSection';
import { ReceiptCaptureSection } from './src/features/capture/ReceiptCaptureSection';
import { VoiceCaptureSection } from './src/features/capture/VoiceCaptureSection';
import { InsightsSection } from './src/features/insights/InsightsSection';
import {
  confirmExpense,
  listExpenses,
  loadMonthlyReport,
  parseReceipt,
  parseVoice,
  uploadArtifact,
  verifyClerkSessionToken,
} from './src/shared/api';
import type { ReceiptParseResult, VoiceParseResult } from './src/shared/types';

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const defaultApiBaseUrl =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ?? '').trim() ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:3000/v1';
const publishableKey =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim() ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthGate() {
  const [message, setMessage] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ClariFi Phase 0/1 Baseline</Text>

        <SignedOut>
          <ClerkEmailSignInSection message={message} onMessage={setMessage} />
        </SignedOut>

        <SignedIn>
          <AuthenticatedApp message={message} onMessage={setMessage} />
        </SignedIn>
      </ScrollView>
    </SafeAreaView>
  );
}

interface AuthenticatedAppProps {
  message: string;
  onMessage: (message: string) => void;
}

function AuthenticatedApp({ message, onMessage }: AuthenticatedAppProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [backendUserId, setBackendUserId] = useState('');

  const [transcriptInput, setTranscriptInput] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState('');
  const [recordedAudioFileRef, setRecordedAudioFileRef] = useState('');

  const [selectedReceiptUri, setSelectedReceiptUri] = useState('');
  const [selectedReceiptBase64, setSelectedReceiptBase64] = useState('');
  const [selectedReceiptMimeType, setSelectedReceiptMimeType] = useState('image/jpeg');
  const [selectedReceiptFileRef, setSelectedReceiptFileRef] = useState('');

  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null);
  const [receiptParse, setReceiptParse] = useState<ReceiptParseResult | null>(null);
  const [voiceParseLatencyMs, setVoiceParseLatencyMs] = useState<number | null>(null);
  const [receiptParseLatencyMs, setReceiptParseLatencyMs] = useState<number | null>(
    null,
  );
  const [ledgerPreview, setLedgerPreview] = useState('');
  const [reportPreview, setReportPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const { getToken, signOut } = useAuth();
  const { user } = useUser();

  async function getBearerTokenOrThrow(): Promise<string> {
    const token = await getToken();
    if (!token) {
      throw new Error('No Clerk session token available. Please sign in again.');
    }

    return token;
  }

  async function handleSyncBackendUser() {
    setLoading(true);
    onMessage('');

    try {
      const token = await getBearerTokenOrThrow();
      const result = await verifyClerkSessionToken(normalizeBaseUrl(apiBaseUrl), token);
      setBackendUserId(result.user.id);
      onMessage(`Synced backend user: ${result.user.email}`);
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    onMessage('');

    try {
      await signOut();
      setBackendUserId('');
      onMessage('Signed out.');
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    onMessage('');

    try {
      if (recording) {
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission denied.');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const created = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setVoiceParse(null);
      setRecordedAudioBase64('');
      setRecordedAudioFileRef('');
      setRecording(created.recording);
      onMessage('Recording started. Tap stop when done.');
    } catch (error) {
      onMessage(errorToMessage(error));
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    setLoading(true);
    onMessage('');

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('Recording file URI is unavailable.');
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setRecordedAudioBase64(base64);

      const token = await getBearerTokenOrThrow();
      const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
        kind: 'audio',
        mimeType: 'audio/m4a',
        fileBase64: base64,
      });
      setRecordedAudioFileRef(uploaded.fileRef);

      onMessage('Audio fallback ready for parsing.');
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleParseVoice() {
    setLoading(true);
    onMessage('');

    try {
      if (!transcriptInput.trim() && !recordedAudioBase64) {
        throw new Error('Provide transcript or record audio first.');
      }

      const token = await getBearerTokenOrThrow();
      const startedAt = Date.now();
      const result = await parseVoice(normalizeBaseUrl(apiBaseUrl), token, {
        transcript: transcriptInput.trim() || undefined,
        audioBase64: transcriptInput.trim() ? undefined : recordedAudioBase64,
        locale: 'ms-MY',
        deviceConfidence: transcriptInput.trim() ? 0.96 : undefined,
      });

      setVoiceParse(result);
      setVoiceParseLatencyMs(Date.now() - startedAt);
      onMessage(`Voice parsed via ${result.parseMeta.parsePath}. Review and confirm.`);
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmVoice() {
    if (!voiceParse) {
      return;
    }

    setLoading(true);
    onMessage('');

    try {
      const token = await getBearerTokenOrThrow();
      await confirmExpense(normalizeBaseUrl(apiBaseUrl), token, {
        ...voiceParse.candidate,
        transactionAt: new Date().toISOString(),
        confidence: 0.82,
        rawPayload: {
          transcript: voiceParse.transcript,
          sttConfidence: voiceParse.sttConfidence,
          parsePath: voiceParse.parseMeta.parsePath,
          parseLatencyMs: voiceParse.parseMeta.parseLatencyMs,
          audioFileRef: recordedAudioFileRef || null,
        },
      });
      onMessage('Voice expense saved.');
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function chooseReceipt(fromCamera: boolean) {
    onMessage('');

    try {
      if (fromCamera) {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          throw new Error('Camera permission denied.');
        }
      } else {
        const mediaPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          throw new Error('Photo library permission denied.');
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
          });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const picked = result.assets[0];
      if (!picked.base64) {
        throw new Error('Could not read image as base64.');
      }

      const mimeType = picked.mimeType ?? 'image/jpeg';
      setSelectedReceiptUri(picked.uri);
      setSelectedReceiptBase64(picked.base64);
      setSelectedReceiptMimeType(mimeType);
      setSelectedReceiptFileRef('');
      setReceiptParse(null);

      const token = await getBearerTokenOrThrow();
      const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
        kind: 'receipt',
        mimeType,
        fileBase64: picked.base64,
      });
      setSelectedReceiptFileRef(uploaded.fileRef);

      onMessage('Receipt image selected and uploaded.');
    } catch (error) {
      onMessage(errorToMessage(error));
    }
  }

  async function handleParseReceipt() {
    setLoading(true);
    onMessage('');

    try {
      if (!selectedReceiptBase64 && !selectedReceiptFileRef) {
        throw new Error('Select a receipt first.');
      }

      const token = await getBearerTokenOrThrow();
      const startedAt = Date.now();
      const result = await parseReceipt(normalizeBaseUrl(apiBaseUrl), token, {
        fileRef: selectedReceiptFileRef || undefined,
        mimeType: selectedReceiptMimeType,
        imageBase64: selectedReceiptBase64 || undefined,
      });
      setReceiptParse(result);
      setReceiptParseLatencyMs(Date.now() - startedAt);
      onMessage('Receipt parsed. Review and confirm.');
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReceipt() {
    if (!receiptParse) {
      return;
    }

    setLoading(true);
    onMessage('');

    try {
      const token = await getBearerTokenOrThrow();
      await confirmExpense(normalizeBaseUrl(apiBaseUrl), token, {
        ...receiptParse.candidate,
        currency: receiptParse.candidate.currency,
        confidence: 0.8,
        rawPayload: {
          parsePath: receiptParse.parseMeta.parsePath,
          parseLatencyMs: receiptParse.parseMeta.parseLatencyMs,
          localReceiptUri: selectedReceiptUri || null,
        },
        receipt: {
          fileRef:
            selectedReceiptFileRef || receiptParse.fileRef || 'local://receipt-not-uploaded',
          mimeType: selectedReceiptMimeType,
          parsedPayload: receiptParse.candidate,
          ocrRaw: receiptParse.rawPayload,
          confidence: 0.8,
        },
      });
      onMessage('Receipt expense saved.');
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadLedger() {
    setLoading(true);
    onMessage('');

    try {
      const token = await getBearerTokenOrThrow();
      const result = await listExpenses(normalizeBaseUrl(apiBaseUrl), token);
      setLedgerPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadReport() {
    setLoading(true);
    onMessage('');

    try {
      const token = await getBearerTokenOrThrow();
      const result = await loadMonthlyReport(normalizeBaseUrl(apiBaseUrl), token);
      setReportPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.appSection}>
      <AuthSection
        apiBaseUrl={apiBaseUrl}
        onApiBaseUrlChange={setApiBaseUrl}
        signedInEmail={user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '-'}
        backendUserId={backendUserId}
        onSyncBackendUser={handleSyncBackendUser}
        onSignOut={handleSignOut}
      />

      <VoiceCaptureSection
        transcript={transcriptInput}
        onTranscriptChange={setTranscriptInput}
        recordingReady={Boolean(recordedAudioBase64)}
        parseLatencyMs={voiceParseLatencyMs}
        parseResult={voiceParse}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onParseVoice={handleParseVoice}
        onConfirmVoice={handleConfirmVoice}
      />

      <ReceiptCaptureSection
        receiptReady={Boolean(selectedReceiptBase64 || selectedReceiptUri)}
        receiptFileRef={selectedReceiptFileRef}
        parseLatencyMs={receiptParseLatencyMs}
        parseResult={receiptParse}
        onPickCamera={() => chooseReceipt(true)}
        onPickGallery={() => chooseReceipt(false)}
        onParseReceipt={handleParseReceipt}
        onConfirmReceipt={handleConfirmReceipt}
      />

      <InsightsSection
        ledgerPreview={ledgerPreview}
        reportPreview={reportPreview}
        onLoadLedger={handleLoadLedger}
        onLoadReport={handleLoadReport}
      />

      {loading ? <ActivityIndicator style={styles.loader} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

export default function App() {
  if (!publishableKey) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.message}>
          Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your mobile env.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGate />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  appSection: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  loader: {
    marginTop: 12,
  },
  message: {
    fontSize: 14,
    color: '#0f172a',
  },
});
