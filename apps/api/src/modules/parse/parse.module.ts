import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../infrastructure/providers/providers.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';

@Module({
  imports: [ProvidersModule],
  controllers: [ParseController],
  providers: [ParseService],
})
export class ParseModule {}
