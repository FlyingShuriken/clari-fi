import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ExpenseProvenance } from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import {
  EXPENSE_PARSER_PROVIDER,
  ExpenseParserProvider,
  OCR_PROVIDER,
  OcrProvider,
  STT_PROVIDER,
  SttProvider,
} from '../../infrastructure/providers/provider.interfaces';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { SupabaseStorageService } from '../../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ParseDocumentDto } from './dto/parse-document.dto';
import { ParseReceiptDto } from './dto/parse-receipt.dto';
import { ParseVoiceDto } from './dto/parse-voice.dto';

@Injectable()
export class ParseService {
  constructor(
    @Inject(STT_PROVIDER) private readonly sttProvider: SttProvider,
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
    @Inject(EXPENSE_PARSER_PROVIDER)
    private readonly parserProvider: ExpenseParserProvider,
    private readonly storage: SupabaseStorageService,
    private readonly queueService: QueueService,
    private readonly metrics: MetricsService,
  ) {}

  private async resolveDocumentImages(input: {
    fileRefs?: string[];
    imageBase64s?: string[];
    mimeType?: string;
  }) {
    const images = input.imageBase64s?.map((imageBase64) => ({
      imageBase64,
      mimeType: input.mimeType ?? 'image/jpeg',
    })) ?? [];

    const fileRefs = input.fileRefs?.filter((value) => value.trim()) ?? [];
    for (const fileRef of fileRefs) {
      if (fileRef.startsWith('local://')) {
        continue;
      }
      const downloaded = await this.storage.downloadAsBase64(fileRef);
      if (!downloaded) {
        throw new BadRequestException(`Unable to download artifact ${fileRef}`);
      }
      images.push({
        imageBase64: downloaded,
        mimeType: input.mimeType ?? 'image/jpeg',
      });
    }

    if (images.length === 0) {
      if (fileRefs.some((fileRef) => fileRef.startsWith('local://'))) {
        throw new BadRequestException(
          'Local artifact refs require inline image data. Retry from the app after reselecting the images.',
        );
      }
      throw new BadRequestException('Provide fileRefs or imageBase64s for document parsing');
    }

    return images;
  }

  async parseVoice(user: AuthenticatedUser, dto: ParseVoiceDto) {
    const startedAt = Date.now();

    if (!dto.transcript && !dto.audioBase64) {
      throw new BadRequestException('Provide transcript or audioBase64');
    }

    let transcript = dto.transcript?.trim() ?? '';
    let sttConfidence = dto.deviceConfidence ?? 0.95;
    let provenance: ExpenseProvenance = ExpenseProvenance.VOICE_ON_DEVICE;

    if (!transcript) {
      const stt = await this.sttProvider.transcribe({
        audioBase64: dto.audioBase64,
        locale: dto.locale,
      });
      transcript = stt.transcript;
      sttConfidence = stt.confidence;
      provenance = ExpenseProvenance.VOICE_CLOUD;
    }

    if (!transcript) {
      throw new BadRequestException('Could not produce transcript from input');
    }

    const parsed = await this.parserProvider.parseVoiceTranscript(transcript);
    const { confidenceMap, parserMeta, ...voiceCandidate } = parsed;

    const parseLatencyMs = Date.now() - startedAt;
    this.metrics.trackTiming('parse.voice.latency_ms', parseLatencyMs, {
      path: provenance,
      userId: user.id,
    });

    return {
      transcript,
      sttConfidence,
      candidate: {
        source: 'VOICE',
        provenance,
        currency: 'MYR',
        transactionAt: dto.transactionAt ?? new Date().toISOString(),
        parseLatencyMs,
        ...voiceCandidate,
      },
      confidenceMap,
      parseMeta: {
        parsePath: provenance,
        parseLatencyMs,
        parserEngine: parserMeta?.engine ?? 'heuristic',
        fallbackUsed: parserMeta?.fallbackUsed ?? false,
        shadowCompared: parserMeta?.shadowCompared ?? false,
        shadowMismatchFields: parserMeta?.shadowMismatchFields ?? [],
      },
    };
  }

  async parseReceipt(user: AuthenticatedUser, dto: ParseReceiptDto) {
    const startedAt = Date.now();

    let imageBase64 = dto.imageBase64;
    if (!imageBase64 && dto.fileRef) {
      imageBase64 = (await this.storage.downloadAsBase64(dto.fileRef)) ?? undefined;
    }

    if (!imageBase64) {
      throw new BadRequestException('Provide imageBase64 or fileRef for parsing');
    }

    const ocr = await this.ocrProvider.extract({ imageBase64 });

    const parsed = await this.parserProvider.parseReceipt(ocr.rawText);
    const { confidenceMap, parserMeta, ...receiptCandidate } = parsed;

    const parseLatencyMs = Date.now() - startedAt;
    this.metrics.trackTiming('parse.receipt.latency_ms', parseLatencyMs, {
      userId: user.id,
    });

    await this.queueService.enqueue('receipt-parse-audit', {
      type: 'receipt_parse',
      payload: {
        userId: user.id,
        parseLatencyMs,
        fileRef: dto.fileRef ?? null,
      },
    });

    return {
      ocr: {
        confidence: ocr.confidence,
      },
      candidate: {
        source: 'RECEIPT',
        provenance: 'RECEIPT_OCR',
        transactionAt: receiptCandidate.receiptDate ?? new Date().toISOString(),
        ...receiptCandidate,
      },
      fileRef: dto.fileRef,
      rawText: ocr.rawText,
      rawPayload: ocr.rawPayload,
      confidenceMap,
      parseMeta: {
        parsePath: 'RECEIPT_OCR',
        parseLatencyMs,
        parserEngine: parserMeta?.engine ?? 'heuristic',
        fallbackUsed: parserMeta?.fallbackUsed ?? false,
        shadowCompared: parserMeta?.shadowCompared ?? false,
        shadowMismatchFields: parserMeta?.shadowMismatchFields ?? [],
      },
    };
  }

  async parseDocument(user: AuthenticatedUser, dto: ParseDocumentDto) {
    const startedAt = Date.now();
    const images = await this.resolveDocumentImages({
      fileRefs: dto.fileRefs,
      imageBase64s: dto.imageBase64s,
      mimeType: dto.mimeType,
    });

    const parsed = await this.parserProvider.parseDocumentImages({
      images,
      preferredKind: dto.preferredKind,
    });
    const parseLatencyMs = Date.now() - startedAt;

    this.metrics.trackTiming('parse.document.latency_ms', parseLatencyMs, {
      userId: user.id,
      documentKind: parsed.documentKind,
    });

    if (parsed.documentKind === 'receipt') {
      return {
        documentKind: 'receipt' as const,
        confidence: parsed.confidence,
        candidate: {
          source: 'RECEIPT' as const,
          provenance: 'RECEIPT_OCR' as const,
          transactionAt: parsed.receipt.receiptDate ?? new Date().toISOString(),
          merchantText: parsed.receipt.merchantText,
          note: parsed.receipt.note,
          totalAmount: parsed.receipt.totalAmount,
          currency: parsed.receipt.currency,
          lineItems: parsed.receipt.lineItems,
        },
        fileRefs: dto.fileRefs ?? [],
        parseMeta: {
          parsePath: 'DOCUMENT_LLM',
          parseLatencyMs,
          parserEngine: parsed.receipt.parserMeta?.engine ?? 'openrouter',
        },
      };
    }

    if (parsed.documentKind === 'flyer') {
      return {
        documentKind: 'flyer' as const,
        confidence: parsed.confidence,
        candidate: {
          merchantText: parsed.flyer.merchantText,
          areaText: parsed.flyer.areaText,
          note: parsed.flyer.note,
          validFrom: parsed.flyer.validFrom,
          validTo: parsed.flyer.validTo,
          currency: parsed.flyer.currency,
          lineItems: parsed.flyer.lineItems,
        },
        fileRefs: dto.fileRefs ?? [],
        parseMeta: {
          parsePath: 'DOCUMENT_LLM',
          parseLatencyMs,
          parserEngine: parsed.flyer.parserMeta?.engine ?? 'openrouter',
        },
      };
    }

    return {
      documentKind: 'unknown' as const,
      confidence: parsed.confidence,
      reason: parsed.reason ?? 'Could not classify the uploaded document.',
      fileRefs: dto.fileRefs ?? [],
      parseMeta: {
        parsePath: 'DOCUMENT_LLM',
        parseLatencyMs,
        parserEngine: 'openrouter' as const,
      },
    };
  }
}
