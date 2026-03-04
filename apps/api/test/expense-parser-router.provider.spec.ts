import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../src/infrastructure/metrics/metrics.service';
import { HeuristicExpenseParserProvider } from '../src/infrastructure/providers/expense-parser.provider';
import { ExpenseParserRouterProvider } from '../src/infrastructure/providers/expense-parser-router.provider';
import { OpenRouterExpenseParserProvider } from '../src/infrastructure/providers/openrouter-expense-parser.provider';
import type {
  ParsedExpenseResult,
  ParsedReceiptResult,
} from '../src/infrastructure/providers/provider.interfaces';

function makeVoiceResult(
  overrides: Partial<ParsedExpenseResult> = {},
): ParsedExpenseResult {
  return {
    totalAmount: 5,
    paymentMethod: 'TNG',
    lineItems: [{ descriptionRaw: 'fish', totalPrice: 5 }],
    confidenceMap: {
      totalAmount: 0.9,
      lineItems: 0.8,
      paymentMethod: 0.8,
    },
    ...overrides,
  };
}

function makeReceiptResult(
  overrides: Partial<ParsedReceiptResult> = {},
): ParsedReceiptResult {
  return {
    totalAmount: 8.5,
    currency: 'MYR',
    lineItems: [
      { descriptionRaw: 'fish', totalPrice: 5 },
      { descriptionRaw: 'vegetable', totalPrice: 3.5 },
    ],
    confidenceMap: {
      totalAmount: 0.9,
      lineItems: 0.8,
    },
    ...overrides,
  };
}

describe('ExpenseParserRouterProvider', () => {
  function createRouter(options: {
    mode?: 'heuristic' | 'openrouter' | 'shadow';
    openRouterKey?: string;
    heuristicVoiceResult?: ParsedExpenseResult;
    heuristicReceiptResult?: ParsedReceiptResult;
    openRouterVoiceResult?: ParsedExpenseResult;
    openRouterReceiptResult?: ParsedReceiptResult;
    openRouterVoiceError?: Error;
    openRouterReceiptError?: Error;
  }) {
    const config = new ConfigService({
      EXPENSE_PARSER_PROVIDER: options.mode,
      OPENROUTER_API_KEY: options.openRouterKey ?? '',
    });
    const metrics = {
      trackCounter: jest.fn(),
      trackTiming: jest.fn(),
    } as unknown as MetricsService;

    const heuristic = {
      parseVoiceTranscript: jest
        .fn()
        .mockResolvedValue(options.heuristicVoiceResult ?? makeVoiceResult()),
      parseReceipt: jest
        .fn()
        .mockResolvedValue(options.heuristicReceiptResult ?? makeReceiptResult()),
    } as unknown as HeuristicExpenseParserProvider;

    const openRouter = {
      parseVoiceTranscript: options.openRouterVoiceError
        ? jest.fn().mockRejectedValue(options.openRouterVoiceError)
        : jest
            .fn()
            .mockResolvedValue(options.openRouterVoiceResult ?? makeVoiceResult()),
      parseReceipt: options.openRouterReceiptError
        ? jest.fn().mockRejectedValue(options.openRouterReceiptError)
        : jest
            .fn()
            .mockResolvedValue(options.openRouterReceiptResult ?? makeReceiptResult()),
    } as unknown as OpenRouterExpenseParserProvider;

    const router = new ExpenseParserRouterProvider(
      config,
      metrics,
      heuristic,
      openRouter,
    );

    return {
      router,
      metrics,
      heuristic: heuristic as unknown as {
        parseVoiceTranscript: jest.Mock;
        parseReceipt: jest.Mock;
      },
      openRouter: openRouter as unknown as {
        parseVoiceTranscript: jest.Mock;
        parseReceipt: jest.Mock;
      },
    };
  }

  it('returns heuristic parser output in heuristic mode', async () => {
    const { router, heuristic, openRouter } = createRouter({
      mode: 'heuristic',
    });

    const result = await router.parseVoiceTranscript('Spent RM 5 at pasar');
    expect(result.parserMeta?.engine).toBe('heuristic');
    expect(heuristic.parseVoiceTranscript).toHaveBeenCalledTimes(1);
    expect(openRouter.parseVoiceTranscript).not.toHaveBeenCalled();
  });

  it('returns openrouter parser output in openrouter mode', async () => {
    const { router, heuristic, openRouter } = createRouter({
      mode: 'openrouter',
      openRouterKey: 'sk-test',
      openRouterVoiceResult: makeVoiceResult({
        totalAmount: 12,
        paymentMethod: 'CARD',
        parserMeta: { engine: 'openrouter' },
      }),
    });

    const result = await router.parseVoiceTranscript('Spent RM 12 with card');
    expect(result.totalAmount).toBe(12);
    expect(result.parserMeta?.engine).toBe('openrouter');
    expect(openRouter.parseVoiceTranscript).toHaveBeenCalledTimes(1);
    expect(heuristic.parseVoiceTranscript).not.toHaveBeenCalled();
  });

  it('falls back to heuristic when openrouter parser fails', async () => {
    const { router, heuristic, openRouter, metrics } = createRouter({
      mode: 'openrouter',
      openRouterKey: 'sk-test',
      openRouterVoiceError: new Error('timeout'),
    });

    const result = await router.parseVoiceTranscript('Spent RM 5 at pasar');
    expect(result.parserMeta?.engine).toBe('heuristic');
    expect(result.parserMeta?.fallbackUsed).toBe(true);
    expect(openRouter.parseVoiceTranscript).toHaveBeenCalledTimes(1);
    expect(heuristic.parseVoiceTranscript).toHaveBeenCalledTimes(1);
    expect((metrics.trackCounter as unknown as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        ['parse.llm.failure.count', 1, { kind: 'voice' }],
        ['parse.llm.fallback.count', 1, { kind: 'voice' }],
      ]),
    );
  });

  it('runs shadow compare and returns heuristic output', async () => {
    const { router, heuristic, openRouter } = createRouter({
      mode: 'shadow',
      openRouterKey: 'sk-test',
      heuristicVoiceResult: makeVoiceResult({
        merchantText: 'pasar',
        totalAmount: 5,
        paymentMethod: 'TNG',
      }),
      openRouterVoiceResult: makeVoiceResult({
        merchantText: 'wet market',
        totalAmount: 7,
        paymentMethod: 'CARD',
        parserMeta: { engine: 'openrouter' },
      }),
    });

    const result = await router.parseVoiceTranscript('Spent RM 5 at pasar');
    expect(result.parserMeta?.engine).toBe('heuristic');
    expect(result.parserMeta?.shadowCompared).toBe(true);
    expect(result.parserMeta?.shadowMismatchFields).toEqual(
      expect.arrayContaining(['merchantText', 'totalAmount', 'paymentMethod']),
    );
    expect(openRouter.parseVoiceTranscript).toHaveBeenCalledTimes(1);
    expect(heuristic.parseVoiceTranscript).toHaveBeenCalledTimes(1);
  });
});
