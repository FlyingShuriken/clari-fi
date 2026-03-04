import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExpenseParserProvider,
  ParsedExpenseResult,
  ParsedLineItem,
  ParsedReceiptResult,
} from './provider.interfaces';

type Currency = ParsedReceiptResult['currency'];
type PaymentMethod = ParsedExpenseResult['paymentMethod'];

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
}

const CURRENCY_VALUES: Currency[] = ['MYR', 'SGD', 'USD'];
const PAYMENT_METHOD_VALUES: Exclude<PaymentMethod, undefined>[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'E_WALLET',
  'TNG',
  'GRABPAY',
  'SHOPEEPAY',
  'DUITNOW',
  'OTHER',
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Number(value.toFixed(2)) : 0;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) {
      return Number(numeric.toFixed(2));
    }
  }

  return 0;
}

function asPositiveQuantity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Number(value.toFixed(4)) : 0;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) {
      return Number(numeric.toFixed(4));
    }
  }

  return 0;
}

function clampConfidence(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, Number(numeric)));
}

function normalizeCurrency(value: unknown): Currency {
  const candidate = asString(value).toUpperCase();
  if (CURRENCY_VALUES.includes(candidate as Currency)) {
    return candidate as Currency;
  }
  return 'MYR';
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const candidate = asString(value).toUpperCase();
  if (!candidate) {
    return undefined;
  }

  if (PAYMENT_METHOD_VALUES.includes(candidate as Exclude<PaymentMethod, undefined>)) {
    return candidate as Exclude<PaymentMethod, undefined>;
  }

  const lower = candidate.toLowerCase();
  if (lower.includes('touch') || lower.includes('tng')) {
    return 'TNG';
  }
  if (lower.includes('grabpay') || lower.includes('grab pay')) {
    return 'GRABPAY';
  }
  if (lower.includes('shopee')) {
    return 'SHOPEEPAY';
  }
  if (lower.includes('duitnow') || lower.includes('duit now')) {
    return 'DUITNOW';
  }
  if (lower.includes('cash')) {
    return 'CASH';
  }
  if (lower.includes('card') || lower.includes('visa') || lower.includes('master')) {
    return 'CARD';
  }
  if (
    lower.includes('wallet') ||
    lower.includes('e-wallet') ||
    lower.includes('ewallet')
  ) {
    return 'E_WALLET';
  }
  if (lower.includes('bank transfer') || lower.includes('transfer')) {
    return 'BANK_TRANSFER';
  }

  return 'OTHER';
}

function normalizeDate(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function normalizeLineItems(
  value: unknown,
  fallbackAmount: number,
  fallbackDescription: string,
): ParsedLineItem[] {
  const rawItems = Array.isArray(value) ? value : [];
  const normalized: ParsedLineItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue;
    }

    const row = rawItem as Record<string, unknown>;
    const descriptionRaw =
      asString(row.descriptionRaw) ||
      asString(row.description) ||
      asString(row.item) ||
      asString(row.name);
    const quantity = asPositiveQuantity(row.quantity);
    const unitRaw = asString(row.unitRaw ?? row.unit);
    const parsedUnitPrice = asPositiveNumber(
      row.unitPrice ?? row.perPrice ?? row.pricePerUnit ?? row.price_each,
    );
    const parsedTotalPrice = asPositiveNumber(
      row.totalPrice ?? row.price ?? row.amount ?? row.total,
    );
    const totalPrice =
      parsedTotalPrice > 0
        ? parsedTotalPrice
        : quantity > 0 && parsedUnitPrice > 0
          ? Number((quantity * parsedUnitPrice).toFixed(2))
          : 0;
    const unitPrice =
      parsedUnitPrice > 0
        ? parsedUnitPrice
        : quantity > 0 && totalPrice > 0
          ? Number((totalPrice / quantity).toFixed(2))
          : undefined;
    const confidence = clampConfidence(row.confidence, 0.72);

    if (!descriptionRaw && totalPrice <= 0) {
      continue;
    }

    normalized.push({
      descriptionRaw: descriptionRaw || fallbackDescription,
      totalPrice,
      quantity: quantity > 0 ? quantity : undefined,
      unitRaw: unitRaw || undefined,
      unitPrice,
      confidence,
    });
  }

  if (normalized.length === 0) {
    normalized.push({
      descriptionRaw: fallbackDescription,
      totalPrice: fallbackAmount,
      confidence: 0.5,
    });
  }

  return normalized;
}

function buildConfidenceMap(
  raw: unknown,
  defaults: Record<string, number>,
): Record<string, number> {
  const base: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      base[key] = clampConfidence(value, 0.5);
    }
  }

  for (const [key, fallback] of Object.entries(defaults)) {
    base[key] = clampConfidence(base[key], fallback);
  }

  return base;
}

function extractMessageText(content: OpenRouterCompletionResponse['choices']) {
  const value = content?.[0]?.message?.content;
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map((part) => asString(part.text)).join('\n').trim();
  }

  return '';
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty model response');
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // continue with fenced/subset extraction
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = JSON.parse(fenced[1]) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error('Could not parse JSON object from model output');
}

@Injectable()
export class OpenRouterExpenseParserProvider implements ExpenseParserProvider {
  private readonly logger = new Logger(OpenRouterExpenseParserProvider.name);

  constructor(private readonly config: ConfigService) {}

  private getHeaders(): Record<string, string> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is required for OPENROUTER parser provider',
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const appUrl = this.config.get<string>('OPENROUTER_APP_URL');
    const appName = this.config.get<string>('OPENROUTER_APP_NAME');
    if (appUrl) {
      headers['HTTP-Referer'] = appUrl;
    }
    if (appName) {
      headers['X-Title'] = appName;
    }

    return headers;
  }

  private getBaseUrl(): string {
    return this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/+$/, '');
  }

  private getModel(): string {
    return this.config.get<string>('OPENROUTER_PARSER_MODEL', 'openai/gpt-4.1-mini');
  }

  private getTimeoutMs(): number {
    const raw = this.config.get<string>('OPENROUTER_PARSER_TIMEOUT_MS', '12000');
    const timeout = Number(raw);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      return 12000;
    }
    return Math.round(timeout);
  }

  private async completeJson(systemPrompt: string, userPrompt: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.getTimeoutMs());

    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: this.getModel(),
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(
          `OpenRouter parser request failed (${response.status}): ${body}`,
        );
        throw new ServiceUnavailableException('Parser provider request failed');
      }

      const payload = (await response.json()) as OpenRouterCompletionResponse;
      const content = extractMessageText(payload.choices);
      return extractJsonObject(content);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Parser provider request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeVoiceResult(raw: Record<string, unknown>): ParsedExpenseResult {
    const merchantText = asString(raw.merchantText) || undefined;
    const note = asString(raw.note ?? raw.details ?? raw.detail) || undefined;
    const totalAmount = asPositiveNumber(raw.totalAmount);
    const paymentMethod = normalizePaymentMethod(raw.paymentMethod);
    const lineItems = normalizeLineItems(raw.lineItems, totalAmount, 'General expense');
    const lineItemsTotal = Number(
      lineItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2),
    );
    const normalizedTotal = totalAmount > 0 ? totalAmount : lineItemsTotal;

    const confidenceMap = buildConfidenceMap(raw.confidenceMap, {
      merchantText: merchantText ? 0.72 : 0.25,
      note: note ? 0.72 : 0.3,
      totalAmount: normalizedTotal > 0 ? 0.86 : 0.2,
      paymentMethod: paymentMethod ? 0.8 : 0.35,
      lineItems: lineItems.length > 0 ? 0.78 : 0.2,
    });

    if (
      lineItemsTotal > 0 &&
      normalizedTotal > 0 &&
      Math.abs(lineItemsTotal - normalizedTotal) / Math.max(lineItemsTotal, normalizedTotal) >
        0.15
    ) {
      confidenceMap.totalAmount = Math.min(confidenceMap.totalAmount, 0.58);
      confidenceMap.lineItems = Math.min(confidenceMap.lineItems, 0.62);
    }

    return {
      merchantText,
      note,
      totalAmount: normalizedTotal,
      paymentMethod,
      lineItems,
      confidenceMap,
      parserMeta: {
        engine: 'openrouter',
      },
    };
  }

  private normalizeReceiptResult(raw: Record<string, unknown>): ParsedReceiptResult {
    const merchantText = asString(raw.merchantText) || undefined;
    const note = asString(raw.note ?? raw.details ?? raw.detail) || undefined;
    const currency = normalizeCurrency(raw.currency);
    const parsedTotal = asPositiveNumber(raw.totalAmount);
    const lineItems = normalizeLineItems(raw.lineItems, parsedTotal, 'Receipt item');
    const lineItemsTotal = Number(
      lineItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2),
    );
    const totalAmount = parsedTotal > 0 ? parsedTotal : lineItemsTotal;
    const receiptDate = normalizeDate(raw.receiptDate);

    const confidenceMap = buildConfidenceMap(raw.confidenceMap, {
      merchantText: merchantText ? 0.76 : 0.25,
      note: note ? 0.72 : 0.3,
      totalAmount: totalAmount > 0 ? 0.84 : 0.2,
      currency: 0.82,
      lineItems: lineItems.length > 0 ? 0.8 : 0.2,
      receiptDate: receiptDate ? 0.72 : 0.3,
    });

    if (
      lineItemsTotal > 0 &&
      totalAmount > 0 &&
      Math.abs(lineItemsTotal - totalAmount) / Math.max(lineItemsTotal, totalAmount) > 0.15
    ) {
      confidenceMap.totalAmount = Math.min(confidenceMap.totalAmount, 0.58);
      confidenceMap.lineItems = Math.min(confidenceMap.lineItems, 0.62);
    }

    return {
      merchantText,
      note,
      receiptDate,
      totalAmount,
      currency,
      lineItems,
      confidenceMap,
      parserMeta: {
        engine: 'openrouter',
      },
    };
  }

  async parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult> {
    const systemPrompt = [
      'You extract structured expense fields from short spoken expense text.',
      'Return JSON only. No markdown, no comments.',
      'Never invent values. Use null when unknown.',
      'All amounts must be numbers (not strings).',
      'Output keys exactly: merchantText,note,totalAmount,paymentMethod,lineItems,confidenceMap.',
      'lineItems item keys: descriptionRaw,quantity,unitRaw,unitPrice,totalPrice,confidence.',
      'paymentMethod must be one of CASH,CARD,BANK_TRANSFER,E_WALLET,TNG,GRABPAY,SHOPEEPAY,DUITNOW,OTHER.',
      'note should capture optional details like "bought this for jimmy".',
    ].join(' ');

    const userPrompt = `Transcript:\n${transcript}`;
    const raw = await this.completeJson(systemPrompt, userPrompt);
    return this.normalizeVoiceResult(raw);
  }

  async parseReceipt(rawText: string): Promise<ParsedReceiptResult> {
    const systemPrompt = [
      'You extract structured receipt data from OCR text.',
      'Return JSON only. No markdown, no comments.',
      'Never invent values. Use null when unknown.',
      'All amounts must be numbers (not strings).',
      'Output keys exactly: merchantText,note,receiptDate,totalAmount,currency,lineItems,confidenceMap.',
      'currency must be MYR, SGD, or USD.',
      'lineItems item keys: descriptionRaw,quantity,unitRaw,unitPrice,totalPrice,confidence.',
    ].join(' ');

    const userPrompt = `OCR text:\n${rawText}`;
    const raw = await this.completeJson(systemPrompt, userPrompt);
    return this.normalizeReceiptResult(raw);
  }
}
