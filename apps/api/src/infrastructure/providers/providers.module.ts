import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeuristicExpenseParserProvider } from './expense-parser.provider';
import { MockOcrProvider } from './mock-ocr.provider';
import { MockSttProvider } from './mock-stt.provider';
import { OpenRouterOcrProvider } from './openrouter-ocr.provider';
import { OpenRouterSttProvider } from './openrouter-stt.provider';
import {
  EXPENSE_PARSER_PROVIDER,
  OCR_PROVIDER,
  OcrProvider,
  STT_PROVIDER,
  SttProvider,
} from './provider.interfaces';

function shouldUseOpenRouterProvider(
  providerSetting: string | undefined,
  openRouterApiKey: string | undefined,
): boolean {
  const normalized = providerSetting?.trim().toLowerCase();
  if (normalized === 'openrouter') {
    return true;
  }
  if (normalized === 'mock') {
    return false;
  }

  return Boolean(openRouterApiKey);
}

@Module({
  imports: [ConfigModule],
  providers: [
    MockSttProvider,
    MockOcrProvider,
    HeuristicExpenseParserProvider,
    OpenRouterSttProvider,
    OpenRouterOcrProvider,
    {
      provide: STT_PROVIDER,
      useFactory: (
        config: ConfigService,
        openRouterProvider: OpenRouterSttProvider,
        mockProvider: MockSttProvider,
      ): SttProvider => {
        if (
          shouldUseOpenRouterProvider(
            config.get<string>('STT_PROVIDER'),
            config.get<string>('OPENROUTER_API_KEY'),
          )
        ) {
          return openRouterProvider;
        }
        return mockProvider;
      },
      inject: [ConfigService, OpenRouterSttProvider, MockSttProvider],
    },
    {
      provide: OCR_PROVIDER,
      useFactory: (
        config: ConfigService,
        openRouterProvider: OpenRouterOcrProvider,
        mockProvider: MockOcrProvider,
      ): OcrProvider => {
        if (
          shouldUseOpenRouterProvider(
            config.get<string>('OCR_PROVIDER'),
            config.get<string>('OPENROUTER_API_KEY'),
          )
        ) {
          return openRouterProvider;
        }
        return mockProvider;
      },
      inject: [ConfigService, OpenRouterOcrProvider, MockOcrProvider],
    },
    {
      provide: EXPENSE_PARSER_PROVIDER,
      useExisting: HeuristicExpenseParserProvider,
    },
  ],
  exports: [STT_PROVIDER, OCR_PROVIDER, EXPENSE_PARSER_PROVIDER],
})
export class ProvidersModule {}
