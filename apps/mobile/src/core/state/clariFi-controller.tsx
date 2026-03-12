import { useAuth, useUser } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { speechRecognitionService, type RecognitionState } from '../../features/capture/speech-recognition.service';
import {
  ApiRequestError,
  confirmExpense,
  confirmPromoIngestion,
  createFamily,
  createFamilyInvite,
  createPriceAlert,
  createSplit,
  finalizeSplit,
  getHealthLive,
  getHealthReady,
  getSplit,
  getSplitBalances,
  ingestPromo,
  joinFamilyByCode,
  listAlertEvents,
  listExpenses,
  listFamilies,
  listPushDevices,
  listPriceAlerts,
  listPromos,
  listSplits,
  loadMonthlyReport,
  loadPriceCompare,
  loadPriceHistory,
  loadPriceSignal,
  markAlertEventRead,
  markAllAlertEventsRead,
  getSubscription,
  parseReceipt,
  parseDocument,
  parseVoice,
  registerPushDevice,
  removeFamilyMember,
  revokePushDevice,
  uploadArtifact,
  updateFamilyMemberRole,
  updateMockSubscription,
  updateSplitAllocations,
  updateSplitParticipants,
  verifyClerkSessionToken,
} from '../../shared/api';
import type {
  AlertEvent,
  AlertKind,
  FamilyProfile,
  FamilyRole,
  HealthLiveResponse,
  HealthReadyResponse,
  DocumentParseResult,
  MonthlyReportResponse,
  MonthlySpendDeltaDirection,
  PriceAlert,
  PriceCompareResponse,
  PriceHistoryResponse,
  PriceSignalResponse,
  PromoIngestionItem,
  PushDevice,
  ReceiptParseResult,
  SignalDecisionFilter,
  SplitDetailResponse,
  SplitSummary,
  SubscriptionSnapshot,
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
  if (error instanceof ApiRequestError) {
    if (error.requestId) {
      return `${error.message} (request ${error.requestId})`;
    }
    return error.message;
  }
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

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseLineAssignments(value: string): Array<{ expenseLineItemId: string; participantIds: string[] }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split('=');
      const expenseLineItemId = (left ?? '').trim();
      const participantIds = parseCsvList(right ?? '');
      if (!expenseLineItemId || participantIds.length === 0) {
        throw new Error(`Invalid assignment row: "${line}". Use format lineItemId=participantId1,participantId2`);
      }
      return {
        expenseLineItemId,
        participantIds,
      };
    });
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

function getExpenseDisplayMerchant(
  merchantText: unknown,
  areaText: unknown,
  fallback = 'Unknown merchant',
): string {
  const merchant = getString(merchantText);
  if (merchant) {
    return merchant;
  }

  const area = getString(areaText);
  if (area) {
    return area;
  }

  return fallback;
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
  const assets = await pickImageAssets(fromCamera, false);
  return assets[0] ?? null;
}

async function pickImageAssets(
  fromCamera: boolean,
  allowMultiple: boolean,
): Promise<ImagePicker.ImagePickerAsset[]> {
  const imageMediaTypes: ImagePicker.MediaType[] = ['images'];

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
        mediaTypes: imageMediaTypes,
        quality: 0.8,
        base64: true,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: imageMediaTypes,
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: allowMultiple,
        selectionLimit: allowMultiple ? 8 : 1,
      });

  if (result.canceled || !result.assets.length) {
    return [];
  }

  return result.assets;
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
  spendDelta: {
    previousCashOut: number;
    absolute: number;
    percentage: number | null;
    direction: MonthlySpendDeltaDirection;
  };
  categoryBreakdown: Array<{ category: string; amount: number }>;
  topItems: Array<{ item: string; amount: number; occurrences: number }>;
  topMerchants: Array<{ merchant: string; amount: number; expenseCount: number }>;
  anomalies: Array<{
    expenseId: string;
    merchantText: string;
    totalAmount: number;
    transactionAt: string;
    zScore: number;
  }>;
  insights: string[];
}

export interface PriceQueryLocation {
  labelText: string;
  areaText: string;
  latText: string;
  lngText: string;
  radiusKmText: string;
  source: 'unset' | 'gps' | 'search';
}

interface ExpenseConfirmOverrides {
  merchantText?: string;
  areaText?: string;
  locationLat?: number;
  locationLng?: number;
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
      merchant: getExpenseDisplayMerchant(value.merchantText, value.areaText),
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

function mapReportSummary(raw: MonthlyReportResponse): ReportSummary {
  const categoryRaw = (raw.categoryBreakdown ?? {}) as Record<string, number>;
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
    spendDelta: {
      previousCashOut: toNumber(raw.spendDelta?.previousCashOut),
      absolute: toNumber(raw.spendDelta?.absolute),
      percentage:
        typeof raw.spendDelta?.percentage === 'number'
          ? toNumber(raw.spendDelta.percentage)
          : null,
      direction: raw.spendDelta?.direction ?? 'NO_BASELINE',
    },
    categoryBreakdown,
    topItems: Array.isArray(raw.topItems)
      ? raw.topItems
          .map((item) => ({
            item: getString(item.item, 'Unknown item'),
            amount: toNumber(item.amount),
            occurrences: Math.trunc(toNumber(item.occurrences)),
          }))
          .filter((item) => item.item)
      : [],
    topMerchants: Array.isArray(raw.topMerchants)
      ? raw.topMerchants
          .map((merchant) => ({
            merchant: getString(merchant.merchant, 'Unknown merchant'),
            amount: toNumber(merchant.amount),
            expenseCount: Math.trunc(toNumber(merchant.expenseCount)),
          }))
          .filter((merchant) => merchant.merchant)
      : [],
    anomalies: Array.isArray(raw.anomalies)
      ? raw.anomalies.map((entry) => ({
          expenseId: getString(entry.expenseId),
          merchantText: getString(entry.merchantText, 'Unknown merchant'),
          totalAmount: toNumber(entry.totalAmount),
          transactionAt: getString(entry.transactionAt),
          zScore: toNumber(entry.zScore),
        }))
      : [],
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
  authSyncStatus: 'idle' | 'syncing' | 'ok' | 'error';
  authSyncError: string;
  backendLiveHealth: HealthLiveResponse | null;
  backendReadyHealth: HealthReadyResponse | null;
  backendHealthCheckedAt: string;
  pushStatus: string;
  pushTokenPreview: string;
  pushDevices: PushDevice[];

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
  documentReady: boolean;
  documentImageCount: number;
  documentParse: DocumentParseResult | null;

  ledgerItems: LedgerExpense[];
  ledgerTotal: number;
  reportSummary: ReportSummary | null;
  subscription: SubscriptionSnapshot | null;

  families: FamilyProfile[];
  activeFamilyId: string;
  setActiveFamilyId: (value: string) => void;
  familyNameInput: string;
  setFamilyNameInput: (value: string) => void;
  familyInviteCodeInput: string;
  setFamilyInviteCodeInput: (value: string) => void;
  familyInviteLatestCode: string;
  familyRoleTarget: FamilyRole;
  setFamilyRoleTarget: (value: FamilyRole) => void;
  familyMemberIdInput: string;
  setFamilyMemberIdInput: (value: string) => void;

  splitExpenseIdInput: string;
  setSplitExpenseIdInput: (value: string) => void;
  splitTitleInput: string;
  setSplitTitleInput: (value: string) => void;
  splitSharedChargeInput: string;
  setSplitSharedChargeInput: (value: string) => void;
  splitParticipantMemberIdsInput: string;
  setSplitParticipantMemberIdsInput: (value: string) => void;
  splitParticipantGuestNamesInput: string;
  setSplitParticipantGuestNamesInput: (value: string) => void;
  splitPayerParticipantIdInput: string;
  setSplitPayerParticipantIdInput: (value: string) => void;
  splitAssignmentsInput: string;
  setSplitAssignmentsInput: (value: string) => void;
  splitSummaries: SplitSummary[];
  splitDetail: SplitDetailResponse | null;
  splitBalanceSummary:
    | {
        splitId: string;
        status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
        balances: Array<{
          participantId: string;
          displayName: string;
          owedAmount: number;
          paidAmount: number;
          netAmount: number;
        }>;
        settlements: Array<{
          fromParticipantId: string;
          toParticipantId: string;
          amount: number;
        }>;
      }
    | null;
  activeSplitId: string;
  setActiveSplitId: (value: string) => void;

  priceQueryItem: string;
  setPriceQueryItem: (value: string) => void;
  priceQueryLocation: PriceQueryLocation;
  updatePriceQueryLocation: (patch: Partial<PriceQueryLocation>) => void;
  applyDetectedPriceQueryLocation: (input: {
    labelText?: string;
    areaText?: string;
    lat: number;
    lng: number;
  }) => void;
  selectPriceQueryLocation: (input: {
    labelText: string;
    areaText?: string;
    lat: number;
    lng: number;
  }) => void;
  priceHistoryInterval: 'day' | 'week';
  setPriceHistoryInterval: (value: 'day' | 'week') => void;
  includePromo: boolean;
  setIncludePromo: (value: boolean) => void;
  priceCompareResult: PriceCompareResponse | null;
  priceHistoryResult: PriceHistoryResponse | null;
  priceSignalResult: PriceSignalResponse | null;

  alertItem: string;
  setAlertItem: (value: string) => void;
  alertKind: AlertKind;
  setAlertKind: (value: AlertKind) => void;
  alertTargetUnitPrice: string;
  setAlertTargetUnitPrice: (value: string) => void;
  alertSignalDecisionFilter: SignalDecisionFilter;
  setAlertSignalDecisionFilter: (value: SignalDecisionFilter) => void;
  alertSignalMinConfidence: string;
  setAlertSignalMinConfidence: (value: string) => void;
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
  checkBackendHealth: () => Promise<void>;
  loadPushDevices: () => Promise<void>;
  revokeCurrentPushDevice: () => Promise<void>;
  signOutUser: () => Promise<void>;

  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  parseVoiceExpense: () => Promise<void>;
  confirmVoiceExpense: (overrides?: ExpenseConfirmOverrides) => Promise<void>;

  pickReceiptCamera: () => Promise<void>;
  pickReceiptGallery: () => Promise<void>;
  parseReceiptExpense: () => Promise<void>;
  confirmReceiptExpense: (overrides?: ExpenseConfirmOverrides) => Promise<void>;
  pickDocumentCamera: () => Promise<void>;
  pickDocumentGallery: () => Promise<void>;
  parseSelectedDocument: () => Promise<void>;
  confirmParsedDocument: (overrides?: ExpenseConfirmOverrides) => Promise<void>;
  clearParsedDocument: () => void;

  loadLedger: () => Promise<void>;
  loadReport: () => Promise<void>;
  loadSubscription: () => Promise<void>;
  updateSubscriptionPlan: (plan: 'FREE' | 'PREMIUM', addonCount: number) => Promise<void>;

  createFamilyProfile: () => Promise<void>;
  loadFamiliesList: () => Promise<void>;
  createActiveFamilyInvite: () => Promise<void>;
  joinFamilyByInviteCode: () => Promise<void>;
  updateFamilyMemberRoleById: (memberId: string, role: FamilyRole) => Promise<void>;
  removeFamilyMemberById: (memberId: string) => Promise<void>;
  updateFamilyMemberRoleAction: () => Promise<void>;
  removeFamilyMemberAction: () => Promise<void>;

  createSplitDraft: (input: {
    familyId: string;
    expenseId?: string;
    title?: string;
    sharedCharge?: number;
    participantFamilyMemberIds?: string[];
    guestParticipants?: string[];
  }) => Promise<void>;
  loadSplitDetailById: (splitId: string) => Promise<void>;
  updateSplitParticipantsById: (
    splitId: string,
    participants: Array<{
      familyMemberId?: string;
      displayName?: string;
      isPayer?: boolean;
      paidAmount?: number;
    }>,
  ) => Promise<void>;
  updateSplitAllocationsById: (
    splitId: string,
    input: {
      lineAssignments: Array<{
        expenseLineItemId: string;
        participantIds: string[];
      }>;
      sharedCharge?: number;
    },
  ) => Promise<void>;
  finalizeSplitById: (splitId: string) => Promise<void>;
  loadSplitBalancesById: (splitId: string) => Promise<void>;
  createSplitSessionAction: () => Promise<void>;
  loadSplitSessions: () => Promise<void>;
  loadActiveSplitDetail: () => Promise<void>;
  saveSplitParticipantsAction: () => Promise<void>;
  saveSplitAllocationsAction: () => Promise<void>;
  finalizeActiveSplit: () => Promise<void>;
  loadActiveSplitBalances: () => Promise<void>;

  loadPriceCompareResult: () => Promise<void>;
  loadPriceHistoryResult: () => Promise<void>;
  loadPriceSignalResult: () => Promise<void>;

  createAlert: () => Promise<void>;
  createSignalAlertFromPriceQuery: () => Promise<void>;
  loadAlerts: () => Promise<void>;
  loadAlertEvents: () => Promise<void>;
  markEventRead: (eventId: string) => Promise<void>;
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
  const getTokenRef = useRef(getToken);
  const subscriptionLoadInFlightRef = useRef(false);
  const parseVoiceTranscriptRef = useRef<(transcript: string) => Promise<void>>(async () => undefined);

  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendUserId, setBackendUserId] = useState('');
  const [authSyncStatus, setAuthSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [authSyncError, setAuthSyncError] = useState('');
  const [lastSyncedClerkUserId, setLastSyncedClerkUserId] = useState('');
  const [lastAutoSyncAttemptedClerkUserId, setLastAutoSyncAttemptedClerkUserId] = useState('');
  const [backendLiveHealth, setBackendLiveHealth] = useState<HealthLiveResponse | null>(null);
  const [backendReadyHealth, setBackendReadyHealth] = useState<HealthReadyResponse | null>(null);
  const [backendHealthCheckedAt, setBackendHealthCheckedAt] = useState('');

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
  const [documentUris, setDocumentUris] = useState<string[]>([]);
  const [documentBase64s, setDocumentBase64s] = useState<string[]>([]);
  const [documentMimeType, setDocumentMimeType] = useState('image/jpeg');
  const [documentFileRefs, setDocumentFileRefs] = useState<string[]>([]);
  const [documentParse, setDocumentParse] = useState<DocumentParseResult | null>(null);

  const [priceQueryItem, setPriceQueryItem] = useState('watermelon');
  const [priceQueryLocation, setPriceQueryLocation] = useState<PriceQueryLocation>({
    labelText: '',
    areaText: '',
    latText: '',
    lngText: '',
    radiusKmText: '10',
    source: 'unset',
  });
  const [priceHistoryInterval, setPriceHistoryInterval] = useState<'day' | 'week'>('day');
  const [includePromo, setIncludePromo] = useState(true);
  const [priceCompareResult, setPriceCompareResult] = useState<PriceCompareResponse | null>(null);
  const [priceHistoryResult, setPriceHistoryResult] = useState<PriceHistoryResponse | null>(null);
  const [priceSignalResult, setPriceSignalResult] = useState<PriceSignalResponse | null>(null);

  const [alertItem, setAlertItem] = useState('watermelon');
  const [alertKind, setAlertKind] = useState<AlertKind>('THRESHOLD');
  const [alertTargetUnitPrice, setAlertTargetUnitPrice] = useState('5');
  const [alertSignalDecisionFilter, setAlertSignalDecisionFilter] =
    useState<SignalDecisionFilter>('BOTH');
  const [alertSignalMinConfidence, setAlertSignalMinConfidence] = useState('0.65');
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
  const [pushDevices, setPushDevices] = useState<PushDevice[]>([]);

  const [ledgerItems, setLedgerItems] = useState<LedgerExpense[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null);

  const [families, setFamilies] = useState<FamilyProfile[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState('');
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [familyInviteCodeInput, setFamilyInviteCodeInput] = useState('');
  const [familyInviteLatestCode, setFamilyInviteLatestCode] = useState('');
  const [familyRoleTarget, setFamilyRoleTarget] = useState<FamilyRole>('VIEWER');
  const [familyMemberIdInput, setFamilyMemberIdInput] = useState('');

  const [splitExpenseIdInput, setSplitExpenseIdInput] = useState('');
  const [splitTitleInput, setSplitTitleInput] = useState('');
  const [splitSharedChargeInput, setSplitSharedChargeInput] = useState('0');
  const [splitParticipantMemberIdsInput, setSplitParticipantMemberIdsInput] = useState('');
  const [splitParticipantGuestNamesInput, setSplitParticipantGuestNamesInput] = useState('');
  const [splitPayerParticipantIdInput, setSplitPayerParticipantIdInput] = useState('');
  const [splitAssignmentsInput, setSplitAssignmentsInput] = useState('');
  const [splitSummaries, setSplitSummaries] = useState<SplitSummary[]>([]);
  const [splitDetail, setSplitDetail] = useState<SplitDetailResponse | null>(null);
  const [splitBalanceSummary, setSplitBalanceSummary] = useState<{
    splitId: string;
    status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
    balances: Array<{
      participantId: string;
      displayName: string;
      owedAmount: number;
      paidAmount: number;
      netAmount: number;
    }>;
    settlements: Array<{
      fromParticipantId: string;
      toParticipantId: string;
      amount: number;
    }>;
  } | null>(null);
  const [activeSplitId, setActiveSplitId] = useState('');

  const signedInEmail =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '-';

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const clearMessage = useCallback(() => {
    setMessage('');
  }, []);

  const updatePriceQueryLocation = useCallback((patch: Partial<PriceQueryLocation>) => {
    setPriceQueryLocation((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const applyDetectedPriceQueryLocation = useCallback(
    (input: { labelText?: string; areaText?: string; lat: number; lng: number }) => {
      setPriceQueryLocation((current) => ({
        ...current,
        labelText: input.labelText?.trim() || input.areaText?.trim() || current.labelText,
        areaText: input.areaText?.trim() || current.areaText,
        latText: input.lat.toFixed(6),
        lngText: input.lng.toFixed(6),
        source: 'gps',
      }));
    },
    [],
  );

  const selectPriceQueryLocation = useCallback(
    (input: { labelText: string; areaText?: string; lat: number; lng: number }) => {
      setPriceQueryLocation((current) => ({
        ...current,
        labelText: input.labelText.trim(),
        areaText: input.areaText?.trim() || input.labelText.trim(),
        latText: input.lat.toFixed(6),
        lngText: input.lng.toFixed(6),
        source: 'search',
      }));
    },
    [],
  );

  const getBearerTokenOrThrow = useCallback(async (): Promise<string> => {
    const token = await getTokenRef.current();
    if (!token) {
      throw new Error('No Clerk session token available. Please sign in again.');
    }
    return token;
  }, []);

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
    if (!user?.id) {
      setPushStatus('Not registered');
      setPushToken('');
      setPushDevices([]);
      return;
    }

    void ensurePushDeviceRegistration();
  }, [ensurePushDeviceRegistration, user?.id]);

  const performBackendUserSync = useCallback(
    async (options?: { silent?: boolean }) => {
      setAuthSyncStatus('syncing');
      setAuthSyncError('');
      try {
        const token = await getBearerTokenOrThrow();
        const result = await verifyClerkSessionToken(normalizeBaseUrl(apiBaseUrl), token);
        setBackendUserId(result.user.id);
        if (user?.id) {
          setLastSyncedClerkUserId(user.id);
        }
        setAuthSyncStatus('ok');
        if (!options?.silent) {
          setMessage(`Synced backend user: ${result.user.email}`);
        }
      } catch (error) {
        setAuthSyncStatus('error');
        setAuthSyncError(errorToMessage(error));
        throw error;
      }
    },
    [apiBaseUrl, getBearerTokenOrThrow, user?.id],
  );

  useEffect(() => {
    if (!user?.id) {
      setAuthSyncStatus('idle');
      setAuthSyncError('');
      setLastSyncedClerkUserId('');
      setLastAutoSyncAttemptedClerkUserId('');
      setSubscription(null);
      return;
    }

    if (
      lastSyncedClerkUserId === user.id ||
      lastAutoSyncAttemptedClerkUserId === user.id ||
      authSyncStatus === 'syncing'
    ) {
      return;
    }

    setLastAutoSyncAttemptedClerkUserId(user.id);
    void performBackendUserSync({ silent: true }).catch(() => {
      // Keep silent for auto sync; account screen exposes status for debugging.
    });
  }, [
    authSyncStatus,
    lastAutoSyncAttemptedClerkUserId,
    lastSyncedClerkUserId,
    performBackendUserSync,
    user?.id,
  ]);

  const syncBackendUser = useCallback(async () => {
    await runTask(async () => {
      await performBackendUserSync();
    });
  }, [performBackendUserSync, runTask]);

  const checkBackendHealth = useCallback(async () => {
    await runTask(async () => {
      const [live, ready] = await Promise.all([
        getHealthLive(normalizeBaseUrl(apiBaseUrl)),
        getHealthReady(normalizeBaseUrl(apiBaseUrl)),
      ]);
      setBackendLiveHealth(live);
      setBackendReadyHealth(ready);
      setBackendHealthCheckedAt(new Date().toISOString());
      setMessage(`Backend healthy: ${live.status} / ${ready.status}.`);
    });
  }, [apiBaseUrl, runTask]);

  const loadSubscription = useCallback(async () => {
    if (subscriptionLoadInFlightRef.current) {
      return;
    }

    subscriptionLoadInFlightRef.current = true;
    try {
      await runTask(async () => {
        const token = await getBearerTokenOrThrow();
        const result = await getSubscription(normalizeBaseUrl(apiBaseUrl), token);
        setSubscription(result);
      }, { clearMessage: false });
    } finally {
      subscriptionLoadInFlightRef.current = false;
    }
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const updateSubscriptionPlan = useCallback(
    async (plan: 'FREE' | 'PREMIUM', addonCount: number) => {
      await runTask(async () => {
        const token = await getBearerTokenOrThrow();
        const result = await updateMockSubscription(normalizeBaseUrl(apiBaseUrl), token, {
          plan,
          addonCount,
        });
        setSubscription(result);
        setMessage(plan === 'PREMIUM' ? 'Premium unlocked.' : 'Switched to free plan.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    void loadSubscription();
  }, [loadSubscription, user?.id]);

  const loadPushDevices = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listPushDevices(normalizeBaseUrl(apiBaseUrl), token);
      setPushDevices(result.items);
      setMessage(`Loaded ${result.total} push device${result.total === 1 ? '' : 's'}.`);
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const revokeCurrentPushDevice = useCallback(async () => {
    await runTask(async () => {
      if (!pushToken) {
        throw new Error('No registered push token for this device.');
      }

      const token = await getBearerTokenOrThrow();
      await revokePushDevice(normalizeBaseUrl(apiBaseUrl), token, pushToken);
      setPushStatus('Revoked current device');
      setPushDevices((previous) =>
        previous.map((device) =>
          device.expoPushToken === pushToken
            ? {
                ...device,
                active: false,
                revokedAt: new Date().toISOString(),
              }
            : device,
        ),
      );
      setMessage('Current device push token revoked.');
    });
  }, [apiBaseUrl, getBearerTokenOrThrow, pushToken, runTask]);

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
      setAuthSyncStatus('idle');
      setAuthSyncError('');
      setLastSyncedClerkUserId('');
      setLastAutoSyncAttemptedClerkUserId('');
      setSubscription(null);
      setBackendLiveHealth(null);
      setBackendReadyHealth(null);
      setBackendHealthCheckedAt('');
      setPushToken('');
      setPushDevices([]);
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

  const parseVoiceTranscript = useCallback(async (inputTranscript: string) => {
    const parseTranscript = inputTranscript.trim();
    if (!parseTranscript) {
      setRecognitionState('error');
      setMessage('Provide transcript first (on-device STT or keyboard dictation).');
      return;
    }

    await runTask(
      async () => {
        if (recognitionState === 'listening') {
          throw new Error('Stop listening first before parsing.');
        }

        setTranscriptInput(parseTranscript);
        setVoiceParse(null);
        setVoiceParseLatencyMs(null);
        setRecognitionState('processing');
        setMessage('Parsing voice expense...');

        const token = await getBearerTokenOrThrow();
        const startedAt = Date.now();

        try {
          const result = await parseVoice(normalizeBaseUrl(apiBaseUrl), token, {
            transcript: parseTranscript,
            locale: defaultSttLocale,
            deviceConfidence: 0.96,
          });

          setVoiceParse(result);
          setRecognitionState('ready');
          setVoiceParseLatencyMs(Date.now() - startedAt);
          setMessage(`Voice parsed via ${result.parseMeta.parsePath}. Review and confirm.`);
        } catch (error) {
          setRecognitionState('error');
          throw error;
        }
      },
      { clearMessage: false },
    );
  }, [apiBaseUrl, defaultSttLocale, getBearerTokenOrThrow, recognitionState, runTask]);

  const parseVoiceExpense = useCallback(async () => {
    await parseVoiceTranscript(transcriptInput);
  }, [parseVoiceTranscript, transcriptInput]);

  useEffect(() => {
    parseVoiceTranscriptRef.current = parseVoiceTranscript;
  }, [parseVoiceTranscript]);

  const clearVoiceDraft = useCallback(() => {
    setVoiceParse(null);
    setVoiceParseLatencyMs(null);
    setTranscriptInput('');
    setRecognitionState('idle');
  }, []);

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
        const normalizedTranscript = transcript.trim();
        if (!normalizedTranscript) {
          setRecognitionState('error');
          setMessage('No speech recognized. Please try again or use keyboard dictation.');
          return;
        }

        setTranscriptInput(normalizedTranscript);
        setMessage('Speech recognized on device. Parsing expense...');
        void parseVoiceTranscriptRef.current(normalizedTranscript);
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

  const confirmVoiceExpense = useCallback(async (overrides?: ExpenseConfirmOverrides) => {
    if (!voiceParse) {
      return;
    }

    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const merchantText = overrides?.merchantText?.trim() || voiceParse.candidate.merchantText;
      const areaText = overrides?.areaText?.trim() || undefined;
      await confirmExpense(normalizeBaseUrl(apiBaseUrl), token, {
        ...voiceParse.candidate,
        merchantText,
        areaText,
        locationLat: overrides?.locationLat,
        locationLng: overrides?.locationLng,
        transactionAt: new Date().toISOString(),
        confidence: 0.82,
        rawPayload: {
          transcript: voiceParse.transcript,
          sttConfidence: voiceParse.sttConfidence,
          parsePath: voiceParse.parseMeta.parsePath,
          parseLatencyMs: voiceParse.parseMeta.parseLatencyMs,
        },
      });
      clearVoiceDraft();
      setMessage('Voice expense saved.');
    });
  }, [apiBaseUrl, clearVoiceDraft, getBearerTokenOrThrow, runTask, voiceParse]);

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
          kind: 'document',
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

  const confirmReceiptExpense = useCallback(async (overrides?: ExpenseConfirmOverrides) => {
    if (!receiptParse) {
      return;
    }

    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const merchantText = overrides?.merchantText?.trim() || receiptParse.candidate.merchantText;
      const areaText = overrides?.areaText?.trim() || undefined;
      await confirmExpense(normalizeBaseUrl(apiBaseUrl), token, {
        ...receiptParse.candidate,
        merchantText,
        areaText,
        locationLat: overrides?.locationLat,
        locationLng: overrides?.locationLng,
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

  const chooseDocuments = useCallback(
    async (fromCamera: boolean, allowMultiple: boolean) => {
      clearMessage();
      try {
        const pickedAssets = await pickImageAssets(fromCamera, allowMultiple && !fromCamera);
        if (pickedAssets.length === 0) {
          return;
        }

        const invalid = pickedAssets.find((asset) => !asset.base64);
        if (invalid) {
          throw new Error('Could not read one or more selected images as base64.');
        }

        const token = await getBearerTokenOrThrow();
        const uploadedRefs: string[] = [];

        for (const asset of pickedAssets) {
          const mimeType = asset.mimeType ?? 'image/jpeg';
          const uploaded = await uploadArtifact(normalizeBaseUrl(apiBaseUrl), token, {
            kind: 'document',
            mimeType,
            fileBase64: asset.base64 as string,
          });
          uploadedRefs.push(uploaded.fileRef);
        }

        setDocumentUris(pickedAssets.map((asset) => asset.uri));
        setDocumentBase64s(pickedAssets.map((asset) => asset.base64 as string));
        setDocumentMimeType(pickedAssets[0]?.mimeType ?? 'image/jpeg');
        setDocumentFileRefs(uploadedRefs);
        setDocumentParse(null);
        setMessage(
          `${pickedAssets.length} image${pickedAssets.length === 1 ? '' : 's'} selected. Parse to detect receipt or flyer.`,
        );
      } catch (error) {
        setMessage(errorToMessage(error));
      }
    },
    [apiBaseUrl, clearMessage, getBearerTokenOrThrow],
  );

  const pickDocumentCamera = useCallback(async () => {
    await chooseDocuments(true, false);
  }, [chooseDocuments]);

  const pickDocumentGallery = useCallback(async () => {
    await chooseDocuments(false, true);
  }, [chooseDocuments]);

  const parseSelectedDocument = useCallback(async () => {
    await runTask(async () => {
      if (documentFileRefs.length === 0 && documentBase64s.length === 0) {
        throw new Error('Select one or more images first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await parseDocument(normalizeBaseUrl(apiBaseUrl), token, {
        fileRefs: documentFileRefs,
        imageBase64s: documentBase64s,
        mimeType: documentMimeType,
      });
      setDocumentParse(result);

      if (result.documentKind === 'receipt') {
        setMessage('Detected receipt. Review and confirm to save expense.');
      } else if (result.documentKind === 'flyer') {
        setMessage('Detected flyer/booklet. Review and confirm to save promo prices.');
      } else {
        setMessage(result.reason);
      }
    });
  }, [apiBaseUrl, documentBase64s, documentFileRefs, documentMimeType, getBearerTokenOrThrow, runTask]);

  const clearParsedDocument = useCallback(() => {
    setDocumentUris([]);
    setDocumentBase64s([]);
    setDocumentFileRefs([]);
    setDocumentParse(null);
  }, []);

  const confirmParsedDocument = useCallback(async (overrides?: ExpenseConfirmOverrides) => {
    await runTask(async () => {
      if (!documentParse) {
        throw new Error('Parse a document first.');
      }

      const token = await getBearerTokenOrThrow();

      if (documentParse.documentKind === 'receipt') {
        const merchantText = overrides?.merchantText?.trim() || documentParse.candidate.merchantText;
        const areaText = overrides?.areaText?.trim() || undefined;
        await confirmExpense(normalizeBaseUrl(apiBaseUrl), token, {
          ...documentParse.candidate,
          merchantText,
          areaText,
          locationLat: overrides?.locationLat,
          locationLng: overrides?.locationLng,
          currency: documentParse.candidate.currency,
          confidence: documentParse.confidence,
          rawPayload: {
            parsePath: documentParse.parseMeta.parsePath,
            parseLatencyMs: documentParse.parseMeta.parseLatencyMs,
            localDocumentUris: documentUris,
          },
          receipt: {
            fileRef: documentFileRefs[0] || 'local://receipt-not-uploaded',
            mimeType: documentMimeType,
            parsedPayload: documentParse.candidate,
            ocrRaw: {
              source: 'document_llm',
              fileRefs: documentFileRefs,
            },
            confidence: documentParse.confidence,
          },
        });
        setMessage('Receipt expense saved.');
        clearParsedDocument();
        return;
      }

      if (documentParse.documentKind === 'flyer') {
        const result = await confirmPromoIngestion(normalizeBaseUrl(apiBaseUrl), token, {
          fileRefs: documentFileRefs,
          mimeType: documentMimeType,
          merchantText: documentParse.candidate.merchantText,
          areaText: documentParse.candidate.areaText,
          note: documentParse.candidate.note,
          validFrom: documentParse.candidate.validFrom,
          validTo: documentParse.candidate.validTo,
          currency: documentParse.candidate.currency,
          lineItems: documentParse.candidate.lineItems,
        });
        setPromoIngestionResult(result);
        setMessage('Flyer prices saved.');
        clearParsedDocument();
        return;
      }

      throw new Error(documentParse.reason || 'Document could not be classified.');
    });
  }, [
    apiBaseUrl,
    clearParsedDocument,
    documentFileRefs,
    documentMimeType,
    documentParse,
    documentUris,
    getBearerTokenOrThrow,
    runTask,
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

  const loadFamiliesList = useCallback(async () => {
    await runTask(async () => {
      const token = await getBearerTokenOrThrow();
      const result = await listFamilies(normalizeBaseUrl(apiBaseUrl), token);
      setFamilies(result.items);
      if (result.items.length > 0) {
        const hasActive = result.items.some((item) => item.id === activeFamilyId);
        if (!hasActive) {
          setActiveFamilyId(result.items[0]?.id ?? '');
        }
      }
      setMessage(`Loaded ${result.items.length} families.`);
    });
  }, [activeFamilyId, apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const createFamilyProfile = useCallback(async () => {
    await runTask(async () => {
      if (!familyNameInput.trim()) {
        throw new Error('Enter a family name first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await createFamily(normalizeBaseUrl(apiBaseUrl), token, {
        name: familyNameInput.trim(),
      });
      setFamilies((previous) => [result.family, ...previous.filter((item) => item.id !== result.family.id)]);
      setActiveFamilyId(result.family.id);
      setFamilyNameInput('');
      setMessage(`Family created: ${result.family.name}`);
    });
  }, [apiBaseUrl, familyNameInput, getBearerTokenOrThrow, runTask]);

  const createActiveFamilyInvite = useCallback(async () => {
    await runTask(async () => {
      if (!activeFamilyId) {
        throw new Error('Select an active family first.');
      }
      const token = await getBearerTokenOrThrow();
      const result = await createFamilyInvite(normalizeBaseUrl(apiBaseUrl), token, activeFamilyId);
      setFamilyInviteLatestCode(result.invite.code);
      setMessage(`Invite code created: ${result.invite.code}`);
      const refreshed = await listFamilies(normalizeBaseUrl(apiBaseUrl), token);
      setFamilies(refreshed.items);
    });
  }, [activeFamilyId, apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const joinFamilyByInviteCode = useCallback(async () => {
    await runTask(async () => {
      if (!familyInviteCodeInput.trim()) {
        throw new Error('Enter invite code first.');
      }
      const token = await getBearerTokenOrThrow();
      const result = await joinFamilyByCode(normalizeBaseUrl(apiBaseUrl), token, {
        code: familyInviteCodeInput.trim().toUpperCase(),
      });
      setFamilyInviteCodeInput('');
      setFamilies((previous) => [
        result.family,
        ...previous.filter((item) => item.id !== result.family.id),
      ]);
      setActiveFamilyId(result.family.id);
      setMessage(`Joined family: ${result.family.name}`);
    });
  }, [apiBaseUrl, familyInviteCodeInput, getBearerTokenOrThrow, runTask]);

  const updateFamilyMemberRoleById = useCallback(
    async (memberId: string, role: FamilyRole) => {
      await runTask(async () => {
        if (!activeFamilyId || !memberId.trim()) {
          throw new Error('Provide active family and member.');
        }
        const token = await getBearerTokenOrThrow();
        await updateFamilyMemberRole(
          normalizeBaseUrl(apiBaseUrl),
          token,
          activeFamilyId,
          memberId.trim(),
          { role },
        );
        const refreshed = await listFamilies(normalizeBaseUrl(apiBaseUrl), token);
        setFamilies(refreshed.items);
        setMessage('Family member role updated.');
      });
    },
    [activeFamilyId, apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const removeFamilyMemberById = useCallback(
    async (memberId: string) => {
      await runTask(async () => {
        if (!activeFamilyId || !memberId.trim()) {
          throw new Error('Provide active family and member.');
        }
        const token = await getBearerTokenOrThrow();
        await removeFamilyMember(
          normalizeBaseUrl(apiBaseUrl),
          token,
          activeFamilyId,
          memberId.trim(),
        );
        const refreshed = await listFamilies(normalizeBaseUrl(apiBaseUrl), token);
        setFamilies(refreshed.items);
        setMessage('Family member removed.');
      });
    },
    [activeFamilyId, apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const updateFamilyMemberRoleAction = useCallback(async () => {
    await updateFamilyMemberRoleById(familyMemberIdInput, familyRoleTarget);
  }, [familyMemberIdInput, familyRoleTarget, updateFamilyMemberRoleById]);

  const removeFamilyMemberAction = useCallback(async () => {
    await removeFamilyMemberById(familyMemberIdInput);
  }, [familyMemberIdInput, removeFamilyMemberById]);

  const createSplitDraft = useCallback(
    async (input: {
      familyId: string;
      expenseId?: string;
      title?: string;
      sharedCharge?: number;
      participantFamilyMemberIds?: string[];
      guestParticipants?: string[];
    }) => {
      await runTask(async () => {
        if (!input.familyId) {
          throw new Error('Select a family first.');
        }

        const token = await getBearerTokenOrThrow();
        const result = await createSplit(normalizeBaseUrl(apiBaseUrl), token, {
          familyId: input.familyId,
          expenseId: input.expenseId,
          title: input.title,
          sharedCharge: input.sharedCharge ?? 0,
          participantFamilyMemberIds: input.participantFamilyMemberIds ?? [],
          guestParticipants: input.guestParticipants ?? [],
        });
        setSplitDetail(result);
        setActiveSplitId(result.split.id);
        setSplitBalanceSummary(null);
        setMessage(`Split created: ${result.split.id}`);
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const loadSplitDetailById = useCallback(
    async (splitId: string) => {
      await runTask(async () => {
        if (!splitId.trim()) {
          throw new Error('Provide split ID.');
        }
        const token = await getBearerTokenOrThrow();
        const result = await getSplit(normalizeBaseUrl(apiBaseUrl), token, splitId.trim());
        setActiveSplitId(result.split.id);
        setSplitDetail(result);
        setMessage('Split detail loaded.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const updateSplitParticipantsById = useCallback(
    async (
      splitId: string,
      participants: Array<{
        familyMemberId?: string;
        displayName?: string;
        isPayer?: boolean;
        paidAmount?: number;
      }>,
    ) => {
      await runTask(async () => {
        if (!splitId.trim()) {
          throw new Error('Provide split ID.');
        }
        if (participants.length === 0) {
          throw new Error('At least one participant is required.');
        }
        const token = await getBearerTokenOrThrow();
        const result = await updateSplitParticipants(normalizeBaseUrl(apiBaseUrl), token, splitId, {
          participants,
        });
        setActiveSplitId(result.split.id);
        setSplitDetail(result);
        setMessage('Split participants saved.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const updateSplitAllocationsById = useCallback(
    async (
      splitId: string,
      input: {
        lineAssignments: Array<{
          expenseLineItemId: string;
          participantIds: string[];
        }>;
        sharedCharge?: number;
      },
    ) => {
      await runTask(async () => {
        if (!splitId.trim()) {
          throw new Error('Provide split ID.');
        }
        const token = await getBearerTokenOrThrow();
        const result = await updateSplitAllocations(normalizeBaseUrl(apiBaseUrl), token, splitId, input);
        setActiveSplitId(result.split.id);
        setSplitDetail(result);
        setMessage('Split allocations saved.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const finalizeSplitById = useCallback(
    async (splitId: string) => {
      await runTask(async () => {
        if (!splitId.trim()) {
          throw new Error('Provide split ID.');
        }
        const token = await getBearerTokenOrThrow();
        const result = await finalizeSplit(normalizeBaseUrl(apiBaseUrl), token, splitId);
        setActiveSplitId(result.split.id);
        setSplitDetail(result);
        setMessage('Split finalized.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const loadSplitBalancesById = useCallback(
    async (splitId: string) => {
      await runTask(async () => {
        if (!splitId.trim()) {
          throw new Error('Provide split ID.');
        }
        const token = await getBearerTokenOrThrow();
        const result = await getSplitBalances(normalizeBaseUrl(apiBaseUrl), token, splitId);
        setActiveSplitId(result.splitId);
        setSplitBalanceSummary({
          splitId: result.splitId,
          status: result.status,
          balances: result.balances,
          settlements: result.settlements,
        });
        setMessage('Split balances loaded.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

  const createSplitSessionAction = useCallback(async () => {
    await createSplitDraft({
      familyId: activeFamilyId,
      expenseId: splitExpenseIdInput.trim() || undefined,
      title: splitTitleInput.trim() || undefined,
      sharedCharge: parseNumberInput(splitSharedChargeInput) ?? 0,
      participantFamilyMemberIds: parseCsvList(splitParticipantMemberIdsInput),
      guestParticipants: parseCsvList(splitParticipantGuestNamesInput),
    });
  }, [
    activeFamilyId,
    createSplitDraft,
    splitExpenseIdInput,
    splitParticipantGuestNamesInput,
    splitParticipantMemberIdsInput,
    splitSharedChargeInput,
    splitTitleInput,
  ]);

  const loadSplitSessions = useCallback(async () => {
    await runTask(async () => {
      if (!activeFamilyId) {
        throw new Error('Select an active family first.');
      }
      const token = await getBearerTokenOrThrow();
      const result = await listSplits(normalizeBaseUrl(apiBaseUrl), token, {
        familyId: activeFamilyId,
        limit: 20,
      });
      setSplitSummaries(result.items);
      if (result.items.length > 0 && !activeSplitId) {
        setActiveSplitId(result.items[0]?.id ?? '');
      }
      setMessage(`Loaded ${result.items.length} split sessions.`);
    });
  }, [activeFamilyId, activeSplitId, apiBaseUrl, getBearerTokenOrThrow, runTask]);

  const loadActiveSplitDetail = useCallback(async () => {
    await loadSplitDetailById(activeSplitId);
  }, [activeSplitId, loadSplitDetailById]);

  const saveSplitParticipantsAction = useCallback(async () => {
    await runTask(async () => {
      if (!activeSplitId.trim()) {
        throw new Error('Provide active split ID.');
      }
      const memberIds = parseCsvList(splitParticipantMemberIdsInput);
      const guestNames = parseCsvList(splitParticipantGuestNamesInput);
      const fallbackTotal = splitDetail?.split.totalAmount ?? 0;

      const participants = [
        ...memberIds.map((familyMemberId) => ({
          familyMemberId,
          isPayer: false,
          paidAmount: 0,
        })),
        ...guestNames.map((displayName) => ({
          displayName,
          isPayer: false,
          paidAmount: 0,
        })),
      ];

      if (participants.length === 0) {
        throw new Error('Provide participant member IDs or guest names.');
      }

      const targetPayer = splitPayerParticipantIdInput.trim();
      if (targetPayer) {
        for (const participant of participants) {
          if ('familyMemberId' in participant && participant.familyMemberId === targetPayer) {
            participant.isPayer = true;
            participant.paidAmount = fallbackTotal;
          }
        }
      }

      if (!participants.some((participant) => participant.isPayer)) {
        participants[0] = {
          ...participants[0],
          isPayer: true,
          paidAmount: fallbackTotal,
        };
      }

      await updateSplitParticipantsById(activeSplitId, participants);
    });
  }, [
    activeSplitId,
    runTask,
    splitDetail?.split.totalAmount,
    splitParticipantGuestNamesInput,
    splitParticipantMemberIdsInput,
    splitPayerParticipantIdInput,
    updateSplitParticipantsById,
  ]);

  const saveSplitAllocationsAction = useCallback(async () => {
    await runTask(async () => {
      if (!activeSplitId.trim()) {
        throw new Error('Provide active split ID.');
      }
      const lineAssignments = parseLineAssignments(splitAssignmentsInput);
      await updateSplitAllocationsById(activeSplitId, {
        lineAssignments,
        sharedCharge: parseNumberInput(splitSharedChargeInput),
      });
    });
  }, [
    activeSplitId,
    runTask,
    splitAssignmentsInput,
    splitSharedChargeInput,
    updateSplitAllocationsById,
  ]);

  const finalizeActiveSplit = useCallback(async () => {
    await finalizeSplitById(activeSplitId);
  }, [activeSplitId, finalizeSplitById]);

  const loadActiveSplitBalances = useCallback(async () => {
    await loadSplitBalancesById(activeSplitId);
  }, [activeSplitId, loadSplitBalancesById]);

  const loadPriceCompareResult = useCallback(async () => {
    await runTask(async () => {
      if (!priceQueryItem.trim()) {
        throw new Error('Enter an item name first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await loadPriceCompare(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        area: priceQueryLocation.areaText.trim() || undefined,
        lat: parseNumberInput(priceQueryLocation.latText),
        lng: parseNumberInput(priceQueryLocation.lngText),
        radiusKm: parseNumberInput(priceQueryLocation.radiusKmText),
        limit: 10,
        includePromo,
      });

      setPriceCompareResult(result);
      await loadSubscription();
      setMessage('Loaded price comparison.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    includePromo,
    loadSubscription,
    priceQueryItem,
    priceQueryLocation,
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
        area: priceQueryLocation.areaText.trim() || undefined,
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
    priceQueryItem,
    priceQueryLocation,
    runTask,
  ]);

  const loadPriceSignalResult = useCallback(async () => {
    await runTask(async () => {
      if (!priceQueryItem.trim()) {
        throw new Error('Enter an item name first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await loadPriceSignal(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        areaText: priceQueryLocation.areaText.trim() || undefined,
        lat: parseNumberInput(priceQueryLocation.latText),
        lng: parseNumberInput(priceQueryLocation.lngText),
        radiusKm: parseNumberInput(priceQueryLocation.radiusKmText),
        horizonDays: 7,
        includePromo,
      });

      setPriceSignalResult(result);
      setMessage('Loaded buy vs wait signal.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    includePromo,
    priceQueryItem,
    priceQueryLocation,
    runTask,
  ]);

  const createAlert = useCallback(async () => {
    await runTask(async () => {
      if (!alertItem.trim()) {
        throw new Error('Provide an item name first.');
      }

      const token = await getBearerTokenOrThrow();
      const baseInput = {
        item: alertItem.trim(),
        radiusKm: parseNumberInput(alertRadiusKm),
        areaText: alertAreaText.trim() || undefined,
      };

      const result =
        alertKind === 'SIGNAL'
          ? await createPriceAlert(normalizeBaseUrl(apiBaseUrl), token, {
              ...baseInput,
              kind: 'SIGNAL',
              signalDecisionFilter: alertSignalDecisionFilter,
              signalMinConfidence:
                parseNumberInput(alertSignalMinConfidence) ?? 0.65,
            })
          : await createPriceAlert(normalizeBaseUrl(apiBaseUrl), token, {
              ...baseInput,
              kind: 'THRESHOLD',
              targetUnitPrice: (() => {
                const parsed = parseNumberInput(alertTargetUnitPrice);
                if (typeof parsed !== 'number') {
                  throw new Error('Provide a valid target unit price.');
                }
                return parsed;
              })(),
            });

      setAlerts((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      await loadSubscription();
      setMessage(
        alertKind === 'SIGNAL'
          ? 'Signal alert created.'
          : 'Price alert created.',
      );
    });
  }, [
    alertAreaText,
    alertKind,
    alertItem,
    alertRadiusKm,
    alertSignalDecisionFilter,
    alertSignalMinConfidence,
    alertTargetUnitPrice,
    apiBaseUrl,
    getBearerTokenOrThrow,
    loadSubscription,
    runTask,
  ]);

  const createSignalAlertFromPriceQuery = useCallback(async () => {
    await runTask(async () => {
      if (!priceQueryItem.trim()) {
        throw new Error('Enter an item name first.');
      }

      const token = await getBearerTokenOrThrow();
      const result = await createPriceAlert(normalizeBaseUrl(apiBaseUrl), token, {
        item: priceQueryItem.trim(),
        kind: 'SIGNAL',
        signalDecisionFilter: 'BOTH',
        signalMinConfidence: 0.65,
        radiusKm: parseNumberInput(priceQueryLocation.radiusKmText),
        areaText: priceQueryLocation.areaText.trim() || undefined,
      });
      setAlerts((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      await loadSubscription();
      setMessage('Signal watch created from current query.');
    });
  }, [
    apiBaseUrl,
    getBearerTokenOrThrow,
    loadSubscription,
    priceQueryItem,
    priceQueryLocation,
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

  const markEventRead = useCallback(
    async (eventId: string) => {
      await runTask(async () => {
        const token = await getBearerTokenOrThrow();
        const response = await markAlertEventRead(
          normalizeBaseUrl(apiBaseUrl),
          token,
          eventId,
        );

        let decremented = false;
        setAlertEvents((previous) =>
          previous.map((event) => {
            if (event.id !== eventId) {
              return event;
            }
            if (event.readAt === null) {
              decremented = true;
            }
            return { ...event, readAt: response.readAt ?? new Date().toISOString() };
          }),
        );
        if (decremented) {
          setAlertUnreadCount((previous) => Math.max(0, previous - 1));
        }
        setMessage('Alert event marked as read.');
      });
    },
    [apiBaseUrl, getBearerTokenOrThrow, runTask],
  );

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
          kind: 'document',
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
      authSyncStatus,
      authSyncError,
      backendLiveHealth,
      backendReadyHealth,
      backendHealthCheckedAt,
      pushStatus,
      pushTokenPreview: pushToken ? `${pushToken.slice(0, 18)}...${pushToken.slice(-6)}` : '-',
      pushDevices,

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
      documentReady: documentFileRefs.length > 0 || documentUris.length > 0,
      documentImageCount: Math.max(documentFileRefs.length, documentUris.length),
      documentParse,

      ledgerItems,
      ledgerTotal: ledgerItems.reduce((acc, item) => acc + item.totalAmount, 0),
      reportSummary,
      subscription,

      families,
      activeFamilyId,
      setActiveFamilyId,
      familyNameInput,
      setFamilyNameInput,
      familyInviteCodeInput,
      setFamilyInviteCodeInput,
      familyInviteLatestCode,
      familyRoleTarget,
      setFamilyRoleTarget,
      familyMemberIdInput,
      setFamilyMemberIdInput,

      splitExpenseIdInput,
      setSplitExpenseIdInput,
      splitTitleInput,
      setSplitTitleInput,
      splitSharedChargeInput,
      setSplitSharedChargeInput,
      splitParticipantMemberIdsInput,
      setSplitParticipantMemberIdsInput,
      splitParticipantGuestNamesInput,
      setSplitParticipantGuestNamesInput,
      splitPayerParticipantIdInput,
      setSplitPayerParticipantIdInput,
      splitAssignmentsInput,
      setSplitAssignmentsInput,
      splitSummaries,
      splitDetail,
      splitBalanceSummary,
      activeSplitId,
      setActiveSplitId,

      priceQueryItem,
      setPriceQueryItem,
      priceQueryLocation,
      updatePriceQueryLocation,
      applyDetectedPriceQueryLocation,
      selectPriceQueryLocation,
      priceHistoryInterval,
      setPriceHistoryInterval,
      includePromo,
      setIncludePromo,
      priceCompareResult,
      priceHistoryResult,
      priceSignalResult,

      alertItem,
      setAlertItem,
      alertKind,
      setAlertKind,
      alertTargetUnitPrice,
      setAlertTargetUnitPrice,
      alertSignalDecisionFilter,
      setAlertSignalDecisionFilter,
      alertSignalMinConfidence,
      setAlertSignalMinConfidence,
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
      checkBackendHealth,
      loadSubscription,
      loadPushDevices,
      revokeCurrentPushDevice,
      signOutUser,
      updateSubscriptionPlan,

      startListening,
      stopListening,
      parseVoiceExpense,
      confirmVoiceExpense,

      pickReceiptCamera,
      pickReceiptGallery,
      parseReceiptExpense,
      confirmReceiptExpense,
      pickDocumentCamera,
      pickDocumentGallery,
      parseSelectedDocument,
      confirmParsedDocument,
      clearParsedDocument,

      loadLedger,
      loadReport,

      createFamilyProfile,
      loadFamiliesList,
      createActiveFamilyInvite,
      joinFamilyByInviteCode,
      updateFamilyMemberRoleById,
      removeFamilyMemberById,
      updateFamilyMemberRoleAction,
      removeFamilyMemberAction,

      createSplitDraft,
      loadSplitDetailById,
      updateSplitParticipantsById,
      updateSplitAllocationsById,
      finalizeSplitById,
      loadSplitBalancesById,
      createSplitSessionAction,
      loadSplitSessions,
      loadActiveSplitDetail,
      saveSplitParticipantsAction,
      saveSplitAllocationsAction,
      finalizeActiveSplit,
      loadActiveSplitBalances,

      loadPriceCompareResult,
      loadPriceHistoryResult,
      loadPriceSignalResult,

      createAlert,
      createSignalAlertFromPriceQuery,
      loadAlerts,
      loadAlertEvents,
      markEventRead,
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
      alertKind,
      alertItem,
      alertRadiusKm,
      alertSignalDecisionFilter,
      alertSignalMinConfidence,
      alertTargetUnitPrice,
      alertUnreadCount,
      alerts,
      activeFamilyId,
      activeSplitId,
      apiBaseUrl,
      authSyncError,
      authSyncStatus,
      backendUserId,
      backendHealthCheckedAt,
      backendLiveHealth,
      backendReadyHealth,
      checkBackendHealth,
      clearMessage,
      clearParsedDocument,
      confirmParsedDocument,
      confirmReceiptExpense,
      confirmVoiceExpense,
      createAlert,
      createSignalAlertFromPriceQuery,
      createActiveFamilyInvite,
      createFamilyProfile,
      createSplitSessionAction,
      documentFileRefs,
      documentParse,
      documentUris,
      formatCurrency,
      families,
      familyInviteCodeInput,
      familyInviteLatestCode,
      familyMemberIdInput,
      familyNameInput,
      familyRoleTarget,
      finalizeActiveSplit,
      includePromo,
      ingestPromoFile,
      joinFamilyByInviteCode,
      ledgerItems,
      loadActiveSplitBalances,
      loadActiveSplitDetail,
      loadAlertEvents,
      loadAlerts,
      loadFamiliesList,
      loadLedger,
      loadPriceCompareResult,
      loadPriceHistoryResult,
      loadPriceSignalResult,
      loadPromos,
      loadReport,
      loadSubscription,
      loadSplitSessions,
      loading,
      markEventRead,
      markAllEventsRead,
      message,
      parseReceiptExpense,
      parseSelectedDocument,
      parseVoiceExpense,
      pickDocumentCamera,
      pickDocumentGallery,
      pickPromoCamera,
      pickPromoGallery,
      pickReceiptCamera,
      pickReceiptGallery,
      priceCompareResult,
      priceHistoryInterval,
      priceHistoryResult,
      priceSignalResult,
      priceQueryItem,
      priceQueryLocation,
      promoAreaHint,
      promoBase64,
      promoFileRef,
      promoIngestionResult,
      promoItems,
      promoMerchantHint,
      promoUri,
      pushDevices,
      loadPushDevices,
      pushStatus,
      pushToken,
      revokeCurrentPushDevice,
      receiptParse,
      receiptParseLatencyMs,
      recognitionState,
      recognizerAvailable,
      reportSummary,
      subscription,
      removeFamilyMemberAction,
      saveSplitAllocationsAction,
      saveSplitParticipantsAction,
      selectedReceiptBase64,
      selectedReceiptFileRef,
      selectedReceiptUri,
      setAlertAreaText,
      setAlertItem,
      setAlertRadiusKm,
      setAlertTargetUnitPrice,
      setActiveFamilyId,
      setActiveSplitId,
      setApiBaseUrl,
      setFamilyInviteCodeInput,
      setFamilyMemberIdInput,
      setFamilyNameInput,
      setFamilyRoleTarget,
      setIncludePromo,
      setPriceHistoryInterval,
      setPriceQueryItem,
      updatePriceQueryLocation,
      applyDetectedPriceQueryLocation,
      selectPriceQueryLocation,
      setPromoAreaHint,
      setPromoMerchantHint,
      setSplitAssignmentsInput,
      setSplitExpenseIdInput,
      setSplitParticipantGuestNamesInput,
      setSplitParticipantMemberIdsInput,
      setSplitPayerParticipantIdInput,
      setSplitSharedChargeInput,
      setSplitTitleInput,
      setTranscriptInput,
      signOutUser,
      signedInEmail,
      startListening,
      stopListening,
      syncBackendUser,
      transcriptInput,
      splitAssignmentsInput,
      splitBalanceSummary,
      splitDetail,
      splitExpenseIdInput,
      splitParticipantGuestNamesInput,
      splitParticipantMemberIdsInput,
      splitPayerParticipantIdInput,
      splitSharedChargeInput,
      splitSummaries,
      splitTitleInput,
      updateFamilyMemberRoleAction,
      updateSubscriptionPlan,
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
