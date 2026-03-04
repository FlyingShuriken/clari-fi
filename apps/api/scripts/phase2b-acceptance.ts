import 'reflect-metadata';
import { Prisma, PromoReviewStatus, ProcessingStatus } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { PricesService } from '../src/modules/prices/prices.service';

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
      where: { email: 'phase2b.acceptance@clarifi.local' },
      create: {
        email: 'phase2b.acceptance@clarifi.local',
        clerkUserId: 'phase2b-acceptance-user',
      },
      update: {},
      select: { id: true, email: true, clerkUserId: true },
    });

    await prisma.alertEvent.deleteMany({ where: { userId: seedUser.id } });
    await prisma.priceAlert.deleteMany({ where: { userId: seedUser.id } });
    await prisma.promoObservation.deleteMany({ where: { userId: seedUser.id } });
    await prisma.promoIngestion.deleteMany({ where: { userId: seedUser.id } });
    await prisma.priceObservation.deleteMany({ where: { userId: seedUser.id } });
    await prisma.receipt.deleteMany({ where: { userId: seedUser.id } });
    await prisma.expense.deleteMany({ where: { userId: seedUser.id } });

    const authUser: AuthenticatedUser = {
      id: seedUser.id,
      email: seedUser.email,
      clerkUserId: seedUser.clerkUserId,
    };

    const nowIso = new Date().toISOString();
    await expensesService.confirmExpense(authUser, {
      source: 'MANUAL',
      provenance: 'MANUAL',
      currency: 'MYR',
      transactionAt: nowIso,
      merchantText: 'Village Fresh Market',
      areaText: 'Kota Kinabalu',
      locationLat: 5.9804,
      locationLng: 116.0735,
      totalAmount: 10,
      paymentMethod: 'CASH',
      lineItems: [
        {
          descriptionRaw: 'watermelon',
          quantity: 2,
          unitRaw: 'kg',
          unitPrice: 5,
          totalPrice: 10,
        },
      ],
    });

    await expensesService.confirmExpense(authUser, {
      source: 'MANUAL',
      provenance: 'MANUAL',
      currency: 'MYR',
      transactionAt: nowIso,
      merchantText: 'Borneo Hypermart',
      areaText: 'Kota Kinabalu',
      locationLat: 5.9778,
      locationLng: 116.0724,
      totalAmount: 12,
      paymentMethod: 'CARD',
      lineItems: [
        {
          descriptionRaw: 'watermelon',
          quantity: 2,
          unitRaw: 'kg',
          unitPrice: 6,
          totalPrice: 12,
        },
      ],
    });

    const compareWithoutPromo = await pricesService.compare(authUser, {
      item: 'watermelon',
      lat: 5.9804,
      lng: 116.0735,
      radiusKm: 10,
      includePromo: false,
      limit: 10,
    });

    assertCondition(compareWithoutPromo.item !== null, 'Expected canonical item for watermelon');
    assertCondition(compareWithoutPromo.rows.length >= 1, 'Expected compare rows without promo');

    const canonical = await prisma.canonicalItem.findFirst({
      where: { canonicalName: 'watermelon' },
    });
    assertCondition(Boolean(canonical), 'Expected canonical watermelon item');

    const ingestion = await prisma.promoIngestion.create({
      data: {
        userId: seedUser.id,
        fileRef: 'seed://promo/watermelon',
        mimeType: 'image/jpeg',
        status: ProcessingStatus.COMPLETED,
        rawText: 'Watermelon 1kg RM4.50',
      },
    });

    await prisma.promoObservation.create({
      data: {
        ingestionId: ingestion.id,
        userId: seedUser.id,
        canonicalItemId: canonical!.id,
        areaText: 'Kota Kinabalu',
        currency: 'MYR',
        quantity: new Prisma.Decimal(1),
        unitRaw: 'kg',
        unitPrice: new Prisma.Decimal(4.5),
        totalPrice: new Prisma.Decimal(4.5),
        trustScore: new Prisma.Decimal(0.72),
        reviewStatus: PromoReviewStatus.APPROVED,
        observedAt: new Date(),
      },
    });

    const alert = await pricesService.createAlert(authUser, {
      item: 'watermelon',
      targetUnitPrice: 4.8,
      radiusKm: 10,
      areaText: 'Kota Kinabalu',
    });

    const checkResult = await pricesService.checkAlerts(authUser, {
      lat: 5.9804,
      lng: 116.0735,
      areaText: 'Kota Kinabalu',
      includePromo: true,
      limit: 20,
    });

    assertCondition(checkResult.checked >= 1, 'Expected at least 1 checked alert');
    assertCondition(checkResult.triggeredCount >= 1, 'Expected at least 1 triggered alert');

    const events = await pricesService.listAlertEvents(authUser, { limit: 20 });
    assertCondition(events.total >= 1, 'Expected at least one alert event');

    const compareWithPromo = await pricesService.compare(authUser, {
      item: 'watermelon',
      area: 'Kota Kinabalu',
      includePromo: true,
      limit: 10,
    });

    assertCondition(compareWithPromo.rows.length >= 1, 'Expected compare rows with promo');
    assertCondition(
      compareWithPromo.rows[0].latestUnitPrice <= 5,
      'Expected promo influence in compare price',
    );

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          checks: {
            alertId: alert.id,
            checkedAlerts: checkResult.checked,
            triggeredAlerts: checkResult.triggeredCount,
            eventsTotal: events.total,
            compareWithoutPromoBest: compareWithoutPromo.rows[0]?.latestUnitPrice ?? null,
            compareWithPromoBest: compareWithPromo.rows[0]?.latestUnitPrice ?? null,
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
