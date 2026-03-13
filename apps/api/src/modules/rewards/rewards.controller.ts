import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { ListRewardsQueryDto } from './dto/list-rewards-query.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { RewardsService } from './rewards.service';

@Controller('rewards')
@UseGuards(AppAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getSummary(user);
  }

  @Get('catalog')
  async listCatalog() {
    return this.rewardsService.listCatalog();
  }

  @Get('ledger')
  async listLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRewardsQueryDto,
  ) {
    return this.rewardsService.listLedger(user, query.limit);
  }

  @Get('redemptions')
  async listRedemptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRewardsQueryDto,
  ) {
    return this.rewardsService.listRedemptions(user, query.limit);
  }

  @Post('redeem')
  async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.rewardsService.redeem(user, dto.rewardId);
  }
}
