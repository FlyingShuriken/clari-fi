import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { ReceiptParseDto } from './dto/receipt-parse.dto';
import { VoiceParseDto } from './dto/voice-parse.dto';
import { ParseService } from './parse.service';

@Controller()
@UseGuards(AppAuthGuard)
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post('expenses/voice/parse')
  async parseVoice(@Body() dto: VoiceParseDto) {
    return this.parseService.parseVoice(dto);
  }

  @Post('receipts/parse')
  async parseReceipt(@Body() dto: ReceiptParseDto) {
    return this.parseService.parseReceipt(dto);
  }
}
