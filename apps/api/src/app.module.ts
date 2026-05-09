import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './infrastructure/config/env.validation';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ProvidersModule } from './infrastructure/providers/providers.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContributionsModule } from './modules/contributions/contributions.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FamiliesModule } from './modules/families/families.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParseModule } from './modules/parse/parse.module';
import { PricesModule } from './modules/prices/prices.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SplitsModule } from './modules/splits/splits.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MetricsModule,
    ProvidersModule,
    StorageModule,
    AuthModule,
    HealthModule,
    NotificationsModule,
    ArtifactsModule,
    ContributionsModule,
    ParseModule,
    ExpensesModule,
    FamiliesModule,
    PricesModule,
    ReportsModule,
    RewardsModule,
    SplitsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
