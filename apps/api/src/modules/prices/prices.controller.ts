import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { BackfillPricesDto } from './dto/backfill-prices.dto';
import { PriceCompareQueryDto } from './dto/price-compare-query.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
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

  @Post('backfill')
  async backfill(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BackfillPricesDto,
    @Headers('x-backfill-token') backfillToken?: string,
  ) {
    return this.pricesService.backfill(user, dto, backfillToken);
  }
}
