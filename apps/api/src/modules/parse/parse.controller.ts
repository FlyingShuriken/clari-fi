import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AppAuthGuard } from '../auth/guards/app-auth.guard';
import { ParseReceiptDto } from './dto/parse-receipt.dto';
import { ParseVoiceDto } from './dto/parse-voice.dto';
import { ParseService } from './parse.service';

@Controller('parse')
@UseGuards(AppAuthGuard)
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post('voice')
  async parseVoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseVoiceDto,
  ) {
    return this.parseService.parseVoice(user, dto);
  }

  @Post('receipt')
  async parseReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseReceiptDto,
  ) {
    return this.parseService.parseReceipt(user, dto);
  }
}
