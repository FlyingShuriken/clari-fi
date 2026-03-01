import { StatusBar } from 'expo-status-bar';
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
import { apiRequest, type VerifyResponse } from './src/api';

interface VoiceParseResult {
  transcript: string;
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

const defaultVoiceText = 'Spent RM 5 at pasar to buy fish, paid with TNG';
const defaultReceiptText =
  'PASAR PAGI\nFish RM 5.00\nVegetable RM 3.50\nTOTAL RM 8.50';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3000/v1');
  const [supabaseToken, setSupabaseToken] = useState('');
  const [appToken, setAppToken] = useState('');
  const [voiceText, setVoiceText] = useState(defaultVoiceText);
  const [receiptText, setReceiptText] = useState(defaultReceiptText);
  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null);
  const [receiptParse, setReceiptParse] = useState<ReceiptParseResult | null>(null);
  const [ledgerPreview, setLedgerPreview] = useState<string>('');
  const [reportPreview, setReportPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${appToken}` }),
    [appToken],
  );

  async function verifySupabase() {
    setLoading(true);
    setMessage('');

    try {
      const result = await apiRequest<VerifyResponse>(
        apiBaseUrl,
        '/auth/supabase/verify',
        {
          method: 'POST',
          body: JSON.stringify({ supabaseAccessToken: supabaseToken }),
        },
      );

      setAppToken(result.accessToken);
      setMessage(`Authenticated as ${result.user.email}`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function parseVoice() {
    setLoading(true);
    setMessage('');

    try {
      const result = await apiRequest<VoiceParseResult>(
        apiBaseUrl,
        '/expenses/voice/parse',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ text: voiceText }),
        },
      );
      setVoiceParse(result);
      setMessage('Voice parsed. Review and confirm.');
    } catch (error) {
      setMessage(String(error));
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
      await apiRequest(apiBaseUrl, '/expenses/confirm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...voiceParse.candidate,
          transactionAt: new Date().toISOString(),
          confidence: 0.82,
        }),
      });
      setMessage('Voice expense saved.');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function parseReceipt() {
    setLoading(true);
    setMessage('');

    try {
      const result = await apiRequest<ReceiptParseResult>(
        apiBaseUrl,
        '/receipts/parse',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ mockText: receiptText }),
        },
      );
      setReceiptParse(result);
      setMessage('Receipt parsed. Review and confirm.');
    } catch (error) {
      setMessage(String(error));
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
      await apiRequest(apiBaseUrl, '/expenses/confirm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          source: 'RECEIPT',
          currency: receiptParse.candidate.currency,
          transactionAt: new Date().toISOString(),
          merchantText: receiptParse.candidate.merchantText,
          totalAmount: receiptParse.candidate.totalAmount,
          lineItems: receiptParse.candidate.lineItems,
          receipt: {
            sourceFileUrl: 'https://example.com/mock-receipt.jpg',
            mimeType: 'image/jpeg',
            parsedPayload: receiptParse.candidate,
            ocrRaw: receiptParse.rawPayload,
            confidence: 0.8,
          },
        }),
      });
      setMessage('Receipt expense saved.');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger() {
    setLoading(true);
    setMessage('');

    try {
      const result = await apiRequest<{ total: number; items: unknown[] }>(
        apiBaseUrl,
        '/expenses',
        {
          method: 'GET',
          headers: authHeaders,
        },
      );
      setLedgerPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      setMessage(String(error));
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
        apiBaseUrl,
        `/reports/monthly?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
        {
          method: 'GET',
          headers: authHeaders,
        },
      );
      setReportPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      setMessage(String(error));
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

        <Text style={styles.sectionTitle}>1) Auth via Supabase token</Text>
        <TextInput
          style={styles.input}
          value={supabaseToken}
          onChangeText={setSupabaseToken}
          autoCapitalize="none"
          placeholder="Paste Supabase access token"
        />
        <Button title="Verify Token" onPress={verifySupabase} />

        <Text style={styles.sectionTitle}>2) Voice Parse + Confirm</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={voiceText}
          onChangeText={setVoiceText}
          multiline
        />
        <View style={styles.row}>
          <Button title="Parse Voice" onPress={parseVoice} />
          <Button title="Confirm Voice" onPress={confirmVoice} />
        </View>

        <Text style={styles.sectionTitle}>3) Receipt Parse + Confirm</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={receiptText}
          onChangeText={setReceiptText}
          multiline
        />
        <View style={styles.row}>
          <Button title="Parse Receipt" onPress={parseReceipt} />
          <Button title="Confirm Receipt" onPress={confirmReceipt} />
        </View>

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
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
