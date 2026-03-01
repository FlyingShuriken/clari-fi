import { Module } from '@nestjs/common';
import { MockOcrProvider } from './mock-ocr.provider';
import { MockParserProvider } from './mock-parser.provider';
import { MockSttProvider } from './mock-stt.provider';
import { OCR_PROVIDER, PARSER_PROVIDER, STT_PROVIDER } from './provider.interfaces';

@Module({
  providers: [
    MockSttProvider,
    MockOcrProvider,
    MockParserProvider,
    {
      provide: STT_PROVIDER,
      useExisting: MockSttProvider,
    },
    {
      provide: OCR_PROVIDER,
      useExisting: MockOcrProvider,
    },
    {
      provide: PARSER_PROVIDER,
      useExisting: MockParserProvider,
    },
  ],
  exports: [STT_PROVIDER, OCR_PROVIDER, PARSER_PROVIDER],
})
export class ProvidersModule {}
