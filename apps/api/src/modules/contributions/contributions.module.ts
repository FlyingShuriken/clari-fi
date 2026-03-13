import { Module } from '@nestjs/common';
import { ContributionStreaksService } from './contribution-streaks.service';
import { ContributionsService } from './contributions.service';

@Module({
  providers: [ContributionsService, ContributionStreaksService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
