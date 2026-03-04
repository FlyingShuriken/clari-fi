import { useAuth, useUser } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { speechRecognitionService, type RecognitionState } from '../../features/capture/speech-recognition.service';
import {
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
  uploadArtifact,
  verifyClerkSessionToken,
} from '../../shared/api';
import type {
  AlertEvent,
  PriceAlert,
  PriceCompareResponse,
  PriceHistoryResponse,
  PromoIngestionItem,
  ReceiptParseResult,
  VoiceParseResult,
} from '../../shared/types';

const defaultApiBaseUrl =
  String(Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ?? '').trim() ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:3000/v1';

const defaultSttLocale = 'en-SG';
const onDeviceSttEnabled =
  String(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
      process.env.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
      'true',
  )
    .trim()
    .toLowerCase() !== 'false';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getExpoProjectId(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const eas = (extra.eas ?? {}) as Record<string, unknown>;
  if (typeof eas.projectId === 'string' && eas.projectId.trim()) {
    return eas.projectId.trim();
  }

  const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
  if (typeof easConfig?.projectId === 'string' && easConfig.projectId.trim()) {
    return easConfig.projectId.trim();
  }

  return undefined;
}

function normalizePushRegistrationError(error: unknown): string {
  const message = errorToMessage(error).trim();
  const lower = message.toLowerCase();

  if (lower.includes('aps-environment')) {
    return 'Unavailable: iOS build missing APNs entitlement (aps-environment). Rebuild iOS dev client with push capability.';
  }

  if (lower.includes('projectid')) {
    return 'Unavailable: missing Expo projectId for push token. Link EAS project and rebuild dev client.';
  }

  return `Registration failed: ${message}`;
}

async function pickImageAsset(fromCamera: boolean): Promise<ImagePicker.ImagePickerAsset | null> {
  if (fromCamera) {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      throw new Error('Camera permission denied.');
    }
  } else {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    return null;
  }

  return result.assets[0];
}

export interface LedgerLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice: number;
}

export interface LedgerExpense {
  id: string;
  merchant: string;
  transactionAt: string;
  currency: string;
  totalAmount: number;
  paymentMethod: string;
  areaText?: string;
  note?: string;
  lineItems: LedgerLineItem[];
}

export interface ReportSummary {
  year: number;
  month: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  categoryBreakdown: Array<{ category: string; amount: number }>;
  insights: string[];
}

function mapLedgerItems(rawItems: unknown[]): LedgerExpense[] {
  return rawItems.map((item) => {
    const value = (item ?? {}) as Record<string, unknown>;
    const lineItemsRaw = Array.isArray(value.lineItems) ? value.lineItems : [];

    const lineItems = lineItemsRaw.map((lineItem) => {
      const line = (lineItem ?? {}) as Record<string, unknown>;
      return {
        description: getString(line.descriptionRaw, 'Unknown item'),
        quantity: toNumber(line.quantity) || undefined,
        unit: getString(line.unitRaw) || undefined,
        unitPrice: toNumber(line.unitPrice) || undefined,
        totalPrice: toNumber(line.totalPrice),
      } satisfies LedgerLineItem;
    });

    return {
      id: getString(value.id, `${Math.random()}`),
      merchant: getString(value.merchantText, 'Unknown merchant'),
      transactionAt: getString(value.transactionAt, new Date().toISOString()),
      currency: getString(value.currency, 'MYR'),
      totalAmount: toNumber(value.totalAmount),
      paymentMethod: getString(value.paymentMethod, 'N/A'),
      areaText: getString(value.areaText) || undefined,
      note: getString(value.note) || undefined,
      lineItems,
    } satisfies LedgerExpense;
  });
}

function mapReportSummary(raw: Record<string, unknown>): ReportSummary {
  const categoryRaw = (raw.categoryBreakdown ?? {}) as Record<string, unknown>;
  const categoryBreakdown = Object.entries(categoryRaw)
    .map(([category, amount]) => ({
      category,
      amount: toNumber(amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year: Math.trunc(toNumber(raw.year) || new Date().getUTCFullYear()),
    month: Math.trunc(toNumber(raw.month) || new Date().getUTCMonth() + 1),
    cashIn: toNumber(raw.cashIn),
    cashOut: toNumber(raw.cashOut),
    netCashFlow: toNumber(raw.netCashFlow),
    categoryBreakdown,
    insights: Array.isArray(raw.insights)
      ? raw.insights.map((item) => getString(item)).filter(Boolean)
      : [],
  };
}

function formatCurrency(value: number, currencyCode = 'MYR'): string {
  try {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}

export interface ClariFiController {
  apiBaseUrl: string;
  setApiBaseUrl: (value: string) => void;
  message: string;
  clearMessage: () => void;
  loading: boolean;
  signedInEmail: string;
  backendUserId: string;
  pushStatus: string;
  pushTokenPreview: string;

  transcriptInput: string;
  setTranscriptInput: (value: string) => void;
  recognitionState: RecognitionState;
  recognizerAvailable: boolean | null;
  voiceParseLatencyMs: number | null;
  voiceParse: VoiceParseResult | null;

  receiptReady: boolean;
  receiptFileRef: string;
  receiptParseLatencyMs: number | null;
  receiptParse: ReceiptParseResult | null;

  ledgerItems: LedgerExpense[];
  ledgerTotal: number;
  reportSummary: ReportSummary | null;

  priceQueryItem: string;
  setPriceQueryItem: (value: string) => void;
  priceQueryArea: string;
  setPriceQueryArea: (value: string) => void;
  priceQueryLat: string;
  setPriceQueryLat: (value: string) => void;
  priceQueryLng: string;
  setPriceQueryLng: (value: string) => void;
  priceQueryRadiusKm: string;
  setPriceQueryRadiusKm: (value: string) => void;
  priceHistoryInterval: 'day' | 'week';
  setPriceHistoryInterval: (value: 'day' | 'week') => void;
  includePromo: boolean;
  setIncludePromo: (value: boolean) => void;
  priceCompareResult: PriceCompareResponse | null;
  priceHistoryResult: PriceHistoryResponse | null;

  alertItem: string;
  setAlertItem: (value: string) => void;
  alertTargetUnitPrice: string;
  setAlertTargetUnitPrice: (value: string) => void;
  alertRadiusKm: string;
  setAlertRadiusKm: (value: string) => void;
  alertAreaText: string;
  setAlertAreaText: (value: string) => void;
  alerts: PriceAlert[];
  alertEvents: AlertEvent[];
  alertUnreadCount: number;

  promoReady: boolean;
  promoFileRef: string;
  promoMerchantHint: string;
  setPromoMerchantHint: (value: string) => void;
  promoAreaHint: string;
  setPromoAreaHint: (value: string) => void;
  promoIngestionResult:
    | {
        ingestionId: string;
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        created: number;
        skipped: number;
      }
    | null;
  promoItems: PromoIngestionItem[];

  syncBackendUser: () => Promise<void>;
  signOutUser: () => Promise<void>;

  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  parseVoiceExpense: () => Promise<void>;
  confirmVoiceExpense: () => Promise<void>;

  pickReceiptCamera: () => Promise<void>;
  pickReceiptGallery: () => Promise<void>;
  parseReceiptExpense: () => Promise<void>;
  confirmReceiptExpense: () => Promise<void>;

  loadLedger: () => Promise<void>;
  loadReport: () => Promise<void>;

  loadPriceCompareResult: () => Promise<void>;
  loadPriceHistoryResult: () => Promise<void>;

  createAlert: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  loadAlertEvents: () => Promise<void>;
  markAllEventsRead: () => Promise<void>;

  pickPromoCamera: () => Promise<void>;
  pickPromoGallery: () => Promise<void>;
  ingestPromoFile: () => Promise<void>;
  loadPromos: () => Promise<void>;

  formatCurrency: (value: number, currencyCode?: string) => string;
}

function useClariFiControllerValue(): ClariFiController {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();

  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendUserId, setBackendUserId] = useState('');

  const [transcriptInput, setTranscriptInput] = useState('');
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [recognizerAvailable, setRecognizerAvailable] = useState<boolean | null>(null);
  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null);
  const [voiceParseLatencyMs, setVoiceParseLatencyMs] = useState<number | null>(null);

  const [selectedReceiptUri, setSelectedReceiptUri] = useState('');
  const [selectedReceiptBase64, setSelectedReceiptBase64] = useState('');
  const [selectedReceiptMimeType, setSelectedReceiptMimeType] = useState('image/jpeg');
  const [selectedReceiptFileRef, setSelectedReceiptFileRef] = useState('');
  const [receiptParse, setReceiptParse] = useState<ReceiptParseResult | null>(null);
  const [receiptParseLatencyMs, setReceiptParseLatencyMs] = useState<number | null>(null);

  const [priceQueryItem, setPriceQueryItem] = useState('watermelon');
  const [priceQueryArea, setPriceQueryArea] = useState('');
  const [priceQueryLat, setPriceQueryLat] = useState('5.9804');
  const [priceQueryLng, setPriceQueryLng] = useState('116.0735');
  const [priceQueryRadiusKm, setPriceQueryRadiusKm] = useState('10');
  const [priceHistoryInterval, setPriceHistoryInterval] = useState<'day' | 'week'>('day');
  const [includePromo, setIncludePromo] = useState(true);
  const [priceCompareResult, setPriceCompareResult] = useState<PriceCompareResponse | null>(null);
  const [priceHistoryResult, setPriceHistoryResult] = useState<PriceHistoryResponse | null>(null);

  const [alertItem, setAlertItem] = useState('watermelon');
  const [alertTargetUnitPrice, setAlertTargetUnitPrice] = useState('5');
  const [alertRadiusKm, setAlertRadiusKm] = useState('10');
  const [alertAreaText, setAlertAreaText] = useState('Kota Kinabalu');
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);

  const [promoUri, setPromoUri] = useState('');
  const [promoBase64, setPromoBase64] = useState('');
  const [promoMimeType, setPromoMimeType] = useState('image/jpeg');
  const [promoFileRef, setPromoFileRef] = useState('');
  const [promoMerchantHint, setPromoMerchantHint] = useState('');
  const [promoAreaHint, setPromoAreaHint] = useState('');
  const [promoIngestionResult, setPromoIngestionResult] = useState<{
    ingestionId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    created: number;
    skipped: number;
  } | null>(null);
  const [promoItems, setPromoItems] = useState<PromoIngestionItem[]>([]);

  const [pushStatus, setPushStatus] = useState('Not registered');
  const [pushToken, setPushToken] = useState('');

  const [ledgerItems, setLedgerItems] = useState<LedgerExpense[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);

  const signedInEmail =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '-';

  const clearMessage = useCallback(() => {
    setMessage('');
  }, []);

  const getBearerTokenOrThrow = useCallback(async (): Promise<string> => {
    const token = await getToken();
    if (!token) {
      throw new Error('No Clerk session token available. Please sign in again.');
    }
    return token;
  }, [getToken]);

  const runTask = useCallback(
    async (task: () => Promise<void>, options?: { clearMessage?: boolean }) => {
      setLoading(true);
      if (options?.clearMessage !== false) {
        setMessage('');
      }
      try {
        await task();
      } catch (error) {
        setMessage(errorToMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const ensurePushDeviceRegistration = useCallback(async () => {
    try {
      const existingPermission = await Notifications.getPermissionsAsync();
      const finalPermission =
        existingPermission.granted ||
        existingPermission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
          ? existingPermission
          : await Notifications.requestPermissionsAsync();

      if (!finalPermission.granted) {
        setPushStatus('Permission denied');
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
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
        appVersion: String(Constants.expoConfig?.version ?? '0.1.0'),
      });

      setPushToken(expoPushToken);
      setPushStatus('Registered');
    } catch (error) {
      setPushStatus(normalizePushRegistrationError(error));
    }
  }, [apiBaseUrl, getBearerTokenOrThrow]);

  useEffect(() => {
    let mounted = true;

    speechRecognitionService.configure({
      onStart: () => {
        setRecognitionState('listening');
      },
      onEnd: () => {
        setRecognitionState((previousState) =>
          previousState === 'listening' ? 'processing' : previousState,
        );
      },
      onPartialResults: (transcript) => {
        if (transcript) {
          setTranscriptInput(transcript);
        }
      },
      onFinalResults: (transcript) => {
        if (!transcript.trim()) {
          setRecognitionState('error');
          setMessage('No speech recognized. Please try again or use keyboard dictation.');
          return;
        }

        setTranscriptInput(transcript);
        setRecognitionState('ready');
        setMessage('Speech recognized on device. You can parse now.');
      },
      onError: (errorMessage) => {
        setRecognitionState('error');
        setMessage(errorMessage);
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
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPushStatus('Not registered');
      setPushToken('');
      return;
    }

    void ensurePushDeviceRegistration();
  }, [ensurePushDeviceRegistration, user?.id]);

  const syncBackendUser = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await verifyClerkSessionToken(normalizeBaseUrl(apiBaseUrl), token);
      setBackendUserId(result.user.id);
      setMessage(`Synced backend user: ${result.user.email}`);
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const signOutUser = useCallback(async () => {
    await runTask(async () => {
      if (pushToken) {
        try {
          const token = await getBearerTokenOrThrow();
          await revokePushDevice(normalizeBaseUrl(apiBaseUrl), token, pushToken);
        } catch {
          // Best effort cleanup.
        }
      }
      await signOut();
      setBackendUserId('');
      setPushToken('');
      setPushStatus('Not registered');
      setMessage('Signed out.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, pushToken, runTask, signOut]);

  const startListening = useCallback(async () => {
    clearMessage();

    try {
      if (!onDeviceSttEnabled) {
        throw new Error(
          'On-device STT is disabled. Enable EXPO_PUBLIC_STT_ON_DEVICE_ENABLED to use microphone STT.',
        );
      }

      if (recognitionState === 'listening') {
        return;
      }

      const available = await speechRecognitionService.isAvailable();
      setRecognizerAvailable(available);
      if (!available) {
        throw new Error(
          'Speech recognition is unavailable on this device. Use keyboard dictation as fallback.',
        );
      }

      setVoiceParse(null);
      setVoiceParseLatencyMs(null);
      setTranscriptInput('');
      setRecognitionState('processing');

      await speechRecognitionService.start(defaultSttLocale);
      setMessage('Listening... speak now, then tap stop.');
    } catch (error) {
      setRecognitionState('error');
      setMessage(errorToMessage(error));
    }
  }, [clearMessage, recognitionState]);

  const stopListening = useCallback(async () => {
    if (recognitionState !== 'listening' && recognitionState !== 'processing') {
      return;
    }

    clearMessage();
    try {
      setRecognitionState('processing');
      await speechRecognitionService.stop();
      setMessage('Processing speech...');
    } catch (error) {
      setRecognitionState('error');
      setMessage(errorToMessage(error));
    }
  }, [clearMessage, recognitionState]);

  const parseVoiceExpense = useCallback(async () => {
    await runTask(async () => {
      if (recognitionState === 'listening' || recognitionState === 'processing') {
        throw new Error('Stop listening first before parsing.');
      }

      if (!transcriptInput.trim()) {
        throw new Error('Provide transcript first (on-device STT or keyboard dictation).');
      }

      const token = await getBearerTokenOrThrow();
      const startedAt = Date.now();
      const result = await parseVoice(normalizeBaseUrl(apiBaseUrl), token, {
        transcript: transcriptInput.trim(),
        locale: defaultSttLocale,
        deviceConfidence: 0.96,
      });

      setVoiceParse(result);
      setRecognitionState('ready');
      setVoiceParseLatencyMs(Date.now() - startedAt);
      setMessage(`Voice parsed via ${result.parseMeta.parsePath}. Review and confirm.`);
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, recognitionState, runTask, transcriptInput]);

  const confirmVoiceExpense = useCallback(async () => {
    if (!voiceParse) {
      return;
    }

    await runTask(async () => {
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
      setMessage('Voice expense saved.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask, voiceParse]);

  const chooseReceipt = useCallback(
    async (fromCamera: boolean) => {
      clearMessage();
      try {
        const picked = await pickImageAsset(fromCamera);
        if (!picked) {
          return;
        }
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

        setMessage('Receipt image selected and uploaded.');
      } catch (error) {
        setMessage(errorToMessage(error));
      }
    },
    [apiBaseUrl, clearMessage, getBearerTokenOrThrow],
  );

  const pickReceiptCamera = useCallback(async () => {
    await chooseReceipt(true);
  }, [chooseReceipt]);

  const pickReceiptGallery = useCallback(async () => {
    await chooseReceipt(false);
  }, [chooseReceipt]);

  const parseReceiptExpense = useCallback(async () => {
    await runTask(async () => {
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
      setMessage('Receipt parsed. Review and confirm.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    runTask,
    selectedReceiptBase64,
    selectedReceiptFileRef,
    selectedReceiptMimeType,
  ]);

  const confirmReceiptExpense = useCallback(async () => {
    if (!receiptParse) {
      return;
    }

    await runTask(async () => {
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
          fileRef: selectedReceiptFileRef || receiptParse.fileRef || 'local://receipt-not-uploaded',
          mimeType: selectedReceiptMimeType,
          parsedPayload: receiptParse.candidate,
          ocrRaw: receiptParse.rawPayload,
          confidence: 0.8,
        },
      });
      setMessage('Receipt expense saved.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    receiptParse,
    runTask,
    selectedReceiptFileRef,
    selectedReceiptMimeType,
    selectedReceiptUri,
  ]);

  const loadLedger = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listExpenses(normalizeBaseUrl(apiBaseUrl), token);
      const mapped = mapLedgerItems(result.items as unknown[]);
      setLedgerItems(mapped);
      setMessage(`Loaded ${mapped.length} expenses.`);
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const loadReport = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await loadMonthlyReport(normalizeBaseUrl(apiBaseUrl), token);
      setReportSummary(mapReportSummary(result));
      setMessage('Monthly report loaded.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const loadPriceCompareResult = useCallback(async () => {
    await runTask(async () => {
      if (!priceQueryItem.trim()) {
        throw new Error('Enter an item name first.');
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

      setPriceCompareResult(result);
      setMessage('Loaded price comparison.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    includePromo,
    priceQueryArea,
    priceQueryItem,
    priceQueryLat,
    priceQueryLng,
    priceQueryRadiusKm,
    runTask,
  ]);

  const loadPriceHistoryResult = useCallback(async () => {
    await runTask(async () => {
      if (!priceQueryItem.trim()) {
        throw new Error('Enter an item name first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await loadPriceHistory(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        area: priceQueryArea.trim() || undefined,
        interval: priceHistoryInterval,
        includePromo,
      });

      setPriceHistoryResult(result);
      setMessage('Loaded price history.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    includePromo,
    priceHistoryInterval,
    priceQueryArea,
    priceQueryItem,
    runTask,
  ]);

  const createAlert = useCallback(async () => {
    await runTask(async () => {
      const targetUnitPrice = parseNumberInput(alertTargetUnitPrice);
      if (!alertItem.trim() || typeof targetUnitPrice !== 'number') {
        throw new Error('Provide alert item and valid target unit price.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await createPriceAlert(normalizeBaseUrl(apiBaseUrl), token, {
        item: alertItem.trim(),
        targetUnitPrice,
        radiusKm: parseNumberInput(alertRadiusKm),
        areaText: alertAreaText.trim() || undefined,
      });
      setAlerts((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      setMessage('Price alert created.');
    });
  }, [
    alertAreaText,
    alertItem,
    alertRadiusKm,
    alertTargetUnitPrice,
    apiBaseUrl,
    getBearerTokenOrThrow,
    runTask,
  ]);

  const loadAlerts = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listPriceAlerts(normalizeBaseUrl(apiBaseUrl), token);
      setAlerts(result.items);
      setMessage('Loaded alerts.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const loadAlertEvents = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listAlertEvents(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 20,
        unreadOnly: false,
      });
      setAlertEvents(result.items);
      setAlertUnreadCount(result.items.filter((item) => item.readAt === null).length);
      setMessage('Loaded alert events.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const markAllEventsRead = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      await markAllAlertEventsRead(normalizeBaseUrl(apiBaseUrl), token);
      const refreshed = await listAlertEvents(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 20,
        unreadOnly: false,
      });
      setAlertEvents(refreshed.items);
      setAlertUnreadCount(refreshed.items.filter((item) => item.readAt === null).length);
      setMessage('Marked all alert events as read.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const choosePromo = useCallback(
    async (fromCamera: boolean) => {
      clearMessage();
      try {
        const picked = await pickImageAsset(fromCamera);
        if (!picked) {
          return;
        }
        if (!picked.base64) {
          throw new Error('Could not read promo image as base64.');
        }

        const mimeType = picked.mimeType ?? 'image/jpeg';
        setPromoUri(picked.uri);
        setPromoBase64(picked.base64);
        setPromoMimeType(mimeType);
        setPromoFileRef('');

        const token = await getBearerTokenOrThrow();
        const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
          kind: 'receipt',
          mimeType,
          fileBase64: picked.base64,
        });
        setPromoFileRef(uploaded.fileRef);

        setMessage('Promo image selected and uploaded.');
      } catch (error) {
        setMessage(errorToMessage(error));
      }
    },
    [apiBaseUrl, clearMessage, getBearerTokenOrThrow],
  );

  const pickPromoCamera = useCallback(async () => {
    await choosePromo(true);
  }, [choosePromo]);

  const pickPromoGallery = useCallback(async () => {
    await choosePromo(false);
  }, [choosePromo]);

  const ingestPromoFile = useCallback(async () => {
    await runTask(async () => {
      if (!promoFileRef) {
        throw new Error('Upload a promo image first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await ingestPromo(normalizeBaseUrl(apiBaseUrl), token, {
        fileRef: promoFileRef,
        mimeType: promoMimeType,
        merchantText: promoMerchantHint.trim() || undefined,
        areaText: promoAreaHint.trim() || undefined,
        autoApprove: false,
      });
      setPromoIngestionResult(result);
      setMessage('Promo ingestion completed.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    promoAreaHint,
    promoFileRef,
    promoMerchantHint,
    promoMimeType,
    runTask,
  ]);

  const loadPromos = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listPromos(normalizeBaseUrl(apiBaseUrl), token, {
        limit: 10,
      });
      setPromoItems(result.items);
      setMessage('Loaded promo ingestions.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const value = useMemo(
    () => ({
      apiBaseUrl,
      setApiBaseUrl,
      message,
      clearMessage,
      loading,
      signedInEmail,
      backendUserId,
      pushStatus,
      pushTokenPreview: pushToken ? `${pushToken.slice(0, 18)}...${pushToken.slice(-6)}` : '-',

      transcriptInput,
      setTranscriptInput,
      recognitionState,
      recognizerAvailable,
      voiceParseLatencyMs,
      voiceParse,

      receiptReady: Boolean(selectedReceiptBase64 || selectedReceiptUri),
      receiptFileRef: selectedReceiptFileRef,
      receiptParseLatencyMs,
      receiptParse,

      ledgerItems,
      ledgerTotal: ledgerItems.reduce((acc, item) => acc + item.totalAmount, 0),
      reportSummary,

      priceQueryItem,
      setPriceQueryItem,
      priceQueryArea,
      setPriceQueryArea,
      priceQueryLat,
      setPriceQueryLat,
      priceQueryLng,
      setPriceQueryLng,
      priceQueryRadiusKm,
      setPriceQueryRadiusKm,
      priceHistoryInterval,
      setPriceHistoryInterval,
      includePromo,
      setIncludePromo,
      priceCompareResult,
      priceHistoryResult,

      alertItem,
      setAlertItem,
      alertTargetUnitPrice,
      setAlertTargetUnitPrice,
      alertRadiusKm,
      setAlertRadiusKm,
      alertAreaText,
      setAlertAreaText,
      alerts,
      alertEvents,
      alertUnreadCount,

      promoReady: Boolean(promoBase64 || promoUri),
      promoFileRef,
      promoMerchantHint,
      setPromoMerchantHint,
      promoAreaHint,
      setPromoAreaHint,
      promoIngestionResult,
      promoItems,

      syncBackendUser,
      signOutUser,

      startListening,
      stopListening,
      parseVoiceExpense,
      confirmVoiceExpense,

      pickReceiptCamera,
      pickReceiptGallery,
      parseReceiptExpense,
      confirmReceiptExpense,

      loadLedger,
      loadReport,

      loadPriceCompareResult,
      loadPriceHistoryResult,

      createAlert,
      loadAlerts,
      loadAlertEvents,
      markAllEventsRead,

      pickPromoCamera,
      pickPromoGallery,
      ingestPromoFile,
      loadPromos,

      formatCurrency,
    }),
    [
      alertAreaText,
      alertEvents,
      alertItem,
      alertRadiusKm,
      alertTargetUnitPrice,
      alertUnreadCount,
      alerts,
      apiBaseUrl,
      backendUserId,
      clearMessage,
      confirmReceiptExpense,
      confirmVoiceExpense,
      createAlert,
      formatCurrency,
      includePromo,
      ingestPromoFile,
      ledgerItems,
      loadAlertEvents,
      loadAlerts,
      loadLedger,
      loadPriceCompareResult,
      loadPriceHistoryResult,
      loadPromos,
      loadReport,
      loading,
      markAllEventsRead,
      message,
      parseReceiptExpense,
      parseVoiceExpense,
      pickPromoCamera,
      pickPromoGallery,
      pickReceiptCamera,
      pickReceiptGallery,
      priceCompareResult,
      priceHistoryInterval,
      priceHistoryResult,
      priceQueryArea,
      priceQueryItem,
      priceQueryLat,
      priceQueryLng,
      priceQueryRadiusKm,
      promoAreaHint,
      promoBase64,
      promoFileRef,
      promoIngestionResult,
      promoItems,
      promoMerchantHint,
      promoUri,
      pushStatus,
      pushToken,
      receiptParse,
      receiptParseLatencyMs,
      recognitionState,
      recognizerAvailable,
      reportSummary,
      selectedReceiptBase64,
      selectedReceiptFileRef,
      selectedReceiptUri,
      setAlertAreaText,
      setAlertItem,
      setAlertRadiusKm,
      setAlertTargetUnitPrice,
      setApiBaseUrl,
      setIncludePromo,
      setPriceHistoryInterval,
      setPriceQueryArea,
      setPriceQueryItem,
      setPriceQueryLat,
      setPriceQueryLng,
      setPriceQueryRadiusKm,
      setPromoAreaHint,
      setPromoMerchantHint,
      setTranscriptInput,
      signOutUser,
      signedInEmail,
      startListening,
      stopListening,
      syncBackendUser,
      transcriptInput,
      voiceParse,
      voiceParseLatencyMs,
    ],
  );

  return value;
}

const ClariFiControllerContext = createContext<ClariFiController | undefined>(undefined);

export function ClariFiControllerProvider({ children }: { children: ReactNode }) {
  const value = useClariFiControllerValue();
  return <ClariFiControllerContext.Provider value={value}>{children}</ClariFiControllerContext.Provider>;
}

export function useClariFiController(): ClariFiController {
  const value = useContext(ClariFiControllerContext);
  if (!value) {
    throw new Error('useClariFiController must be used inside ClariFiControllerProvider');
  }
  return value;
}
