import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import { PriceAlertsSection } from "./src/features/prices/PriceAlertsSection";
import { PriceIntelligenceSection } from "./src/features/prices/PriceIntelligenceSection";
import { PromoIngestionSection } from "./src/features/prices/PromoIngestionSection";
import {
  checkPriceAlerts,
  confirmExpense,
  createPriceAlert,
  ingestPromo,
  listAlertEvents,
  listExpenses,
  listPriceAlerts,
  listPromos,
  loadMonthlyReport,
  loadPriceCompare,
  loadPriceHistory,
  markAllAlertEventsRead,
  parseReceipt,
  parseVoice,
  registerPushDevice,
  revokePushDevice,
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

function normalizePushRegistrationError(error: unknown): string {
  const message = errorToMessage(error);
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("aps-environment")) {
    return "Unavailable: iOS build missing APNs entitlement (aps-environment). Rebuild iOS dev client with push capability.";
  }

  if (lower.includes("projectid")) {
    return "Unavailable: missing Expo projectId for push token. Link EAS project and rebuild dev client.";
  }

  return `Registration failed: ${normalized}`;
}

function getExpoProjectId(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const eas = (extra.eas ?? {}) as Record<string, unknown>;
  if (typeof eas.projectId === "string" && eas.projectId.trim()) {
    return eas.projectId.trim();
  }

  const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
  if (typeof easConfig?.projectId === "string" && easConfig.projectId.trim()) {
    return easConfig.projectId.trim();
  }

  return undefined;
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AuthGate() {
  const [message, setMessage] = useState("");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ClariFi Phase 2C</Text>

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

async function pickImageAsset(fromCamera: boolean): Promise<ImagePicker.ImagePickerAsset | null> {
  if (fromCamera) {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      throw new Error("Camera permission denied.");
    }
  } else {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    return null;
  }

  return result.assets[0];
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

  const [promoUri, setPromoUri] = useState("");
  const [promoBase64, setPromoBase64] = useState("");
  const [promoMimeType, setPromoMimeType] = useState("image/jpeg");
  const [promoFileRef, setPromoFileRef] = useState("");
  const [promoMerchantHint, setPromoMerchantHint] = useState("");
  const [promoAreaHint, setPromoAreaHint] = useState("");

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
  const [includePromo, setIncludePromo] = useState(true);
  const [priceComparePreview, setPriceComparePreview] = useState("");
  const [priceHistoryPreview, setPriceHistoryPreview] = useState("");
  const [priceBackfillPreview, setPriceBackfillPreview] = useState("");

  const [alertItem, setAlertItem] = useState("watermelon");
  const [alertTargetUnitPrice, setAlertTargetUnitPrice] = useState("5");
  const [alertRadiusKm, setAlertRadiusKm] = useState("10");
  const [alertAreaText, setAlertAreaText] = useState("Kota Kinabalu");
  const [alertLat, setAlertLat] = useState("5.9804");
  const [alertLng, setAlertLng] = useState("116.0735");
  const [alertsPreview, setAlertsPreview] = useState("");
  const [alertEventsPreview, setAlertEventsPreview] = useState("");
  const [alertCheckPreview, setAlertCheckPreview] = useState("");
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);

  const [promoIngestPreview, setPromoIngestPreview] = useState("");
  const [promoListPreview, setPromoListPreview] = useState("");
  const [pushStatus, setPushStatus] = useState("Not registered");
  const [pushToken, setPushToken] = useState("");

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
      throw new Error("No Clerk session token available. Please sign in again.");
    }

    return token;
  }

  async function ensurePushDeviceRegistration() {
    try {
      const existingPermission = await Notifications.getPermissionsAsync();
      const finalPermission =
        existingPermission.granted || existingPermission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
          ? existingPermission
          : await Notifications.requestPermissionsAsync();

      if (!finalPermission.granted) {
        setPushStatus("Permission denied");
        return;
      }

      const projectId = getExpoProjectId();
      const expoTokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const expoPushToken = expoTokenResult.data;

      const bearerToken = await getBearerTokenOrThrow();
      await registerPushDevice(normalizeBaseUrl(apiBaseUrl), bearerToken, {
        expoPushToken,
        platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
        appVersion: String(Constants.expoConfig?.version ?? "0.1.0"),
      });

      setPushToken(expoPushToken);
      setPushStatus("Registered");
    } catch (error) {
      setPushStatus(normalizePushRegistrationError(error));
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setPushStatus("Not registered");
      setPushToken("");
      return;
    }

    void ensurePushDeviceRegistration();
  }, [apiBaseUrl, user?.id]);

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
      if (pushToken) {
        try {
          const token = await getBearerTokenOrThrow();
          await revokePushDevice(normalizeBaseUrl(apiBaseUrl), token, pushToken);
        } catch {
          // Best effort cleanup; continue sign-out even if revoke fails.
        }
      }
      await signOut();
      setBackendUserId("");
      setPushToken("");
      setPushStatus("Not registered");
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
      const picked = await pickImageAsset(fromCamera);
      if (!picked) {
        return;
      }
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
      const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
        kind: "receipt",
        mimeType,
        fileBase64: picked.base64,
      });
      setSelectedReceiptFileRef(uploaded.fileRef);

      onMessage("Receipt image selected and uploaded.");
    } catch (error) {
      onMessage(errorToMessage(error));
    }
  }

  async function choosePromo(fromCamera: boolean) {
    onMessage("");

    try {
      const picked = await pickImageAsset(fromCamera);
      if (!picked) {
        return;
      }
      if (!picked.base64) {
        throw new Error("Could not read promo image as base64.");
      }

      const mimeType = picked.mimeType ?? "image/jpeg";
      setPromoUri(picked.uri);
      setPromoBase64(picked.base64);
      setPromoMimeType(mimeType);
      setPromoFileRef("");

      const token = await getBearerTokenOrThrow();
      const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
        kind: "receipt",
        mimeType,
        fileBase64: picked.base64,
      });
      setPromoFileRef(uploaded.fileRef);

      onMessage("Promo image selected and uploaded.");
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
      const result = await loadMonthlyReport(normalizeBaseUrl(apiBaseUrl), token);
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
      const result = await loadPriceCompare(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        area: priceQueryArea.trim() || undefined,
        lat: parseNumberInput(priceQueryLat),
        lng: parseNumberInput(priceQueryLng),
        radiusKm: parseNumberInput(priceQueryRadiusKm),
        limit: 10,
        includePromo,
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
        includePromo,
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

  async function handleCreateAlert() {
    setLoading(true);
    onMessage("");

    try {
      const targetUnitPrice = parseNumberInput(alertTargetUnitPrice);
      if (!alertItem.trim() || typeof targetUnitPrice !== "number") {
        throw new Error("Provide alert item and valid target unit price.");
      }

      const token = await getBearerTokenOrThrow();
      const result = await createPriceAlert(normalizeBaseUrl(apiBaseUrl), token, {
        item: alertItem.trim(),
        targetUnitPrice,
        radiusKm: parseNumberInput(alertRadiusKm),
        areaText: alertAreaText.trim() || undefined,
      });
      setAlertsPreview(JSON.stringify(result, null, 2));
      onMessage("Price alert created.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadAlerts() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await listPriceAlerts(normalizeBaseUrl(apiBaseUrl), token);
      setAlertsPreview(JSON.stringify(result, null, 2));
      onMessage("Loaded alerts.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckAlerts() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await checkPriceAlerts(normalizeBaseUrl(apiBaseUrl), token, {
        lat: parseNumberInput(alertLat),
        lng: parseNumberInput(alertLng),
        areaText: alertAreaText.trim() || undefined,
        includePromo,
        limit: 50,
      });
      setAlertCheckPreview(JSON.stringify(result, null, 2));
      onMessage("Checked nearby alert triggers.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadAlertEvents() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await listAlertEvents(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 20,
        unreadOnly: false,
      });
      setAlertEventsPreview(JSON.stringify(result, null, 2));
      setAlertUnreadCount(result.items.filter((item) => item.readAt === null).length);
      onMessage("Loaded alert events.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllAlertEventsRead() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      await markAllAlertEventsRead(normalizeBaseUrl(apiBaseUrl), token);
      const refreshed = await listAlertEvents(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 20,
        unreadOnly: false,
      });
      setAlertEventsPreview(JSON.stringify(refreshed, null, 2));
      setAlertUnreadCount(refreshed.items.filter((item) => item.readAt === null).length);
      onMessage("Marked all alert events as read.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleIngestPromo() {
    setLoading(true);
    onMessage("");

    try {
      if (!promoFileRef) {
        throw new Error("Upload a promo image first.");
      }

      const token = await getBearerTokenOrThrow();
      const result = await ingestPromo(normalizeBaseUrl(apiBaseUrl), token, {
        fileRef: promoFileRef,
        mimeType: promoMimeType,
        merchantText: promoMerchantHint.trim() || undefined,
        areaText: promoAreaHint.trim() || undefined,
        autoApprove: false,
      });
      setPromoIngestPreview(JSON.stringify(result, null, 2));
      onMessage("Promo ingestion completed.");
    } catch (error) {
      onMessage(errorToMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPromos() {
    setLoading(true);
    onMessage("");

    try {
      const token = await getBearerTokenOrThrow();
      const result = await listPromos(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 10,
      });
      setPromoListPreview(JSON.stringify(result, null, 2));
      onMessage("Loaded promo ingestions.");
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
        pushStatus={pushStatus}
        pushTokenPreview={
          pushToken ? `${pushToken.slice(0, 18)}...${pushToken.slice(-6)}` : "-"
        }
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
        includePromo={includePromo}
        onToggleIncludePromo={() => setIncludePromo((previous) => !previous)}
        comparePreview={priceComparePreview}
        historyPreview={priceHistoryPreview}
        backfillPreview={priceBackfillPreview}
        onLoadCompare={handleLoadPriceCompare}
        onLoadHistory={handleLoadPriceHistory}
        onRunBackfill={handleBackfillPrices}
      />

      <PriceAlertsSection
        item={alertItem}
        onItemChange={setAlertItem}
        targetUnitPrice={alertTargetUnitPrice}
        onTargetUnitPriceChange={setAlertTargetUnitPrice}
        radiusKm={alertRadiusKm}
        onRadiusKmChange={setAlertRadiusKm}
        areaText={alertAreaText}
        onAreaTextChange={setAlertAreaText}
        lat={alertLat}
        onLatChange={setAlertLat}
        lng={alertLng}
        onLngChange={setAlertLng}
        alertsPreview={alertsPreview}
        eventsPreview={alertEventsPreview}
        checkPreview={alertCheckPreview}
        unreadCount={alertUnreadCount}
        onCreateAlert={handleCreateAlert}
        onLoadAlerts={handleLoadAlerts}
        onCheckAlerts={handleCheckAlerts}
        onLoadEvents={handleLoadAlertEvents}
        onMarkAllRead={handleMarkAllAlertEventsRead}
      />

      <PromoIngestionSection
        promoReady={Boolean(promoBase64 || promoUri)}
        promoFileRef={promoFileRef}
        merchantText={promoMerchantHint}
        onMerchantTextChange={setPromoMerchantHint}
        areaText={promoAreaHint}
        onAreaTextChange={setPromoAreaHint}
        promoIngestPreview={promoIngestPreview}
        promoListPreview={promoListPreview}
        onPickPromoCamera={() => choosePromo(true)}
        onPickPromoGallery={() => choosePromo(false)}
        onIngestPromo={handleIngestPromo}
        onLoadPromos={handleLoadPromos}
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
