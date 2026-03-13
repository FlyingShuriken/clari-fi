import { z } from 'zod';

export const ContributionKindSchema = z.enum(['RECEIPT', 'FLYER']);
export type ContributionKind = z.infer<typeof ContributionKindSchema>;

export const ContributionAcceptanceStatusSchema = z.enum([
  'ACCEPTED',
  'REJECTED',
  'DUPLICATE',
  'CAPPED',
]);
export type ContributionAcceptanceStatus = z.infer<typeof ContributionAcceptanceStatusSchema>;

export const PointLedgerEntryTypeSchema = z.enum([
  'RECEIPT_ACCEPTED',
  'FLYER_ACCEPTED',
  'STREAK_BONUS',
  'REDEMPTION',
]);
export type PointLedgerEntryType = z.infer<typeof PointLedgerEntryTypeSchema>;

export const RewardTypeSchema = z.enum([
  'VOUCHER',
  'PARTNER_DISCOUNT',
  'EXCLUSIVE_PROMOTION',
]);
export type RewardType = z.infer<typeof RewardTypeSchema>;

export const RewardRedemptionStatusSchema = z.enum([
  'PENDING',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
]);
export type RewardRedemptionStatus = z.infer<typeof RewardRedemptionStatusSchema>;

export const ContributionSummarySchema = z.object({
  userId: z.string(),
  balance: z.number().int(),
  currentStreakDays: z.number().int().nonnegative(),
  lastAcceptedAt: z.string().datetime().nullable(),
  generatedAt: z.string().datetime(),
});
export type ContributionSummary = z.infer<typeof ContributionSummarySchema>;

export const PointLedgerEntrySchema = z.object({
  id: z.string(),
  type: PointLedgerEntryTypeSchema,
  pointsDelta: z.number().int(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type PointLedgerEntry = z.infer<typeof PointLedgerEntrySchema>;

export const PointLedgerHistoryResponseSchema = z.object({
  userId: z.string(),
  balance: z.number().int(),
  items: z.array(PointLedgerEntrySchema),
  generatedAt: z.string().datetime(),
});
export type PointLedgerHistoryResponse = z.infer<typeof PointLedgerHistoryResponseSchema>;

export const RewardCatalogItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: RewardTypeSchema,
  pointsCost: z.number().int().positive(),
  active: z.boolean(),
});
export type RewardCatalogItem = z.infer<typeof RewardCatalogItemSchema>;

export const RewardCatalogResponseSchema = z.object({
  items: z.array(RewardCatalogItemSchema),
  generatedAt: z.string().datetime(),
});
export type RewardCatalogResponse = z.infer<typeof RewardCatalogResponseSchema>;

export const RewardRedemptionSchema = z.object({
  id: z.string(),
  rewardId: z.string(),
  rewardTitle: z.string(),
  rewardType: RewardTypeSchema,
  pointsCost: z.number().int().positive(),
  status: RewardRedemptionStatusSchema,
  createdAt: z.string().datetime(),
  fulfilledAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
});
export type RewardRedemption = z.infer<typeof RewardRedemptionSchema>;

export const RewardRedemptionHistoryResponseSchema = z.object({
  userId: z.string(),
  items: z.array(RewardRedemptionSchema),
  generatedAt: z.string().datetime(),
});
export type RewardRedemptionHistoryResponse = z.infer<typeof RewardRedemptionHistoryResponseSchema>;
