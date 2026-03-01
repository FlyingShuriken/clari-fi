import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  OCR_PROVIDER,
  OcrProvider,
  PARSER_PROVIDER,
  ParserProvider,
  STT_PROVIDER,
  SttProvider,
} from '../providers/provider.interfaces';
import { ReceiptParseDto } from './dto/receipt-parse.dto';
import { VoiceParseDto } from './dto/voice-parse.dto';

@Injectable()
export class ParseService {
  constructor(
    @Inject(STT_PROVIDER) private readonly sttProvider: SttProvider,
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
    @Inject(PARSER_PROVIDER) private readonly parserProvider: ParserProvider,
  ) {}

  async parseVoice(dto: VoiceParseDto) {
    if (!dto.text && !dto.audioBase64) {
      throw new BadRequestException('Either text or audioBase64 must be provided');
    }

    const stt = await this.sttProvider.transcribe({
      audioBase64: dto.audioBase64,
      text: dto.text,
      locale: dto.locale,
    });

    if (!stt.transcript) {
      throw new BadRequestException('Could not produce transcript from input');
    }

    const parsed = await this.parserProvider.parseVoiceTranscript(stt.transcript);
    const { confidenceMap, ...voiceCandidate } = parsed;

    return {
      transcript: stt.transcript,
      sttConfidence: stt.confidence,
      candidate: {
        source: 'VOICE',
        currency: 'MYR',
        transactionAt: dto.transactionAt ?? new Date().toISOString(),
        ...voiceCandidate,
      },
      confidenceMap,
    };
  }

  async parseReceipt(dto: ReceiptParseDto) {
    if (!dto.imageBase64 && !dto.imageUrl && !dto.mockText) {
      throw new BadRequestException(
        'Provide imageBase64, imageUrl, or mockText for parsing',
      );
    }

    const ocr = await this.ocrProvider.extract({
      imageBase64: dto.imageBase64,
      imageUrl: dto.imageUrl,
      mockText: dto.mockText,
    });

    const parsed = await this.parserProvider.parseReceipt(ocr.rawText);
    const { confidenceMap, ...receiptCandidate } = parsed;

    return {
      ocr: {
        confidence: ocr.confidence,
      },
      candidate: receiptCandidate,
      rawText: ocr.rawText,
      rawPayload: ocr.rawPayload,
      confidenceMap,
    };
  }
}
