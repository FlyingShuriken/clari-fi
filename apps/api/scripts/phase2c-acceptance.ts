import 'reflect-metadata';

process.env.PUSH_PROVIDER = process.env.PUSH_PROVIDER ?? 'mock';
process.env.PUSH_NOTIFICATIONS_ENABLED = process.env.PUSH_NOTIFICATIONS_ENABLED ?? 'true';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
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
  const notificationsService = app.get(NotificationsService);

  try {
    const seedUser = await prisma.user.upsert({
      where: { email: 'phase2c.acceptance@clarifi.local' },
      create: {
        email: 'phase2c.acceptance@clarifi.local',
        clerkUserId: 'phase2c-acceptance-user',
      },
      update: {},
      select: { id: true, email: true, clerkUserId: true },
    });

    await prisma.alertEvent.deleteMany({ where: { userId: seedUser.id } });
    await prisma.priceAlert.deleteMany({ where: { userId: seedUser.id } });
    await prisma.pushDevice.deleteMany({ where: { userId: seedUser.id } });
    await prisma.priceObservation.deleteMany({ where: { userId: seedUser.id } });
    await prisma.receipt.deleteMany({ where: { userId: seedUser.id } });
    await prisma.expense.deleteMany({ where: { userId: seedUser.id } });

    const authUser: AuthenticatedUser = {
      id: seedUser.id,
      email: seedUser.email,
      clerkUserId: seedUser.clerkUserId,
    };

    await expensesService.confirmExpense(authUser, {
      source: 'MANUAL',
      provenance: 'MANUAL',
      currency: 'MYR',
      transactionAt: new Date().toISOString(),
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
          confidence: 0.92,
        },
      ],
    });

    await pricesService.createAlert(authUser, {
      item: 'watermelon',
      targetUnitPrice: 6,
      radiusKm: 10,
      areaText: 'Kota Kinabalu',
    });

    await notificationsService.registerDevice(authUser, {
      expoPushToken: 'ExponentPushToken[phase2c-acceptance-token]',
      platform: 'ios',
      appVersion: '0.1.0',
    });

    const schedulerResult = await pricesService.runScheduledAlertChecks();
    assertCondition(schedulerResult.checked >= 1, 'Expected scheduler to check at least one alert');
    assertCondition(
      schedulerResult.triggeredCount >= 1,
      'Expected scheduler to trigger at least one alert event',
    );
    assertCondition(
      schedulerResult.pushAttempted >= 1,
      'Expected scheduler to attempt at least one push delivery',
    );

    const events = await pricesService.listAlertEvents(authUser, {
      limit: 10,
      unreadOnly: false,
    });
    assertCondition(events.total >= 1, 'Expected at least one alert event');
    const firstEvent = events.items[0];
    assertCondition(
      Boolean(firstEvent.deliveryStatus),
      'Expected alert event to include delivery status metadata',
    );

    const markAll = await pricesService.markAllAlertEventsRead(authUser);
    assertCondition(markAll.updated >= 1, 'Expected mark-all-read to update at least one event');

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          checks: {
            schedulerResult,
            eventsTotal: events.total,
            firstEventDeliveryStatus: firstEvent.deliveryStatus,
            markAll,
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
