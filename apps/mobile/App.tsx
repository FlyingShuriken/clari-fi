import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  apiRequest,
  requestSupabasePasswordSignIn,
  type VerifyResponse,
} from './src/api';

interface VoiceParseResult {
  transcript: string;
  sttConfidence: number;
  candidate: {
    source: 'VOICE';
    currency: 'MYR' | 'SGD' | 'USD';
    transactionAt: string;
    merchantText?: string;
    totalAmount: number;
    paymentMethod?:
      | 'CASH'
      | 'CARD'
      | 'BANK_TRANSFER'
      | 'E_WALLET'
      | 'TNG'
      | 'GRABPAY'
      | 'SHOPEEPAY'
      | 'DUITNOW'
      | 'OTHER';
    lineItems: Array<{
      descriptionRaw: string;
      totalPrice: number;
    }>;
  };
}

interface ReceiptParseResult {
  candidate: {
    merchantText?: string;
    totalAmount: number;
    currency: 'MYR' | 'SGD' | 'USD';
    lineItems: Array<{
      descriptionRaw: string;
      totalPrice: number;
    }>;
  };
  rawPayload: Record<string, unknown>;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function masked(value: string): string {
  if (!value) {
    return 'Not set';
  }

  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const defaultApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';
const defaultSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const defaultSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [supabaseUrl, setSupabaseUrl] = useState(defaultSupabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(defaultSupabaseAnonKey);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appToken, setAppToken] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState('');
  const [recordedAudioBase64, setRecordedAudioBase64] = useState('');
  const [selectedReceiptUri, setSelectedReceiptUri] = useState('');
  const [selectedReceiptBase64, setSelectedReceiptBase64] = useState('');

  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null);
  const [receiptParse, setReceiptParse] = useState<ReceiptParseResult | null>(null);
  const [voiceParseLatencyMs, setVoiceParseLatencyMs] = useState<number | null>(
    null,
  );
  const [receiptParseLatencyMs, setReceiptParseLatencyMs] = useState<number | null>(
    null,
  );
  const [ledgerPreview, setLedgerPreview] = useState('');
  const [reportPreview, setReportPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = useMemo(
    () => (appToken ? { Authorization: `Bearer ${appToken}` } : {}),
    [appToken],
  );

  async function signInAndVerify() {
    setLoading(true);
    setMessage('');

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Set Supabase URL and anon key first.');
      }

      const session = await requestSupabasePasswordSignIn(
        supabaseUrl,
        supabaseAnonKey,
        email,
        password,
      );

      const verify = await apiRequest<VerifyResponse>(
        normalizeBaseUrl(apiBaseUrl),
        '/auth/supabase/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            supabaseAccessToken: session.access_token,
          }),
        },
      );

      setAppToken(verify.accessToken);
      setSignedInEmail(verify.user.email);
      setMessage(`Authenticated as ${verify.user.email}`);
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    setAppToken('');
    setSignedInEmail('');
    setMessage('Session cleared on device.');
  }

  async function startRecording() {
    setMessage('');
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
      setRecordingUri('');
      setRecording(created.recording);
      setMessage('Recording started. Tap stop when done.');
    } catch (error) {
      setMessage(errorToMessage(error));
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    setLoading(true);
    setMessage('');

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

      setRecordingUri(uri);
      setRecordedAudioBase64(base64);
      setMessage('Recording ready for parsing.');
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function parseVoice() {
    setLoading(true);
    setMessage('');

    try {
      if (!appToken) {
        throw new Error('Sign in first.');
      }
      if (!recordedAudioBase64) {
        throw new Error('Record voice input first.');
      }

      const startedAt = Date.now();
      const result = await apiRequest<VoiceParseResult>(
        normalizeBaseUrl(apiBaseUrl),
        '/expenses/voice/parse',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            audioBase64: recordedAudioBase64,
            locale: 'ms-MY',
          }),
        },
      );

      setVoiceParse(result);
      setVoiceParseLatencyMs(Date.now() - startedAt);
      setMessage('Voice parsed. Review and confirm.');
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function confirmVoice() {
    if (!voiceParse) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await apiRequest(normalizeBaseUrl(apiBaseUrl), '/expenses/confirm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...voiceParse.candidate,
          transactionAt: new Date().toISOString(),
          confidence: 0.82,
          rawPayload: {
            transcript: voiceParse.transcript,
            sttConfidence: voiceParse.sttConfidence,
            parseLatencyMs: voiceParseLatencyMs,
          },
        }),
      });
      setMessage('Voice expense saved.');
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function chooseReceipt(fromCamera: boolean) {
    setMessage('');
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

      setSelectedReceiptUri(picked.uri);
      setSelectedReceiptBase64(picked.base64);
      setReceiptParse(null);
      setMessage('Receipt image selected.');
    } catch (error) {
      setMessage(errorToMessage(error));
    }
  }

  async function parseReceipt() {
    setLoading(true);
    setMessage('');

    try {
      if (!appToken) {
        throw new Error('Sign in first.');
      }
      if (!selectedReceiptBase64) {
        throw new Error('Select or capture a receipt first.');
      }

      const startedAt = Date.now();
      const result = await apiRequest<ReceiptParseResult>(
        normalizeBaseUrl(apiBaseUrl),
        '/receipts/parse',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            imageBase64: selectedReceiptBase64,
          }),
        },
      );
      setReceiptParse(result);
      setReceiptParseLatencyMs(Date.now() - startedAt);
      setMessage('Receipt parsed. Review and confirm.');
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReceipt() {
    if (!receiptParse) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await apiRequest(normalizeBaseUrl(apiBaseUrl), '/expenses/confirm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          source: 'RECEIPT',
          currency: receiptParse.candidate.currency,
          transactionAt: new Date().toISOString(),
          merchantText: receiptParse.candidate.merchantText,
          totalAmount: receiptParse.candidate.totalAmount,
          lineItems: receiptParse.candidate.lineItems,
          rawPayload: {
            parseLatencyMs: receiptParseLatencyMs,
          },
          receipt: {
            sourceFileUrl: 'https://clarifi.local/receipt-upload.jpg',
            mimeType: 'image/jpeg',
            parsedPayload: receiptParse.candidate,
            ocrRaw: {
              ...receiptParse.rawPayload,
              localReceiptUri: selectedReceiptUri || null,
            },
            confidence: 0.8,
          },
        }),
      });
      setMessage('Receipt expense saved.');
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger() {
    setLoading(true);
    setMessage('');

    try {
      const result = await apiRequest<{ total: number; items: unknown[] }>(
        normalizeBaseUrl(apiBaseUrl),
        '/expenses',
        {
          method: 'GET',
          headers: authHeaders,
        },
      );
      setLedgerPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadReport() {
    setLoading(true);
    setMessage('');

    try {
      const now = new Date();
      const result = await apiRequest(
        normalizeBaseUrl(apiBaseUrl),
        `/reports/monthly?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
        {
          method: 'GET',
          headers: authHeaders,
        },
      );
      setReportPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      setMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ClariFi Phase 1 Demo</Text>

        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          autoCapitalize="none"
        />

        <Text style={styles.sectionTitle}>1) Supabase Sign-In + App Verify</Text>
        <TextInput
          style={styles.input}
          value={supabaseUrl}
          onChangeText={setSupabaseUrl}
          autoCapitalize="none"
          placeholder="Supabase URL"
        />
        <TextInput
          style={styles.input}
          value={supabaseAnonKey}
          onChangeText={setSupabaseAnonKey}
          autoCapitalize="none"
          placeholder="Supabase anon key"
        />
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
        <View style={styles.row}>
          <Button title="Sign In + Verify" onPress={signInAndVerify} />
          <Button title="Clear Session" onPress={resetSession} />
        </View>
        <Text style={styles.meta}>
          Signed in: {signedInEmail || 'No'} | App token: {masked(appToken)}
        </Text>

        <Text style={styles.sectionTitle}>2) Voice Parse + Confirm</Text>
        <View style={styles.row}>
          <Button title="Start Recording" onPress={startRecording} />
          <Button title="Stop Recording" onPress={stopRecording} />
        </View>
        <Text style={styles.meta}>
          Recording file: {recordingUri ? 'Ready' : 'Not recorded'}
        </Text>
        <View style={styles.row}>
          <Button title="Parse Voice" onPress={parseVoice} />
          <Button title="Confirm Voice" onPress={confirmVoice} />
        </View>
        <Text style={styles.meta}>
          Parse latency: {voiceParseLatencyMs == null ? '-' : `${voiceParseLatencyMs} ms`}
        </Text>
        {voiceParse ? (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Voice Parse</Text>
            <Text style={styles.preview}>{JSON.stringify(voiceParse, null, 2)}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>3) Receipt Parse + Confirm</Text>
        <View style={styles.row}>
          <Button title="Camera" onPress={() => chooseReceipt(true)} />
          <Button title="Gallery" onPress={() => chooseReceipt(false)} />
        </View>
        <Text style={styles.meta}>
          Receipt image: {selectedReceiptUri ? 'Ready' : 'Not selected'}
        </Text>
        <View style={styles.row}>
          <Button title="Parse Receipt" onPress={parseReceipt} />
          <Button title="Confirm Receipt" onPress={confirmReceipt} />
        </View>
        <Text style={styles.meta}>
          Parse latency:{' '}
          {receiptParseLatencyMs == null ? '-' : `${receiptParseLatencyMs} ms`}
        </Text>
        {receiptParse ? (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Receipt Parse</Text>
            <Text style={styles.preview}>
              {JSON.stringify(receiptParse, null, 2)}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>4) Ledger & Report</Text>
        <View style={styles.row}>
          <Button title="Load Ledger" onPress={loadLedger} />
          <Button title="Load Monthly Report" onPress={loadReport} />
        </View>

        {loading ? <ActivityIndicator style={styles.loader} /> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {ledgerPreview ? (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Ledger Response</Text>
            <Text style={styles.preview}>{ledgerPreview}</Text>
          </View>
        ) : null}

        {reportPreview ? (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>Report Response</Text>
            <Text style={styles.preview}>{reportPreview}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: {
    fontSize: 12,
    color: '#334155',
  },
  loader: {
    marginTop: 12,
  },
  message: {
    fontSize: 14,
    color: '#0f172a',
  },
  previewContainer: {
    marginTop: 8,
    borderRadius: 8,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 10,
    backgroundColor: '#f1f5f9',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  preview: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
});
