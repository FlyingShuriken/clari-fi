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
  mockText?: string;
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
  totalPrice: number;
  confidence?: number;
}

export interface ParsedExpenseResult {
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
  lineItems: ParsedLineItem[];
  confidenceMap: Record<string, number>;
}

export interface ParsedReceiptResult {
  merchantText?: string;
  receiptDate?: string;
  totalAmount: number;
  currency: 'MYR' | 'SGD' | 'USD';
  lineItems: ParsedLineItem[];
  confidenceMap: Record<string, number>;
}

export interface SttProvider {
  transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
}

export interface OcrProvider {
  extract(input: OcrExtractInput): Promise<OcrExtractResult>;
}

export interface ExpenseParserProvider {
  parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult>;
  parseReceipt(rawText: string): Promise<ParsedReceiptResult>;
}

export const STT_PROVIDER = Symbol('STT_PROVIDER');
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
export const EXPENSE_PARSER_PROVIDER = Symbol('EXPENSE_PARSER_PROVIDER');
