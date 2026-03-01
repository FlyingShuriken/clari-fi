import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockOcrProvider } from './mock-ocr.provider';
import { MockParserProvider } from './mock-parser.provider';
import { MockSttProvider } from './mock-stt.provider';
import { OpenRouterOcrProvider } from './openrouter-ocr.provider';
import { OpenRouterSttProvider } from './openrouter-stt.provider';
import { OCR_PROVIDER, PARSER_PROVIDER, STT_PROVIDER } from './provider.interfaces';

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
    MockParserProvider,
    OpenRouterSttProvider,
    OpenRouterOcrProvider,
    {
      provide: STT_PROVIDER,
      useFactory: (
        config: ConfigService,
        openRouterProvider: OpenRouterSttProvider,
        mockProvider: MockSttProvider,
      ) => {
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
      ) => {
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
      provide: PARSER_PROVIDER,
      useExisting: MockParserProvider,
    },
  ],
  exports: [STT_PROVIDER, OCR_PROVIDER, PARSER_PROVIDER],
})
export class ProvidersModule {}
