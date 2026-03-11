import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { UpdateMockSubscriptionDto } from './dto/update-mock-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscription')
@UseGuards(AppAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  async getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getCurrentForUser(user);
  }

  @Patch('mock')
  async updateMock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMockSubscriptionDto,
  ) {
    return this.subscriptionsService.updateMockSubscription(user, dto);
  }
}
