import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContributionsModule } from '../contributions/contributions.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [AuthModule, ContributionsModule],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
