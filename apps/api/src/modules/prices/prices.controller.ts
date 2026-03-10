import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { BackfillPricesDto } from './dto/backfill-prices.dto';
import { CheckAlertsDto } from './dto/check-alerts.dto';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { IngestPromoDto } from './dto/ingest-promo.dto';
import { ListAlertEventsDto } from './dto/list-alert-events.dto';
import { ListPromosDto } from './dto/list-promos.dto';
import { PriceCompareQueryDto } from './dto/price-compare-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceSignalQueryDto } from './dto/price-signal-query.dto';
import { ReviewPromoObservationsDto } from './dto/review-promo-observations.dto';
import { SearchPriceLocationsQueryDto } from './dto/search-price-locations-query.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';
import { PricesService } from './prices.service';

@Controller('prices')
@UseGuards(AppAuthGuard)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get('history')
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.pricesService.getHistory(user, query);
  }

  @Get('compare')
  async compare(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PriceCompareQueryDto,
  ) {
    return this.pricesService.compare(user, query);
  }

  @Get('locations/search')
  async searchLocations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchPriceLocationsQueryDto,
  ) {
    return this.pricesService.searchLocations(user, query);
  }

  @Get('signal')
  async signal(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PriceSignalQueryDto,
  ) {
    return this.pricesService.getSignal(user, query);
  }

  @Post('backfill')
  async backfill(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BackfillPricesDto,
    @Headers('x-backfill-token') backfillToken?: string,
  ) {
    return this.pricesService.backfill(user, dto, backfillToken);
  }

  @Post('alerts')
  async createAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceAlertDto,
  ) {
    return this.pricesService.createAlert(user, dto);
  }

  @Get('alerts')
  async listAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.pricesService.listAlerts(user);
  }

  @Patch('alerts/:alertId')
  async updateAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId') alertId: string,
    @Body() dto: UpdatePriceAlertDto,
  ) {
    return this.pricesService.updateAlert(user, alertId, dto);
  }

  @Delete('alerts/:alertId')
  async disableAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId') alertId: string,
  ) {
    return this.pricesService.disableAlert(user, alertId);
  }

  @Post('alerts/check')
  async checkAlerts(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckAlertsDto,
  ) {
    return this.pricesService.checkAlerts(user, dto);
  }

  @Get('alerts/events')
  async listAlertEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAlertEventsDto,
  ) {
    return this.pricesService.listAlertEvents(user, query);
  }

  @Patch('alerts/events/:eventId/read')
  async markAlertEventRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.pricesService.markAlertEventRead(user, eventId);
  }

  @Post('alerts/events/read-all')
  async markAllAlertEventsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.pricesService.markAllAlertEventsRead(user);
  }

  @Post('promos/ingest')
  async ingestPromo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IngestPromoDto,
  ) {
    return this.pricesService.ingestPromo(user, dto);
  }

  @Get('promos')
  async listPromos(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPromosDto,
  ) {
    return this.pricesService.listPromos(user, query);
  }

  @Patch('promos/review')
  async reviewPromoObservations(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewPromoObservationsDto,
  ) {
    return this.pricesService.reviewPromoObservations(user, dto);
  }
}
