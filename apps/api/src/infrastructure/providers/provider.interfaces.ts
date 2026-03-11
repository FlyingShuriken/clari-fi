export interface SttTranscribeInput {
  audioBase64?: string;
  text?: string;
  locale?: string;
}

export interface SttTranscribeResult {
  transcript: string;
  confidence: number;
}

export interface OcrExtractInput {
  imageBase64?: string;
  imageUrl?: string;
}

export interface OcrExtractResult {
  rawText: string;
  confidence: number;
  rawPayload: Record<string, unknown>;
}

export interface ParsedLineItem {
  descriptionRaw: string;
  quantity?: number;
  unitRaw?: string;
  unitPrice?: number;
  totalPrice: number;
  confidence?: number;
  originalPrice?: number;
  promoText?: string;
}

export type ExpenseParserEngine = 'heuristic' | 'openrouter';

export interface ExpenseParserMeta {
  engine: ExpenseParserEngine;
  fallbackUsed?: boolean;
  shadowCompared?: boolean;
  shadowMismatchFields?: string[];
}

export interface ParsedExpenseResult {
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
  lineItems: ParsedLineItem[];
  confidenceMap: Record<string, number>;
  parserMeta?: ExpenseParserMeta;
}

export interface ParsedReceiptResult {
  merchantText?: string;
  note?: string;
  receiptDate?: string;
  totalAmount: number;
  currency: 'MYR' | 'SGD' | 'USD';
  lineItems: ParsedLineItem[];
  confidenceMap: Record<string, number>;
  parserMeta?: ExpenseParserMeta;
}

export interface ParsedFlyerResult {
  merchantText?: string;
  areaText?: string;
  note?: string;
  validFrom?: string;
  validTo?: string;
  currency: 'MYR' | 'SGD' | 'USD';
  lineItems: ParsedLineItem[];
  confidenceMap: Record<string, number>;
  parserMeta?: ExpenseParserMeta;
}

export interface DocumentImageInput {
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
}

export type ParsedImageDocumentResult =
  | {
      documentKind: 'receipt';
      confidence: number;
      receipt: ParsedReceiptResult;
    }
  | {
      documentKind: 'flyer';
      confidence: number;
      flyer: ParsedFlyerResult;
    }
  | {
      documentKind: 'unknown';
      confidence: number;
      reason?: string;
    };

export interface SttProvider {
  transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
}

export interface OcrProvider {
  extract(input: OcrExtractInput): Promise<OcrExtractResult>;
}

export interface ExpenseParserProvider {
  parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult>;
  parseReceipt(rawText: string): Promise<ParsedReceiptResult>;
  parseDocumentImages(input: {
    images: DocumentImageInput[];
    preferredKind?: 'receipt' | 'flyer';
  }): Promise<ParsedImageDocumentResult>;
}

export const STT_PROVIDER = Symbol('STT_PROVIDER');
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
export const EXPENSE_PARSER_PROVIDER = Symbol('EXPENSE_PARSER_PROVIDER');
