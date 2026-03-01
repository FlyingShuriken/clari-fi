import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ProvidersModule } from '../providers/providers.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';

@Module({
  imports: [CommonModule, ProvidersModule],
  controllers: [ParseController],
  providers: [ParseService],
})
export class ParseModule {}
