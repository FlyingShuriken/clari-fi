import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../infrastructure/providers/providers.module';
import { AuthModule } from '../auth/auth.module';
import { ItemNormalizerService } from './item-normalizer.service';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { StoreResolverService } from './store-resolver.service';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [PricesController],
  providers: [PricesService, ItemNormalizerService, StoreResolverService],
  exports: [PricesService],
})
export class PricesModule {}
