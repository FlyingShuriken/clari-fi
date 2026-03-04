import { Injectable } from '@nestjs/common';
import {
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
    return itemMatch[1].trim().replace(/[,.]$/, '');
  }

  return 'General expense';
}

@Injectable()
export class HeuristicExpenseParserProvider implements ExpenseParserProvider {
  async parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult> {
    const totalAmount = extractAmount(transcript);
    const item = inferItem(transcript);

    return {
      merchantText: inferMerchant(transcript),
      totalAmount,
      paymentMethod: inferPaymentMethod(transcript),
      lineItems: [
        {
          descriptionRaw: item,
          totalPrice: totalAmount,
          confidence: 0.83,
        },
      ],
      confidenceMap: {
        merchantText: 0.75,
        totalAmount: totalAmount > 0 ? 0.92 : 0.2,
        paymentMethod: 0.88,
        lineItems: 0.8,
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
      .map((line) => {
        const match = line.match(/^(.+?)\s+(?:rm|myr)\s*(\d+(?:\.\d{1,2})?)$/i);
        if (!match || /total/i.test(match[1])) {
          return null;
        }

        return {
          descriptionRaw: match[1].trim(),
          totalPrice: Number(match[2]),
          confidence: 0.78,
        };
      })
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
    };
  }
}
