import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { CreateSplitDto } from './dto/create-split.dto';
import { ListSplitsDto } from './dto/list-splits.dto';
import { UpdateSplitAllocationsDto } from './dto/update-split-allocations.dto';
import { UpdateSplitParticipantsDto } from './dto/update-split-participants.dto';
import { SplitsService } from './splits.service';

@Controller('splits')
@UseGuards(AppAuthGuard)
export class SplitsController {
  constructor(private readonly splitsService: SplitsService) {}

  @Post()
  async createSplit(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSplitDto) {
    return this.splitsService.createSplit(user, dto);
  }

  @Get()
  async listSplits(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSplitsDto) {
    return this.splitsService.listSplits(user, query);
  }

  @Get(':splitId')
  async getSplit(@CurrentUser() user: AuthenticatedUser, @Param('splitId') splitId: string) {
    return this.splitsService.getSplit(user, splitId);
  }

  @Patch(':splitId/participants')
  async updateParticipants(
    @CurrentUser() user: AuthenticatedUser,
    @Param('splitId') splitId: string,
    @Body() dto: UpdateSplitParticipantsDto,
  ) {
    return this.splitsService.updateParticipants(user, splitId, dto);
  }

  @Patch(':splitId/allocations')
  async updateAllocations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('splitId') splitId: string,
    @Body() dto: UpdateSplitAllocationsDto,
  ) {
    return this.splitsService.updateAllocations(user, splitId, dto);
  }

  @Post(':splitId/finalize')
  async finalizeSplit(@CurrentUser() user: AuthenticatedUser, @Param('splitId') splitId: string) {
    return this.splitsService.finalizeSplit(user, splitId);
  }

  @Get(':splitId/balances')
  async getBalances(@CurrentUser() user: AuthenticatedUser, @Param('splitId') splitId: string) {
    return this.splitsService.getBalances(user, splitId);
  }
}
