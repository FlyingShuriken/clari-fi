import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
