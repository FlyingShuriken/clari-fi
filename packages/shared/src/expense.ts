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
  unitPrice: z.number().nonnegative().optional(),
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
  note: z.string().optional(),
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
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  areaText: z.string().optional(),
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

export const PriceHistoryPointSchema = z.object({
  bucket: z.string(),
  minUnitPrice: z.number().nonnegative(),
  avgUnitPrice: z.number().nonnegative(),
  maxUnitPrice: z.number().nonnegative(),
  sampleSize: z.number().int().nonnegative(),
});
export type PriceHistoryPoint = z.infer<typeof PriceHistoryPointSchema>;

export const PriceHistoryResponseSchema = z.object({
  item: z
    .object({
      id: z.string(),
      canonicalName: z.string(),
      canonicalUnit: z.string().optional().nullable(),
    })
    .nullable(),
  interval: z.enum(['day', 'week']),
  totalObservations: z.number().int().nonnegative(),
  points: z.array(PriceHistoryPointSchema),
  generatedAt: z.string().datetime(),
  userId: z.string(),
  includePromo: z.boolean().optional(),
});
export type PriceHistoryResponse = z.infer<typeof PriceHistoryResponseSchema>;

export const PriceCompareRowSchema = z.object({
  storeId: z.string().optional(),
  storeName: z.string().optional(),
  areaText: z.string().optional(),
  latestUnitPrice: z.number().nonnegative(),
  averageUnitPrice: z.number().nonnegative(),
  averageTrustScore: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
  lastObservedAt: z.string().datetime(),
  distanceKm: z.number().nonnegative().optional(),
});
export type PriceCompareRow = z.infer<typeof PriceCompareRowSchema>;

export const PriceCompareResponseSchema = z.object({
  item: z
    .object({
      id: z.string(),
      canonicalName: z.string(),
      canonicalUnit: z.string().optional().nullable(),
    })
    .nullable(),
  radiusKm: z.number().nonnegative().optional(),
  rows: z.array(PriceCompareRowSchema),
  generatedAt: z.string().datetime(),
  userId: z.string(),
  includePromo: z.boolean().optional(),
});
export type PriceCompareResponse = z.infer<typeof PriceCompareResponseSchema>;

export const PriceBackfillResponseSchema = z.object({
  scope: z.enum(['user', 'all']),
  dryRun: z.boolean(),
  expensesProcessed: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  requestedByUserId: z.string(),
  generatedAt: z.string().datetime(),
});
export type PriceBackfillResponse = z.infer<typeof PriceBackfillResponseSchema>;

export const ObservationSourceSchema = z.enum(['EXPENSE', 'PROMO']);
export type ObservationSource = z.infer<typeof ObservationSourceSchema>;

export const PriceAlertSchema = z.object({
  id: z.string(),
  item: z.object({
    id: z.string(),
    canonicalName: z.string(),
    canonicalUnit: z.string().nullable().optional(),
  }),
  targetUnitPrice: z.number().nonnegative(),
  radiusKm: z.number().positive(),
  active: z.boolean(),
  areaText: z.string().optional(),
  storeId: z.string().optional(),
  storeName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const AlertEventSchema = z.object({
  id: z.string(),
  alertId: z.string(),
  item: z.string(),
  source: ObservationSourceSchema,
  triggerUnitPrice: z.number().nonnegative(),
  targetUnitPrice: z.number().nonnegative(),
  distanceKm: z.number().nonnegative().optional(),
  storeId: z.string().optional(),
  storeName: z.string().optional(),
  areaText: z.string().optional(),
  triggeredAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

export const PromoReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type PromoReviewStatus = z.infer<typeof PromoReviewStatusSchema>;

export const PromoObservationSchema = z.object({
  id: z.string(),
  item: z.string(),
  reviewStatus: PromoReviewStatusSchema,
  unitPrice: z.number().nonnegative(),
  trustScore: z.number().min(0).max(1),
  storeId: z.string().optional(),
  storeName: z.string().optional(),
  areaText: z.string().optional(),
  validFrom: z.string().datetime().nullable(),
  validTo: z.string().datetime().nullable(),
});
export type PromoObservation = z.infer<typeof PromoObservationSchema>;

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
