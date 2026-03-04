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

export type ObservationSource = 'EXPENSE' | 'PROMO';

export interface PriceAlert {
  id: string;
  item: {
    id: string;
    canonicalName: string;
    canonicalUnit?: string | null;
  };
  targetUnitPrice: number;
  radiusKm: number;
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
  item: string;
  source: ObservationSource;
  triggerUnitPrice: number;
  targetUnitPrice: number;
  distanceKm?: number;
  storeId?: string;
  storeName?: string;
  areaText?: string;
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
