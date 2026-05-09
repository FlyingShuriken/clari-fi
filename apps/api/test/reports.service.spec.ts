import { ReportsService } from '../src/modules/reports/reports.service';

describe('ReportsService', () => {
  it('builds monthly report totals and insights', async () => {
    const prisma = {
      expense: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              totalAmount: { toString: () => '100.00' },
              lineItems: [
                {
                  descriptionRaw: 'fish',
                  totalPrice: { toString: () => '60.00' },
                },
                {
                  descriptionRaw: 'vegetable',
                  totalPrice: { toString: () => '40.00' },
                },
              ],
            },
          ])
          .mockResolvedValueOnce([
            {
              totalAmount: { toString: () => '70.00' },
              lineItems: [],
            },
          ]),
      },
      monthlyReport: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const metrics = {
      trackCounter: jest.fn(),
      trackTiming: jest.fn(),
    } as any;
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const service = new ReportsService(prisma, metrics, config);

    const report = await service.getMonthlyReport(
      { id: 'u1', email: 'x@example.com', clerkUserId: 'clerk_1' },
      { year: 2026, month: 3 },
    );

    expect(report.cashOut).toBe(100);
    expect(report.netCashFlow).toBe(-100);
    expect(report.categoryBreakdown.groceries).toBe(100);
    expect(report.spendDelta.direction).toBe('UP');
    expect(report.topItems.length).toBeGreaterThan(0);
    expect(report.insights.length).toBeGreaterThan(0);
    expect(prisma.monthlyReport.upsert).toHaveBeenCalled();
    expect(metrics.trackCounter).toHaveBeenCalled();
    expect(metrics.trackTiming).toHaveBeenCalled();
  });
});
