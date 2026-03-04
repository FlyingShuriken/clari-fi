import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HeuristicExpenseParserProvider } from './expense-parser.provider';
import { ExpenseParserRouterProvider } from './expense-parser-router.provider';
import { OpenRouterExpenseParserProvider } from './openrouter-expense-parser.provider';
import { OpenRouterOcrProvider } from './openrouter-ocr.provider';
import { OpenRouterSttProvider } from './openrouter-stt.provider';
import {
  EXPENSE_PARSER_PROVIDER,
  OCR_PROVIDER,
  STT_PROVIDER,
} from './provider.interfaces';

@Module({
  imports: [ConfigModule],
  providers: [
    HeuristicExpenseParserProvider,
    ExpenseParserRouterProvider,
    OpenRouterExpenseParserProvider,
    OpenRouterSttProvider,
    OpenRouterOcrProvider,
    {
      provide: STT_PROVIDER,
      useExisting: OpenRouterSttProvider,
    },
    {
      provide: OCR_PROVIDER,
      useExisting: OpenRouterOcrProvider,
    },
    {
      provide: EXPENSE_PARSER_PROVIDER,
      useExisting: ExpenseParserRouterProvider,
    },
  ],
  exports: [STT_PROVIDER, OCR_PROVIDER, EXPENSE_PARSER_PROVIDER],
})
export class ProvidersModule {}
