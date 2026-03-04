import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AuthSection } from "./src/features/auth/AuthSection";
import { ClerkEmailSignInSection } from "./src/features/auth/ClerkEmailSignInSection";
import { ReceiptCaptureSection } from "./src/features/capture/ReceiptCaptureSection";
import {
  speechRecognitionService,
  type RecognitionState,
} from "./src/features/capture/speech-recognition.service";
import { VoiceCaptureSection } from "./src/features/capture/VoiceCaptureSection";
import { InsightsSection } from "./src/features/insights/InsightsSection";
import { PriceIntelligenceSection } from "./src/features/prices/PriceIntelligenceSection";
import {
  confirmExpense,
  listExpenses,
  loadPriceCompare,
  loadPriceHistory,
  loadMonthlyReport,
  parseReceipt,
  parseVoice,
  runPriceBackfill,
  uploadArtifact,
  verifyClerkSessionToken,
} from "./src/shared/api";
import type { ReceiptParseResult, VoiceParseResult } from "./src/shared/types";

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const defaultApiBaseUrl =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ?? "").trim() ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "http://localhost:3000/v1";
const publishableKey =
  String(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  ).trim() || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const onDeviceSttEnabled =
  String(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
      process.env.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
      "true",
  )
    .trim()
    .toLowerCase() !== "false";
const defaultSttLocale = "en-SG";

function AuthGate() {
  const [message, setMessage] = useState("");

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
  const [backendUserId, setBackendUserId] = useState("");

  const [transcriptInput, setTranscriptInput] = useState("");
  const [recognitionState, setRecognitionState] =
    useState<RecognitionState>("idle");
  const [recognizerAvailable, setRecognizerAvailable] = useState<
    boolean | null
  >(null);

  const [selectedReceiptUri, setSelectedReceiptUri] = useState("");
  const [selectedReceiptBase64, setSelectedReceiptBase64] = useState("");
  const [selectedReceiptMimeType, setSelectedReceiptMimeType] =
    useState("image/jpeg");
  const [selectedReceiptFileRef, setSelectedReceiptFileRef] = useState("");

  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null);
  const [receiptParse, setReceiptParse] = useState<ReceiptParseResult | null>(
    null,
  );
  const [voiceParseLatencyMs, setVoiceParseLatencyMs] = useState<number | null>(
    null,
  );
  const [receiptParseLatencyMs, setReceiptParseLatencyMs] = useState<
    number | null
  >(null);
  const [priceQueryItem, setPriceQueryItem] = useState("watermelon");
  const [priceQueryArea, setPriceQueryArea] = useState("");
  const [priceQueryLat, setPriceQueryLat] = useState("5.9804");
  const [priceQueryLng, setPriceQueryLng] = useState("116.0735");
  const [priceQueryRadiusKm, setPriceQueryRadiusKm] = useState("10");
  const [priceHistoryInterval, setPriceHistoryInterval] = useState<"day" | "week">(
    "day",
  );
  const [priceComparePreview, setPriceComparePreview] = useState("");
  const [priceHistoryPreview, setPriceHistoryPreview] = useState("");
  const [priceBackfillPreview, setPriceBackfillPreview] = useState("");
  const [ledgerPreview, setLedgerPreview] = useState("");
  const [reportPreview, setReportPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const { getToken, signOut } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    let mounted = true;

    speechRecognitionService.configure({
      onStart: () => {
        setRecognitionState("listening");
      },
      onEnd: () => {
        setRecognitionState((previousState) =>
          previousState === "listening" ? "processing" : previousState,
        );
      },
      onPartialResults: (transcript) => {
        if (transcript) {
          setTranscriptInput(transcript);
        }
      },
      onFinalResults: (transcript) => {
        if (!transcript.trim()) {
          setRecognitionState("error");
          onMessage(
            "No speech recognized. Please try again or use keyboard dictation.",
          );
          return;
        }

        setTranscriptInput(transcript);
        setRecognitionState("ready");
        onMessage("Speech recognized on device. You can parse now.");
      },
      onError: (errorMessage) => {
        setRecognitionState("error");
        onMessage(errorMessage);
      },
    });

    void speechRecognitionService
      .isAvailable()
      .then((available) => {
        if (!mounted) {
          return;
        }
        setRecognizerAvailable(available);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setRecognizerAvailable(false);
      });

    return () => {
      mounted = false;
      void speechRecognitionService.destroy();
    };
  }, [onMessage]);

  async function getBearerTokenOrThrow(): Promise<string> {
    const token = await getToken();
    if (!token) {
      throw new Error(
        "No Clerk session token available. Please sign in again.",
      );
    }

    return token;
  }

  async function handleSyncBackendUser() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await verifyClerkSessionToken(
        normalizeBaseUrl(apiBaseUrl),
        token,
      );
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
    onMessage("");

    try {
      await signOut();
      setBackendUserId("");
      onMessage("Signed out.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function startListening() {
    onMessage("");

    try {
      if (!onDeviceSttEnabled) {
        throw new Error(
          "On-device STT is disabled. Enable EXPO_PUBLIC_STT_ON_DEVICE_ENABLED to use microphone STT.",
        );
      }

      if (recognitionState === "listening") {
        return;
      }

      const available = await speechRecognitionService.isAvailable();
      setRecognizerAvailable(available);
      if (!available) {
        throw new Error(
          "Speech recognition is unavailable on this device. Use keyboard dictation as fallback.",
        );
      }

      setVoiceParse(null);
      setVoiceParseLatencyMs(null);
      setTranscriptInput("");
      setRecognitionState("processing");

      await speechRecognitionService.start(defaultSttLocale);
      onMessage("Listening... speak now, then tap stop.");
    } catch (error) {
      setRecognitionState("error");
      onMessage(errorToMessage(error));
    }
  }

  async function stopListening() {
    if (recognitionState !== "listening" && recognitionState !== "processing") {
      return;
    }

    onMessage("");

    try {
      setRecognitionState("processing");
      await speechRecognitionService.stop();
      onMessage("Processing speech...");
    } catch (error) {
      setRecognitionState("error");
      onMessage(errorToMessage(error));
    }
  }

  async function handleParseVoice() {
    setLoading(true);
    onMessage("");

    try {
      if (
        recognitionState === "listening" ||
        recognitionState === "processing"
      ) {
        throw new Error("Stop listening first before parsing.");
      }

      if (!transcriptInput.trim()) {
        throw new Error(
          "Provide transcript first (on-device STT or keyboard dictation).",
        );
      }

      const token = await getBearerTokenOrThrow();
      const startedAt = Date.now();
      const result = await parseVoice(normalizeBaseUrl(apiBaseUrl), token, {
        transcript: transcriptInput.trim(),
        locale: defaultSttLocale,
        deviceConfidence: 0.96,
      });

      setVoiceParse(result);
      setRecognitionState("ready");
      setVoiceParseLatencyMs(Date.now() - startedAt);
      onMessage(
        `Voice parsed via ${result.parseMeta.parsePath}. Review and confirm.`,
      );
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
    onMessage("");

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
        },
      });
      onMessage("Voice expense saved.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function chooseReceipt(fromCamera: boolean) {
    onMessage("");

    try {
      if (fromCamera) {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          throw new Error("Camera permission denied.");
        }
      } else {
        const mediaPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!mediaPermission.granted) {
          throw new Error("Photo library permission denied.");
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
        throw new Error("Could not read image as base64.");
      }

      const mimeType = picked.mimeType ?? "image/jpeg";
      setSelectedReceiptUri(picked.uri);
      setSelectedReceiptBase64(picked.base64);
      setSelectedReceiptMimeType(mimeType);
      setSelectedReceiptFileRef("");
      setReceiptParse(null);

      const token = await getBearerTokenOrThrow();
      const uploaded = await uploadArtifact(
        normalizeBaseUrl(apiBaseUrl),
        token,
        {
          kind: "receipt",
          mimeType,
          fileBase64: picked.base64,
        },
      );
      setSelectedReceiptFileRef(uploaded.fileRef);

      onMessage("Receipt image selected and uploaded.");
    } catch (error) {
      onMessage(errorToMessage(error));
    }
  }

  async function handleParseReceipt() {
    setLoading(true);
    onMessage("");

    try {
      if (!selectedReceiptBase64 && !selectedReceiptFileRef) {
        throw new Error("Select a receipt first.");
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
      onMessage("Receipt parsed. Review and confirm.");
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
    onMessage("");

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
            selectedReceiptFileRef ||
            receiptParse.fileRef ||
            "local://receipt-not-uploaded",
          mimeType: selectedReceiptMimeType,
          parsedPayload: receiptParse.candidate,
          ocrRaw: receiptParse.rawPayload,
          confidence: 0.8,
        },
      });
      onMessage("Receipt expense saved.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadLedger() {
    setLoading(true);
    onMessage("");

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
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await loadMonthlyReport(
        normalizeBaseUrl(apiBaseUrl),
        token,
      );
      setReportPreview(JSON.stringify(result, null, 2));
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPriceCompare() {
    setLoading(true);
    onMessage("");

    try {
      if (!priceQueryItem.trim()) {
        throw new Error("Enter an item name first.");
      }

      const token = await getBearerTokenOrThrow();
      const lat = parseNumberInput(priceQueryLat);
      const lng = parseNumberInput(priceQueryLng);
      const radiusKm = parseNumberInput(priceQueryRadiusKm);
      const result = await loadPriceCompare(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        area: priceQueryArea.trim() || undefined,
        lat,
        lng,
        radiusKm,
        limit: 10,
      });

      setPriceComparePreview(JSON.stringify(result, null, 2));
      onMessage("Loaded price comparison.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPriceHistory() {
    setLoading(true);
    onMessage("");

    try {
      if (!priceQueryItem.trim()) {
        throw new Error("Enter an item name first.");
      }

      const token = await getBearerTokenOrThrow();
      const result = await loadPriceHistory(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        area: priceQueryArea.trim() || undefined,
        interval: priceHistoryInterval,
      });
      setPriceHistoryPreview(JSON.stringify(result, null, 2));
      onMessage("Loaded price history.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleBackfillPrices() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await runPriceBackfill(normalizeBaseUrl(apiBaseUrl), token, {
        scope: "user",
        dryRun: false,
      });
      setPriceBackfillPreview(JSON.stringify(result, null, 2));
      onMessage("Backfill completed for current user scope.");
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
        signedInEmail={
          user?.primaryEmailAddress?.emailAddress ??
          user?.emailAddresses[0]?.emailAddress ??
          "-"
        }
        backendUserId={backendUserId}
        onSyncBackendUser={handleSyncBackendUser}
        onSignOut={handleSignOut}
      />

      <VoiceCaptureSection
        transcript={transcriptInput}
        onTranscriptChange={setTranscriptInput}
        recognitionState={recognitionState}
        recognizerAvailable={recognizerAvailable}
        parseLatencyMs={voiceParseLatencyMs}
        parseResult={voiceParse}
        onStartListening={startListening}
        onStopListening={stopListening}
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

      <PriceIntelligenceSection
        itemQuery={priceQueryItem}
        onItemQueryChange={setPriceQueryItem}
        areaQuery={priceQueryArea}
        onAreaQueryChange={setPriceQueryArea}
        latInput={priceQueryLat}
        onLatInputChange={setPriceQueryLat}
        lngInput={priceQueryLng}
        onLngInputChange={setPriceQueryLng}
        radiusKmInput={priceQueryRadiusKm}
        onRadiusKmInputChange={setPriceQueryRadiusKm}
        interval={priceHistoryInterval}
        onIntervalChange={setPriceHistoryInterval}
        comparePreview={priceComparePreview}
        historyPreview={priceHistoryPreview}
        backfillPreview={priceBackfillPreview}
        onLoadCompare={handleLoadPriceCompare}
        onLoadHistory={handleLoadPriceHistory}
        onRunBackfill={handleBackfillPrices}
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
    backgroundColor: "#f8fafc",
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
    fontWeight: "700",
  },
  loader: {
    marginTop: 12,
  },
  message: {
    fontSize: 14,
    color: "#0f172a",
  },
});
