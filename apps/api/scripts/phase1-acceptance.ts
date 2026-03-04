import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { ParseService } from '../src/modules/parse/parse.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { ReportsService } from '../src/modules/reports/reports.service';

type SampleExpense = {
  transcript: string;
  amount: number;
  paymentMethod:
    | 'CASH'
    | 'CARD'
    | 'BANK_TRANSFER'
    | 'E_WALLET'
    | 'TNG'
    | 'GRABPAY'
    | 'SHOPEEPAY'
    | 'DUITNOW'
    | 'OTHER';
  item: string;
};

const SAMPLE_EXPENSES: SampleExpense[] = [
  { transcript: 'Spent RM 5 at pasar to buy fish, paid with TNG', amount: 5, paymentMethod: 'TNG', item: 'fish' },
  { transcript: 'Spent RM 12.50 at morning market for vegetables, paid cash', amount: 12.5, paymentMethod: 'CASH', item: 'vegetables' },
  { transcript: 'Spent RM 8 for rice at local grocery, paid with card', amount: 8, paymentMethod: 'CARD', item: 'rice' },
  { transcript: 'Spent RM 23.90 at mini market to buy chicken, paid by DuitNow', amount: 23.9, paymentMethod: 'DUITNOW', item: 'chicken' },
  { transcript: 'Spent RM 6.20 at pasar for fruits, paid with TNG', amount: 6.2, paymentMethod: 'TNG', item: 'fruits' },
  { transcript: 'Spent RM 18 at supermarket for eggs and milk, paid with card', amount: 18, paymentMethod: 'CARD', item: 'eggs and milk' },
  { transcript: 'Spent RM 4.80 at roadside stall for bananas, paid cash', amount: 4.8, paymentMethod: 'CASH', item: 'bananas' },
  { transcript: 'Spent RM 15.30 at wet market for prawns, paid with GrabPay', amount: 15.3, paymentMethod: 'GRABPAY', item: 'prawns' },
  { transcript: 'Spent RM 9.70 at grocery for tofu, paid with ShopeePay', amount: 9.7, paymentMethod: 'SHOPEEPAY', item: 'tofu' },
  { transcript: 'Spent RM 11.40 at pasar for onions, paid with TNG', amount: 11.4, paymentMethod: 'TNG', item: 'onions' },
];

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'toNumber' in value) {
    const maybeNumber = (value as { toNumber?: () => number }).toNumber;
    if (typeof maybeNumber === 'function') {
      return maybeNumber.call(value);
    }
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    const stringValue = (value as { toString: () => string }).toString();
    const parsed = Number(stringValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Number(value);
}

function assertNear(name: string, actual: number, expected: number, tolerance = 0.001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${name} mismatch. expected=${expected.toFixed(2)} actual=${actual.toFixed(2)}`,
    );
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const expensesService = app.get(ExpensesService);
  const reportsService = app.get(ReportsService);
  const parseService = app.get(ParseService);

  try {
    const seedUser = await prisma.user.upsert({
      where: { email: 'phase1.acceptance@clarifi.local' },
      create: {
        email: 'phase1.acceptance@clarifi.local',
        clerkUserId: 'phase1-acceptance-user',
      },
      update: {},
      select: { id: true, email: true, clerkUserId: true },
    });

    await prisma.monthlyReport.deleteMany({ where: { userId: seedUser.id } });
    await prisma.receipt.deleteMany({ where: { userId: seedUser.id } });
    await prisma.expense.deleteMany({ where: { userId: seedUser.id } });

    const authUser: AuthenticatedUser = {
      id: seedUser.id,
      email: seedUser.email,
      clerkUserId: seedUser.clerkUserId,
    };

    const transactionAt = new Date().toISOString();

    for (const sample of SAMPLE_EXPENSES) {
      await expensesService.confirmExpense(authUser, {
        source: 'VOICE',
        provenance: 'VOICE_ON_DEVICE',
        currency: 'MYR',
        transactionAt,
        merchantText: 'Acceptance Test Store',
        totalAmount: sample.amount,
        paymentMethod: sample.paymentMethod,
        lineItems: [
          {
            descriptionRaw: sample.item,
            totalPrice: sample.amount,
          },
        ],
        rawPayload: {
          scenario: 'phase1-acceptance',
          transcript: sample.transcript,
        },
      });
    }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const expectedCashOut = SAMPLE_EXPENSES.reduce(
      (acc, sample) => acc + sample.amount,
      0,
    );

    const ledger = await expensesService.listExpenses(authUser, {
      from: start.toISOString(),
      to: end.toISOString(),
      page: 1,
      limit: 100,
    });

    if (ledger.total < SAMPLE_EXPENSES.length) {
      throw new Error(
        `Expected at least ${SAMPLE_EXPENSES.length} expenses in ledger, got ${ledger.total}`,
      );
    }

    const ledgerCashOut = ledger.items.reduce(
      (acc, item) => acc + toNumber(item.totalAmount),
      0,
    );

    const report = await reportsService.getMonthlyReport(authUser, {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });

    assertNear('Ledger cashOut', ledgerCashOut, expectedCashOut);
    assertNear('Report cashOut', report.cashOut, expectedCashOut);
    assertNear('Ledger/Report consistency', ledgerCashOut, report.cashOut);

    const parseLatencies: number[] = [];
    let correctionCount = 0;
    let fallbackCount = 0;
    const parserEngineCounts: Record<string, number> = {};

    for (const sample of SAMPLE_EXPENSES) {
      const startedAt = Date.now();
      const parseResult = await parseService.parseVoice(authUser, {
        transcript: sample.transcript,
        locale: 'en-MY',
      });
      const latencyMs = Date.now() - startedAt;
      parseLatencies.push(latencyMs);
      const parserEngine = parseResult.parseMeta.parserEngine ?? 'unknown';
      parserEngineCounts[parserEngine] = (parserEngineCounts[parserEngine] ?? 0) + 1;
      if (parseResult.parseMeta.fallbackUsed) {
        fallbackCount += 1;
      }

      const amountCorrect =
        Math.abs(parseResult.candidate.totalAmount - sample.amount) <= 0.01;
      const methodCorrect = parseResult.candidate.paymentMethod === sample.paymentMethod;
      if (!amountCorrect || !methodCorrect) {
        correctionCount += 1;
      }
    }

    const avgLatencyMs =
      parseLatencies.reduce((acc, value) => acc + value, 0) / parseLatencies.length;
    const correctionRate = correctionCount / SAMPLE_EXPENSES.length;

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          checks: {
            savedSampleExpenses: SAMPLE_EXPENSES.length,
            ledgerTotalRecords: ledger.total,
            expectedCashOut: Number(expectedCashOut.toFixed(2)),
            ledgerCashOut: Number(ledgerCashOut.toFixed(2)),
            reportCashOut: Number(report.cashOut.toFixed(2)),
            averageParseLatencyMs: Number(avgLatencyMs.toFixed(2)),
            correctionRate: Number((correctionRate * 100).toFixed(2)),
            parserEngineCounts,
            llmFallbackCount: fallbackCount,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
