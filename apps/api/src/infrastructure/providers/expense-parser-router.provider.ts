import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { HeuristicExpenseParserProvider } from './expense-parser.provider';
import { OpenRouterExpenseParserProvider } from './openrouter-expense-parser.provider';
import {
  DocumentImageInput,
  ExpenseParserProvider,
  ParsedExpenseResult,
  ParsedImageDocumentResult,
  ParsedReceiptResult,
} from './provider.interfaces';

type ParserMode = 'heuristic' | 'openrouter' | 'shadow';

function normalizeMode(value: string | undefined): ParserMode | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'heuristic' || normalized === 'openrouter' || normalized === 'shadow') {
    return normalized;
  }
  return undefined;
}

function calculateVoiceMismatchFields(
  heuristic: ParsedExpenseResult,
  llm: ParsedExpenseResult,
): string[] {
  const fields: string[] = [];
  const heuristicMerchant = (heuristic.merchantText ?? '').trim().toLowerCase();
  const llmMerchant = (llm.merchantText ?? '').trim().toLowerCase();
  if (heuristicMerchant !== llmMerchant) {
    fields.push('merchantText');
  }

  if (Math.abs(heuristic.totalAmount - llm.totalAmount) > 0.01) {
    fields.push('totalAmount');
  }

  if ((heuristic.paymentMethod ?? '') !== (llm.paymentMethod ?? '')) {
    fields.push('paymentMethod');
  }

  if (heuristic.lineItems.length !== llm.lineItems.length) {
    fields.push('lineItems');
  }

  return fields;
}

function calculateReceiptMismatchFields(
  heuristic: ParsedReceiptResult,
  llm: ParsedReceiptResult,
): string[] {
  const fields: string[] = [];
  const heuristicMerchant = (heuristic.merchantText ?? '').trim().toLowerCase();
  const llmMerchant = (llm.merchantText ?? '').trim().toLowerCase();
  if (heuristicMerchant !== llmMerchant) {
    fields.push('merchantText');
  }

  if (Math.abs(heuristic.totalAmount - llm.totalAmount) > 0.01) {
    fields.push('totalAmount');
  }

  if (heuristic.currency !== llm.currency) {
    fields.push('currency');
  }

  if (heuristic.lineItems.length !== llm.lineItems.length) {
    fields.push('lineItems');
  }

  return fields;
}

@Injectable()
export class ExpenseParserRouterProvider implements ExpenseParserProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly heuristicParser: HeuristicExpenseParserProvider,
    private readonly openRouterParser: OpenRouterExpenseParserProvider,
  ) {}

  private resolveMode(): ParserMode {
    const mode = normalizeMode(this.config.get<string>('EXPENSE_PARSER_PROVIDER'));
    if (mode) {
      return mode;
    }

    if (this.config.get<string>('OPENROUTER_API_KEY')?.trim()) {
      return 'shadow';
    }

    return 'heuristic';
  }

  private async parseVoiceWithOpenRouter(input: string): Promise<ParsedExpenseResult> {
    const startedAt = Date.now();
    try {
      const parsed = await this.openRouterParser.parseVoiceTranscript(input);
      this.metrics.trackCounter('parse.llm.success.count', 1, { kind: 'voice' });
      this.metrics.trackTiming('parse.llm.latency_ms', Date.now() - startedAt, {
        kind: 'voice',
      });
      return parsed;
    } catch (error) {
      this.metrics.trackCounter('parse.llm.failure.count', 1, { kind: 'voice' });
      throw error;
    }
  }

  private async parseReceiptWithOpenRouter(input: string): Promise<ParsedReceiptResult> {
    const startedAt = Date.now();
    try {
      const parsed = await this.openRouterParser.parseReceipt(input);
      this.metrics.trackCounter('parse.llm.success.count', 1, { kind: 'receipt' });
      this.metrics.trackTiming('parse.llm.latency_ms', Date.now() - startedAt, {
        kind: 'receipt',
      });
      return parsed;
    } catch (error) {
      this.metrics.trackCounter('parse.llm.failure.count', 1, { kind: 'receipt' });
      throw error;
    }
  }

  private async parseVoiceWithFallback(
    transcript: string,
    mode: Exclude<ParserMode, 'shadow'>,
  ): Promise<ParsedExpenseResult> {
    if (mode === 'heuristic') {
      const parsed = await this.heuristicParser.parseVoiceTranscript(transcript);
      parsed.parserMeta = { engine: 'heuristic' };
      return parsed;
    }

    try {
      return await this.parseVoiceWithOpenRouter(transcript);
    } catch {
      this.metrics.trackCounter('parse.llm.fallback.count', 1, { kind: 'voice' });
      const fallback = await this.heuristicParser.parseVoiceTranscript(transcript);
      fallback.parserMeta = {
        ...(fallback.parserMeta ?? {}),
        engine: 'heuristic',
        fallbackUsed: true,
      };
      return fallback;
    }
  }

  private async parseReceiptWithFallback(
    rawText: string,
    mode: Exclude<ParserMode, 'shadow'>,
  ): Promise<ParsedReceiptResult> {
    if (mode === 'heuristic') {
      const parsed = await this.heuristicParser.parseReceipt(rawText);
      parsed.parserMeta = { engine: 'heuristic' };
      return parsed;
    }

    try {
      return await this.parseReceiptWithOpenRouter(rawText);
    } catch {
      this.metrics.trackCounter('parse.llm.fallback.count', 1, { kind: 'receipt' });
      const fallback = await this.heuristicParser.parseReceipt(rawText);
      fallback.parserMeta = {
        ...(fallback.parserMeta ?? {}),
        engine: 'heuristic',
        fallbackUsed: true,
      };
      return fallback;
    }
  }

  async parseVoiceTranscript(transcript: string): Promise<ParsedExpenseResult> {
    const mode = this.resolveMode();
    if (mode !== 'shadow') {
      return this.parseVoiceWithFallback(transcript, mode);
    }

    const heuristic = await this.heuristicParser.parseVoiceTranscript(transcript);
    heuristic.parserMeta = {
      ...(heuristic.parserMeta ?? {}),
      engine: 'heuristic',
      shadowCompared: true,
    };

    try {
      const llm = await this.parseVoiceWithOpenRouter(transcript);
      const mismatches = calculateVoiceMismatchFields(heuristic, llm);
      heuristic.parserMeta.shadowMismatchFields = mismatches;
      this.metrics.trackCounter('parse.shadow.compared.count', 1, { kind: 'voice' });
      if (mismatches.length > 0) {
        this.metrics.trackCounter('parse.shadow.diff.count', 1, {
          kind: 'voice',
          fields: mismatches.join(','),
        });
      }
    } catch {
      heuristic.parserMeta.shadowMismatchFields = ['llm_error'];
    }

    return heuristic;
  }

  async parseReceipt(rawText: string): Promise<ParsedReceiptResult> {
    const mode = this.resolveMode();
    if (mode !== 'shadow') {
      return this.parseReceiptWithFallback(rawText, mode);
    }

    const heuristic = await this.heuristicParser.parseReceipt(rawText);
    heuristic.parserMeta = {
      ...(heuristic.parserMeta ?? {}),
      engine: 'heuristic',
      shadowCompared: true,
    };

    try {
      const llm = await this.parseReceiptWithOpenRouter(rawText);
      const mismatches = calculateReceiptMismatchFields(heuristic, llm);
      heuristic.parserMeta.shadowMismatchFields = mismatches;
      this.metrics.trackCounter('parse.shadow.compared.count', 1, { kind: 'receipt' });
      if (mismatches.length > 0) {
        this.metrics.trackCounter('parse.shadow.diff.count', 1, {
          kind: 'receipt',
          fields: mismatches.join(','),
        });
      }
    } catch {
      heuristic.parserMeta.shadowMismatchFields = ['llm_error'];
    }

    return heuristic;
  }

  async parseDocumentImages(input: {
    images: DocumentImageInput[];
    preferredKind?: 'receipt' | 'flyer';
  }): Promise<ParsedImageDocumentResult> {
    const startedAt = Date.now();
    try {
      const parsed = await this.openRouterParser.parseDocumentImages(input);
      this.metrics.trackCounter('parse.llm.success.count', 1, { kind: `document:${parsed.documentKind}` });
      this.metrics.trackTiming('parse.llm.latency_ms', Date.now() - startedAt, {
        kind: `document:${parsed.documentKind}`,
      });
      return parsed;
    } catch (error) {
      this.metrics.trackCounter('parse.llm.failure.count', 1, { kind: 'document' });
      throw error;
    }
  }
}
