import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../infrastructure/providers/providers.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ItemNormalizerService } from './item-normalizer.service';
import { PricesAlertsScheduler } from './prices-alerts.scheduler';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { StoreResolverService } from './store-resolver.service';

@Module({
  imports: [AuthModule, ProvidersModule, NotificationsModule, SubscriptionsModule],
  controllers: [PricesController],
  providers: [PricesService, ItemNormalizerService, StoreResolverService, PricesAlertsScheduler],
  exports: [PricesService],
})
export class PricesModule {}
