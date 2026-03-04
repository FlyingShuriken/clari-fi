import { Controller, Delete, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AppAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices')
  async registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.notificationsService.registerDevice(user, dto);
  }

  @Get('devices')
  async listDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listDevices(user);
  }

  @Delete('devices/:token')
  async revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.notificationsService.revokeDevice(user, token);
  }
}
