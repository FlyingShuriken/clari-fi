import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { PricesService } from '../src/modules/prices/prices.service';

type SeedExpense = {
  merchantText: string;
  areaText: string;
  locationLat: number;
  locationLng: number;
  totalAmount: number;
  item: string;
  quantity: number;
  unitRaw: string;
  unitPrice: number;
};

const SEED_EXPENSES: SeedExpense[] = [
  {
    merchantText: 'Village Fresh Market',
    areaText: 'Kota Kinabalu',
    locationLat: 5.9804,
    locationLng: 116.0735,
    totalAmount: 10,
    item: 'watermelon',
    quantity: 2,
    unitRaw: 'kg',
    unitPrice: 5,
  },
  {
    merchantText: 'Borneo Hypermart',
    areaText: 'Penampang',
    locationLat: 5.9293,
    locationLng: 116.0823,
    totalAmount: 12,
    item: 'watermelon',
    quantity: 2,
    unitRaw: 'kg',
    unitPrice: 6,
  },
  {
    merchantText: 'Harbour Grocery',
    areaText: 'Kota Kinabalu',
    locationLat: 5.9875,
    locationLng: 116.0762,
    totalAmount: 5.5,
    item: 'banana',
    quantity: 1,
    unitRaw: 'kg',
    unitPrice: 5.5,
  },
];

function assertCondition(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const expensesService = app.get(ExpensesService);
  const pricesService = app.get(PricesService);

  try {
    const seedUser = await prisma.user.upsert({
      where: { email: 'phase2.acceptance@clarifi.local' },
      create: {
        email: 'phase2.acceptance@clarifi.local',
        clerkUserId: 'phase2-acceptance-user',
      },
      update: {},
      select: { id: true, email: true, clerkUserId: true },
    });

    await prisma.priceObservation.deleteMany({ where: { userId: seedUser.id } });
    await prisma.receipt.deleteMany({ where: { userId: seedUser.id } });
    await prisma.expense.deleteMany({ where: { userId: seedUser.id } });

    const authUser: AuthenticatedUser = {
      id: seedUser.id,
      email: seedUser.email,
      clerkUserId: seedUser.clerkUserId,
    };

    const transactionAt = new Date().toISOString();

    for (const sample of SEED_EXPENSES) {
      await expensesService.confirmExpense(authUser, {
        source: 'MANUAL',
        provenance: 'MANUAL',
        currency: 'MYR',
        transactionAt,
        merchantText: sample.merchantText,
        areaText: sample.areaText,
        locationLat: sample.locationLat,
        locationLng: sample.locationLng,
        totalAmount: sample.totalAmount,
        paymentMethod: 'CASH',
        lineItems: [
          {
            descriptionRaw: sample.item,
            quantity: sample.quantity,
            unitRaw: sample.unitRaw,
            unitPrice: sample.unitPrice,
            totalPrice: sample.totalAmount,
            confidence: 0.9,
          },
        ],
      });
    }

    const compareBefore = await pricesService.compare(authUser, {
      item: 'watermelon',
      limit: 10,
    });
    assertCondition(compareBefore.item !== null, 'Expected canonical item for watermelon');
    assertCondition(compareBefore.rows.length >= 2, 'Expected at least 2 compare rows');
    assertCondition(
      compareBefore.rows[0].latestUnitPrice <= compareBefore.rows[1].latestUnitPrice,
      'Compare rows should be sorted by lowest latestUnitPrice first',
    );

    const historyBefore = await pricesService.getHistory(authUser, {
      item: 'watermelon',
      interval: 'day',
    });
    assertCondition(historyBefore.item !== null, 'Expected history item for watermelon');
    assertCondition(historyBefore.totalObservations >= 2, 'Expected at least 2 observations');
    assertCondition(historyBefore.points.length >= 1, 'Expected at least 1 history point');

    const backfillRun = await pricesService.backfill(authUser, {
      scope: 'user',
      dryRun: false,
    });
    assertCondition(backfillRun.expensesProcessed >= SEED_EXPENSES.length, 'Backfill processed count mismatch');
    assertCondition(backfillRun.errors === 0, 'Backfill should complete with zero errors');
    const backfillSecondRun = await pricesService.backfill(authUser, {
      scope: 'user',
      dryRun: false,
    });
    assertCondition(backfillSecondRun.errors === 0, 'Second backfill should complete with zero errors');
    assertCondition(backfillSecondRun.created === 0, 'Second backfill should not create new observations');

    const compareAfter = await pricesService.compare(authUser, {
      item: 'watermelon',
      limit: 10,
    });
    const historyAfter = await pricesService.getHistory(authUser, {
      item: 'watermelon',
      interval: 'day',
    });

    assertCondition(compareAfter.rows.length >= 2, 'Expected compare rows after backfill');
    assertCondition(historyAfter.totalObservations >= historyBefore.totalObservations, 'History observations should not shrink');

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          checks: {
            seededExpenses: SEED_EXPENSES.length,
            compareRowsBefore: compareBefore.rows.length,
            compareRowsAfter: compareAfter.rows.length,
            historyObservationsBefore: historyBefore.totalObservations,
            historyObservationsAfter: historyAfter.totalObservations,
            historyPointsAfter: historyAfter.points.length,
            backfillFirstRun: backfillRun,
            backfillSecondRun,
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
