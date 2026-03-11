import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ParsedImageDocumentResult,
  ExpenseParserProvider,
  ParsedExpenseResult,
  ParsedReceiptResult,
} from './provider.interfaces';

function extractAmount(text: string): number {
  const amountMatch = text.match(/(?:rm|myr)\s*(\d+(?:\.\d{1,2})?)/i);
  if (amountMatch) {
    return Number(amountMatch[1]);
  }

  const fallback = text.match(/(\d+(?:\.\d{1,2})?)/);
  return fallback ? Number(fallback[1]) : 0;
}

function inferPaymentMethod(text: string): ParsedExpenseResult['paymentMethod'] {
  if (/tng|touch\s*n\s*go/i.test(text)) {
    return 'TNG';
  }
  if (/cash/i.test(text)) {
    return 'CASH';
  }
  if (/card|visa|master/i.test(text)) {
    return 'CARD';
  }
  if (/duitnow/i.test(text)) {
    return 'DUITNOW';
  }
  return 'OTHER';
}

function inferMerchant(text: string): string | undefined {
  const merchantMatch = text.match(/at\s+([\w\s'-]+)/i);
  if (!merchantMatch) {
    return undefined;
  }

  return merchantMatch[1].trim().replace(/[,.]$/, '');
}

function inferItem(text: string): string {
  const itemMatch = text.match(/buy\s+([\w\s'-]+)/i);
  if (itemMatch) {
    return itemMatch[1]
      .replace(/\bpaid\s+(?:with|by)\b[\w\s'-]+$/i, '')
      .trim()
      .replace(/[,.]$/, '');
  }

  return 'General expense';
}

function inferQuantityAndUnit(
  text: string,
): { quantity?: number; unitRaw?: string } {
  const quantityWithUnitMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|l|litre|liter|ml|pcs?|pieces?|packs?|bottles?|units?)\b/i,
  );
  if (quantityWithUnitMatch) {
    return {
      quantity: Number(quantityWithUnitMatch[1]),
      unitRaw: quantityWithUnitMatch[2].toLowerCase(),
    };
  }

  const quantityTimesMatch = text.match(/(\d+(?:\.\d+)?)\s*x\b/i);
  if (quantityTimesMatch) {
    return {
      quantity: Number(quantityTimesMatch[1]),
    };
  }

  return {};
}

function inferDetails(text: string): string | undefined {
  const trailingDetails = text.match(/\bfor\s+([a-z][a-z0-9\s'-]{1,60})\s*[.!?]?$/i);
  if (!trailingDetails) {
    return undefined;
  }

  const details = trailingDetails[1].trim();
  if (!details || /\b(rm|myr)\b/i.test(details)) {
    return undefined;
  }

  return details;
}

function inferReceiptLineItem(line: string) {
  const match = line.match(/^(.+?)\s+(?:rm|myr)\s*(\d+(?:\.\d{1,2})?)$/i);
  if (!match || /total/i.test(match[1])) {
    return null;
  }

  const rawDescription = match[1].trim();
  const totalPrice = Number(match[2]);
  const { quantity, unitRaw } = inferQuantityAndUnit(rawDescription);

  let normalizedDescription = rawDescription;
  normalizedDescription = normalizedDescription.replace(
    /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|l|litre|liter|ml|pcs?|pieces?|packs?|bottles?|units?)\b/i,
    '',
  );
  normalizedDescription = normalizedDescription.replace(/(\d+(?:\.\d+)?)\s*x\b/i, '');
  normalizedDescription = normalizedDescription.trim().replace(/[-,:]$/, '');

  return {
    descriptionRaw: normalizedDescription || rawDescription,
    quantity,
    unitRaw,
    unitPrice:
      typeof quantity === 'number' && quantity > 0
        ? Number((totalPrice / quantity).toFixed(2))
        : undefined,
    totalPrice,
    confidence: 0.78,
  };
}

@Injectable()
export class HeuristicExpenseParserProvider implements ExpenseParserProvider {
  async parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult> {
    const totalAmount = extractAmount(transcript);
    const item = inferItem(transcript);
    const { quantity, unitRaw } = inferQuantityAndUnit(transcript);
    const note = inferDetails(transcript);
    const unitPrice =
      typeof quantity === 'number' && quantity > 0
        ? Number((totalAmount / quantity).toFixed(2))
        : undefined;

    return {
      merchantText: inferMerchant(transcript),
      note,
      totalAmount,
      paymentMethod: inferPaymentMethod(transcript),
      lineItems: [
        {
          descriptionRaw: item,
          quantity,
          unitRaw,
          unitPrice,
          totalPrice: totalAmount,
          confidence: 0.83,
        },
      ],
      confidenceMap: {
        merchantText: 0.75,
        note: note ? 0.7 : 0.3,
        totalAmount: totalAmount > 0 ? 0.92 : 0.2,
        paymentMethod: 0.88,
        lineItems: 0.8,
      },
      parserMeta: {
        engine: 'heuristic',
      },
    };
  }

  async parseReceipt(rawText: string): Promise<ParsedReceiptResult> {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const merchantText = lines[0];
    const lineItems = lines
      .slice(1)
      .map((line) => inferReceiptLineItem(line))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const totalFromLine = lineItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const totalLine = lines.find((line) => /total/i.test(line));
    const totalAmount = totalLine ? extractAmount(totalLine) : totalFromLine;

    return {
      merchantText,
      receiptDate: new Date().toISOString(),
      totalAmount,
      currency: 'MYR',
      lineItems,
      confidenceMap: {
        merchantText: merchantText ? 0.82 : 0.2,
        totalAmount: totalAmount > 0 ? 0.9 : 0.25,
        lineItems: lineItems.length > 0 ? 0.78 : 0.2,
      },
      parserMeta: {
        engine: 'heuristic',
      },
    };
  }

  async parseDocumentImages(): Promise<ParsedImageDocumentResult> {
    throw new ServiceUnavailableException(
      'Heuristic parser does not support direct image document parsing.',
    );
  }
}
