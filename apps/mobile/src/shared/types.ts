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
      confidence?: number;
    }>;
  };
  confidenceMap: Record<string, number>;
  parseMeta: {
    parsePath: string;
    parseLatencyMs: number;
  };
}

export interface ReceiptParseResult {
  candidate: {
    source: 'RECEIPT';
    provenance: 'RECEIPT_OCR';
    merchantText?: string;
    totalAmount: number;
    transactionAt: string;
    currency: 'MYR' | 'SGD' | 'USD';
    lineItems: Array<{
      descriptionRaw: string;
      totalPrice: number;
      confidence?: number;
    }>;
  };
  fileRef?: string;
  rawPayload: Record<string, unknown>;
  parseMeta: {
    parsePath: string;
    parseLatencyMs: number;
  };
}

export interface UploadArtifactResponse {
  fileRef: string;
  storageProvider: 'supabase' | 'local';
  publicUrl?: string;
}
