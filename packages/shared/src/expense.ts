import { z } from 'zod';

export const CurrencyCodeSchema = z.enum(['MYR', 'SGD', 'USD']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const ExpenseSourceSchema = z.enum(['VOICE', 'RECEIPT', 'MANUAL']);
export type ExpenseSource = z.infer<typeof ExpenseSourceSchema>;

export const ExpenseProvenanceSchema = z.enum([
  'VOICE_ON_DEVICE',
  'VOICE_CLOUD',
  'RECEIPT_OCR',
  'MANUAL',
]);
export type ExpenseProvenance = z.infer<typeof ExpenseProvenanceSchema>;

export const PaymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'E_WALLET',
  'TNG',
  'GRABPAY',
  'SHOPEEPAY',
  'DUITNOW',
  'OTHER',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ConfidenceMapSchema = z.record(z.number().min(0).max(1));
export type ConfidenceMap = z.infer<typeof ConfidenceMapSchema>;

export const ParsedLineItemSchema = z.object({
  descriptionRaw: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitRaw: z.string().optional(),
  totalPrice: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});
export type ParsedLineItem = z.infer<typeof ParsedLineItemSchema>;

export const ParsedVoiceExpenseCandidateSchema = z.object({
  source: ExpenseSourceSchema.default('VOICE'),
  provenance: ExpenseProvenanceSchema.default('VOICE_ON_DEVICE'),
  merchantText: z.string().optional(),
  totalAmount: z.number().nonnegative(),
  currency: CurrencyCodeSchema.default('MYR'),
  paymentMethod: PaymentMethodSchema.optional(),
  transactionAt: z.string().datetime(),
  parseLatencyMs: z.number().int().nonnegative().optional(),
  note: z.string().optional(),
  lineItems: z.array(ParsedLineItemSchema).min(1),
});
export type ParsedVoiceExpenseCandidate = z.infer<
  typeof ParsedVoiceExpenseCandidateSchema
>;

export const ParsedReceiptCandidateSchema = z.object({
  source: z.literal('RECEIPT'),
  provenance: z.literal('RECEIPT_OCR'),
  merchantText: z.string().optional(),
  receiptDate: z.string().datetime().optional(),
  transactionAt: z.string().datetime(),
  totalAmount: z.number().nonnegative(),
  currency: CurrencyCodeSchema.default('MYR'),
  lineItems: z.array(ParsedLineItemSchema).min(1),
});
export type ParsedReceiptCandidate = z.infer<typeof ParsedReceiptCandidateSchema>;

export const ConfirmExpenseInputSchema = z.object({
  source: ExpenseSourceSchema,
  provenance: ExpenseProvenanceSchema.optional(),
  currency: CurrencyCodeSchema.default('MYR'),
  totalAmount: z.number().nonnegative(),
  merchantText: z.string().optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  transactionAt: z.string().datetime(),
  parseLatencyMs: z.number().int().nonnegative().optional(),
  requiresCorrection: z.boolean().optional(),
  note: z.string().optional(),
  rawPayload: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  lineItems: z.array(ParsedLineItemSchema).min(1),
  receipt: z
    .object({
      fileRef: z.string().min(1),
      mimeType: z.string().min(1),
      ocrRaw: z.unknown().optional(),
      parsedPayload: z.unknown().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type ConfirmExpenseInput = z.infer<typeof ConfirmExpenseInputSchema>;

export const MonthlyReportDtoSchema = z.object({
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  cashIn: z.number(),
  cashOut: z.number(),
  netCashFlow: z.number(),
  categoryBreakdown: z.record(z.number()),
  insights: z.array(z.string()),
});
export type MonthlyReportDto = z.infer<typeof MonthlyReportDtoSchema>;
