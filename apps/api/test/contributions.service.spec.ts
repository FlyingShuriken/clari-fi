import {
  ContributionAcceptanceStatus,
  ContributionKind,
  PointLedgerEntryType,
} from '@prisma/client';
import { ContributionStreaksService } from '../src/modules/contributions/contribution-streaks.service';
import { ContributionsService } from '../src/modules/contributions/contributions.service';

describe('ContributionsService', () => {
  function createService(overrides?: Partial<any>) {
    const tx = {
      contributionSubmission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      contributionAcceptance: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'acceptance-1',
          submissionId: data.submissionId,
          status: data.status,
          basePoints: data.basePoints,
          bonusPoints: data.bonusPoints,
          totalPoints: data.totalPoints,
          streakDays: data.streakDays,
          reasonCode: data.reasonCode ?? null,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pointLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            pointsDelta: 0,
          },
        }),
        createMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },
      ...overrides,
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      pointLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            pointsDelta: 0,
          },
        }),
      },
    } as any;

    const metrics = {
      trackCounter: jest.fn(),
    } as any;

    const streaks = new ContributionStreaksService();
    const service = new ContributionsService(prisma, metrics, streaks);

    return { service, prisma, tx, metrics };
  }

  it('awards receipt contribution points for accepted structured receipt data', async () => {
    const { service, tx } = createService();

    const result = await service.recordAcceptedReceiptContribution({
      userId: 'user-1',
      expenseId: 'expense-1',
      receiptId: 'receipt-1',
      fileRef: 'receipt://1',
      merchantText: 'Lotus',
      transactionAt: new Date('2026-03-13T10:00:00.000Z'),
      totalAmount: 12.4,
      currency: 'MYR',
      lineItems: [{ descriptionRaw: 'milk', totalPrice: 12.4 }],
    });

    expect(result.kind).toBe(ContributionKind.RECEIPT);
    expect(result.status).toBe(ContributionAcceptanceStatus.ACCEPTED);
    expect(result.basePoints).toBe(8);
    expect(result.totalPoints).toBe(8);
    expect(tx.pointLedgerEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: PointLedgerEntryType.RECEIPT_ACCEPTED,
          pointsDelta: 8,
        }),
      ],
    });
  });

  it('rejects duplicate flyer contributions by normalized fingerprint', async () => {
    const { service, tx } = createService({
      contributionSubmission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'submission-existing',
        }),
      },
    });

    const result = await service.recordAcceptedFlyerContribution({
      userId: 'user-1',
      promoIngestionId: 'promo-1',
      fileRefs: ['promo://1'],
      merchantText: 'Woolworths',
      validFrom: new Date('2026-03-13T00:00:00.000Z'),
      validTo: new Date('2026-03-20T00:00:00.000Z'),
      currency: 'MYR',
      lineItems: [{ descriptionRaw: 'spice', totalPrice: 12 }],
    });

    expect(result.kind).toBe(ContributionKind.FLYER);
    expect(result.status).toBe(ContributionAcceptanceStatus.DUPLICATE);
    expect(result.totalPoints).toBe(0);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('caps earnings when the user has already hit the daily point limit', async () => {
    const { service, tx } = createService({
      pointLedgerEntry: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            pointsDelta: 40,
          },
        }),
        createMany: jest.fn(),
      },
    });

    const result = await service.recordAcceptedReceiptContribution({
      userId: 'user-1',
      expenseId: 'expense-2',
      receiptId: 'receipt-2',
      fileRef: 'receipt://2',
      merchantText: 'Village Fresh',
      transactionAt: new Date('2026-03-13T11:00:00.000Z'),
      totalAmount: 18,
      currency: 'MYR',
      lineItems: [{ descriptionRaw: 'apple', totalPrice: 18 }],
    });

    expect(result.status).toBe(ContributionAcceptanceStatus.CAPPED);
    expect(result.totalPoints).toBe(0);
    expect(result.reasonCode).toBe('DAILY_POINTS_CAP_REACHED');
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });
});
