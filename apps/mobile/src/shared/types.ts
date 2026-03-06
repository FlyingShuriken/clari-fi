export interface AuthVerifyResponse {
  user: {
    id: string;
    email: string;
    clerkUserId: string;
  };
}

export interface VoiceParseResult {
  transcript: string;
  sttConfidence: number;
  candidate: {
    source: 'VOICE';
    provenance: 'VOICE_ON_DEVICE' | 'VOICE_CLOUD';
    currency: 'MYR' | 'SGD' | 'USD';
    transactionAt: string;
    parseLatencyMs?: number;
    merchantText?: string;
    note?: string;
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
      quantity?: number;
      unitRaw?: string;
      unitPrice?: number;
      totalPrice: number;
      confidence?: number;
    }>;
  };
  confidenceMap: Record<string, number>;
  parseMeta: {
    parsePath: string;
    parseLatencyMs: number;
    parserEngine?: 'heuristic' | 'openrouter';
    fallbackUsed?: boolean;
    shadowCompared?: boolean;
    shadowMismatchFields?: string[];
  };
}

export interface ReceiptParseResult {
  candidate: {
    source: 'RECEIPT';
    provenance: 'RECEIPT_OCR';
    merchantText?: string;
    note?: string;
    totalAmount: number;
    transactionAt: string;
    currency: 'MYR' | 'SGD' | 'USD';
    lineItems: Array<{
      descriptionRaw: string;
      quantity?: number;
      unitRaw?: string;
      unitPrice?: number;
      totalPrice: number;
      confidence?: number;
    }>;
  };
  fileRef?: string;
  rawPayload: Record<string, unknown>;
  parseMeta: {
    parsePath: string;
    parseLatencyMs: number;
    parserEngine?: 'heuristic' | 'openrouter';
    fallbackUsed?: boolean;
    shadowCompared?: boolean;
    shadowMismatchFields?: string[];
  };
}

export interface UploadArtifactResponse {
  fileRef: string;
  storageProvider: 'supabase' | 'local';
  publicUrl?: string;
}

export interface PriceHistoryPoint {
  bucket: string;
  minUnitPrice: number;
  avgUnitPrice: number;
  maxUnitPrice: number;
  sampleSize: number;
}

export interface PriceHistoryResponse {
  item: {
    id: string;
    canonicalName: string;
    canonicalUnit?: string | null;
  } | null;
  interval: 'day' | 'week';
  totalObservations: number;
  points: PriceHistoryPoint[];
  generatedAt: string;
  userId: string;
  includePromo?: boolean;
}

export interface PriceCompareRow {
  storeId?: string;
  storeName?: string;
  areaText?: string;
  latestUnitPrice: number;
  averageUnitPrice: number;
  averageTrustScore: number;
  sampleSize: number;
  lastObservedAt: string;
  distanceKm?: number;
}

export interface PriceCompareResponse {
  item: {
    id: string;
    canonicalName: string;
    canonicalUnit?: string | null;
  } | null;
  radiusKm?: number;
  rows: PriceCompareRow[];
  generatedAt: string;
  userId: string;
  includePromo?: boolean;
}

export type PriceSignalDecision = 'BUY_NOW' | 'WAIT' | 'NEUTRAL';

export interface PriceSignalReason {
  code: string;
  label: string;
  value: number;
  weight: number;
}

export interface PriceSignalResponse {
  item: {
    id: string;
    canonicalName: string;
    canonicalUnit?: string | null;
  } | null;
  decision: PriceSignalDecision;
  confidence: number;
  expectedDeltaPct: number;
  horizonDays: number;
  sampleSize: number;
  reasons: PriceSignalReason[];
  diagnostics: {
    score: number;
    latestUnitPrice: number;
    avg7d: number;
    avg30d: number;
    trendSlope7d: number;
    volatility30d: number;
    sampleSize30d: number;
    distinctDays30d: number;
    promoBestUnitPrice?: number;
    gatedNeutral: boolean;
    gateReason?: 'LOW_DATA' | 'LOW_CONFIDENCE';
  };
  generatedAt: string;
  userId: string;
  includePromo?: boolean;
}

export type ObservationSource = 'EXPENSE' | 'PROMO';
export type AlertKind = 'THRESHOLD' | 'SIGNAL';
export type SignalDecisionFilter = 'BUY_NOW' | 'WAIT' | 'BOTH';

export interface PriceAlert {
  id: string;
  item: {
    id: string;
    canonicalName: string;
    canonicalUnit?: string | null;
  };
  kind: AlertKind;
  targetUnitPrice?: number;
  radiusKm: number;
  signalDecisionFilter?: SignalDecisionFilter;
  signalMinConfidence?: number;
  signalCooldownMinutes?: number;
  active: boolean;
  areaText?: string;
  storeId?: string;
  storeName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  eventKind: AlertKind;
  item: string;
  source: ObservationSource;
  triggerUnitPrice: number;
  targetUnitPrice?: number;
  distanceKm?: number;
  storeId?: string;
  storeName?: string;
  areaText?: string;
  signal?: {
    decision: PriceSignalDecision;
    confidence?: number;
    expectedDeltaPct?: number;
  };
  triggeredAt: string;
  readAt: string | null;
  deliveryStatus?: 'SENT' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | 'DISABLED';
  notificationSentAt?: string | null;
  pushAttempted?: number;
}

export interface PushDevice {
  id: string;
  expoPushToken: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export type PromoReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PromoObservation {
  id: string;
  item: string;
  reviewStatus: PromoReviewStatus;
  unitPrice: number;
  trustScore: number;
  storeId?: string;
  storeName?: string;
  areaText?: string;
  validFrom: string | null;
  validTo: string | null;
}

export interface PromoIngestionItem {
  id: string;
  fileRef: string;
  mimeType: string;
  merchantText?: string;
  areaText?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorText?: string | null;
  createdAt: string;
  observations: PromoObservation[];
}

export type FamilyRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type FamilyMemberStatus = 'ACTIVE' | 'REMOVED';
export type FamilyInviteStatus = 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';

export interface FamilyMember {
  id: string;
  userId: string;
  email: string;
  displayName?: string | null;
  role: FamilyRole;
  status: FamilyMemberStatus;
  joinedAt: string;
}

export interface FamilyInvite {
  id: string;
  code: string;
  status: FamilyInviteStatus;
  expiresAt: string;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    displayName?: string | null;
  };
}

export interface FamilyProfile {
  id: string;
  name: string;
  currentUserRole: FamilyRole | null;
  createdAt: string;
  updatedAt: string;
  members: FamilyMember[];
  invites: FamilyInvite[];
}

export interface FamilyInviteCreated {
  invite: {
    id: string;
    familyId: string;
    code: string;
    status: FamilyInviteStatus;
    expiresAt: string;
    createdAt: string;
  };
}

export interface FamilyListResponse {
  total: number;
  items: FamilyProfile[];
}

export interface SplitSummary {
  id: string;
  familyId: string;
  expenseId?: string | null;
  title?: string | null;
  currency: 'MYR' | 'SGD' | 'USD';
  subtotal: number;
  sharedCharge: number;
  totalAmount: number;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  participantCount: number;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SplitParticipant {
  id: string;
  familyMemberId?: string | null;
  userId?: string | null;
  displayName: string;
  type: 'MEMBER' | 'GUEST';
  isPayer: boolean;
  paidAmount: number;
}

export interface SplitAllocation {
  id: string;
  participantId: string;
  allocationType: 'ITEM' | 'SHARED_CHARGE';
  expenseLineItemId?: string;
  lineItemLabel?: string;
  amount: number;
}

export interface SplitBalanceRow {
  participantId: string;
  displayName: string;
  owedAmount: number;
  paidAmount: number;
  netAmount: number;
}

export interface SplitSettlement {
  id?: string;
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  status?: 'PENDING' | 'SETTLED';
  settledAt?: string | null;
  createdAt?: string;
}

export interface SplitDetailResponse {
  split: {
    id: string;
    familyId: string;
    familyName: string;
    expenseId?: string | null;
    title?: string | null;
    currency: 'MYR' | 'SGD' | 'USD';
    subtotal: number;
    sharedCharge: number;
    totalAmount: number;
    status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
    finalizedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  expenseLineItems: Array<{
    id: string;
    descriptionRaw: string;
    totalPrice: number;
    quantity?: number;
    unitRaw?: string | null;
    unitPrice?: number;
  }>;
  participants: SplitParticipant[];
  allocations: SplitAllocation[];
  balances: SplitBalanceRow[];
  settlements: SplitSettlement[];
}
