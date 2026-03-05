import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { CreateFamilyInviteDto } from './dto/create-family-invite.dto';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { UpdateFamilyMemberDto } from './dto/update-family-member.dto';
import { FamiliesService } from './families.service';

@Controller('families')
@UseGuards(AppAuthGuard)
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  async createFamily(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFamilyDto) {
    return this.familiesService.createFamily(user, dto);
  }

  @Get()
  async listFamilies(@CurrentUser() user: AuthenticatedUser) {
    return this.familiesService.listFamilies(user);
  }

  @Post(':familyId/invites')
  async createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateFamilyInviteDto,
  ) {
    return this.familiesService.createInvite(user, familyId, dto);
  }

  @Post('join')
  async joinFamily(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinFamilyDto) {
    return this.familiesService.joinByCode(user, dto);
  }

  @Patch(':familyId/members/:memberId')
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.familiesService.updateMemberRole(user, familyId, memberId, dto);
  }

  @Delete(':familyId/members/:memberId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.familiesService.removeMember(user, familyId, memberId);
  }
}
