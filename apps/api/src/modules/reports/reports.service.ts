import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Expense, type ExpenseLineItem } from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';

export interface WeeklySlide {
  type: 'summary' | 'anomaly' | 'education' | 'tip';
  title: string;
  body: string;
  metric?: string;
  subtitle?: string;
  emoji?: string;
}

function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekBounds(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const start = new Date(startOfWeek1);
  start.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function buildFallbackSlides(cashOut: number, expenseCount: number, currency: string): WeeklySlide[] {
  const symbol = currency === 'MYR' ? 'RM' : currency;
  return [
    {
      type: 'summary',
      emoji: '📊',
      title: 'Your Week in Review',
      body: expenseCount === 0
        ? 'No transactions recorded this week yet.'
        : `You recorded ${expenseCount} transaction${expenseCount === 1 ? '' : 's'} this week.`,
      metric: `${symbol} ${cashOut.toFixed(2)}`,
      subtitle: `${expenseCount} transactions`,
    },
    {
      type: 'tip',
      emoji: '💡',
      title: 'Start Tracking',
      body: 'Keep capturing receipts and voice notes. The more data you record, the sharper your weekly insights will be.',
    },
  ];
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ['fish', 'vegetable', 'fruit', 'market', 'pasar', 'rice', 'chicken'],
  transport: ['fuel', 'petrol', 'grab', 'taxi', 'lrt', 'mrt', 'parking'],
  dining: ['restaurant', 'cafe', 'coffee', 'meal', 'food'],
  utilities: ['electric', 'water', 'internet', 'wifi', 'bill'],
  shopping: ['clothes', 'shirt', 'shoes', 'mall'],
};

function toFloat(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(value.toString());
}

function categorize(item: ExpenseLineItem): string {
  const description = item.descriptionRaw.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => description.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeTextKey(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toDisplayLabel(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

type SpendDeltaDirection = 'UP' | 'DOWN' | 'FLAT' | 'NO_BASELINE';

function computeSpendDelta(cashOut: number, prevCashOut: number): {
  previousCashOut: number;
  absolute: number;
  percentage: number | null;
  direction: SpendDeltaDirection;
} {
  const absolute = round2(cashOut - prevCashOut);
  if (prevCashOut <= 0) {
    return {
      previousCashOut: round2(prevCashOut),
      absolute,
      percentage: null,
      direction: 'NO_BASELINE',
    };
  }

  const percentage = round2((absolute / prevCashOut) * 100);
  if (Math.abs(absolute) < 1) {
    return {
      previousCashOut: round2(prevCashOut),
      absolute,
      percentage,
      direction: 'FLAT',
    };
  }

  return {
    previousCashOut: round2(prevCashOut),
    absolute,
    percentage,
    direction: absolute > 0 ? 'UP' : 'DOWN',
  };
}

function computeTopMerchants(expenses: Array<Pick<Expense, 'merchantText' | 'totalAmount'>>) {
  const buckets = new Map<string, { merchant: string; amount: number; expenseCount: number }>();
  for (const expense of expenses) {
    const key = normalizeTextKey(expense.merchantText);
    if (!key) {
      continue;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.amount += toFloat(expense.totalAmount);
      existing.expenseCount += 1;
      continue;
    }

    buckets.set(key, {
      merchant: toDisplayLabel(key),
      amount: toFloat(expense.totalAmount),
      expenseCount: 1,
    });
  }

  return [...buckets.values()]
    .map((row) => ({
      merchant: row.merchant,
      amount: round2(row.amount),
      expenseCount: row.expenseCount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function computeTopItems(expenses: Array<{ lineItems: ExpenseLineItem[] }>) {
  const buckets = new Map<string, { item: string; amount: number; occurrences: number }>();
  for (const expense of expenses) {
    for (const lineItem of expense.lineItems) {
      const key = normalizeTextKey(lineItem.descriptionRaw);
      if (!key) {
        continue;
      }

      const existing = buckets.get(key);
      if (existing) {
        existing.amount += toFloat(lineItem.totalPrice);
        existing.occurrences += 1;
        continue;
      }

      buckets.set(key, {
        item: toDisplayLabel(key),
        amount: toFloat(lineItem.totalPrice),
        occurrences: 1,
      });
    }
  }

  return [...buckets.values()]
    .map((row) => ({
      item: row.item,
      amount: round2(row.amount),
      occurrences: row.occurrences,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function computeAnomalies(expenses: Array<Pick<Expense, 'id' | 'merchantText' | 'transactionAt' | 'totalAmount'>>) {
  if (expenses.length < 3) {
    return [] as Array<{
      expenseId: string;
      merchantText: string;
      totalAmount: number;
      transactionAt: string;
      zScore: number;
    }>;
  }

  const values = expenses.map((expense) => toFloat(expense.totalAmount));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (!Number.isFinite(stdDev) || stdDev < 0.01) {
    return [] as Array<{
      expenseId: string;
      merchantText: string;
      totalAmount: number;
      transactionAt: string;
      zScore: number;
    }>;
  }

  const threshold = mean + stdDev * 1.5;

  return expenses
    .map((expense) => {
      const totalAmount = toFloat(expense.totalAmount);
      return {
        expenseId: expense.id,
        merchantText: expense.merchantText || 'Unknown merchant',
        totalAmount: round2(totalAmount),
        transactionAt: expense.transactionAt.toISOString(),
        zScore: round2((totalAmount - mean) / stdDev),
      };
    })
    .filter((row) => row.totalAmount > threshold)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 3);
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  async getMonthlyReport(user: AuthenticatedUser, query: MonthlyReportQueryDto) {
    const startedAt = Date.now();
    const start = new Date(Date.UTC(query.year, query.month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(query.year, query.month, 1, 0, 0, 0));

    const prevStart = new Date(Date.UTC(query.year, query.month - 2, 1, 0, 0, 0));
    const prevEnd = start;

    this.metrics.trackCounter('reports.monthly.request.count', 1, {
      year: String(query.year),
      month: String(query.month),
    });

    const [expenses, prevExpenses] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          userId: user.id,
          transactionAt: { gte: start, lt: end },
        },
        include: {
          lineItems: true,
        },
      }),
      this.prisma.expense.findMany({
        where: {
          userId: user.id,
          transactionAt: { gte: prevStart, lt: prevEnd },
        },
        include: {
          lineItems: true,
        },
      }),
    ]);

    const cashOut = expenses.reduce(
      (sum, expense) => sum + toFloat(expense.totalAmount),
      0,
    );
    const prevCashOut = prevExpenses.reduce(
      (sum, expense) => sum + toFloat(expense.totalAmount),
      0,
    );
    const cashIn = 0;
    const netCashFlow = cashIn - cashOut;
    const spendDelta = computeSpendDelta(cashOut, prevCashOut);
    const topItems = computeTopItems(expenses);
    const topMerchants = computeTopMerchants(expenses);
    const anomalies = computeAnomalies(expenses);

    const categoryBreakdown: Record<string, number> = {};
    for (const expense of expenses) {
      for (const lineItem of expense.lineItems) {
        const category = categorize(lineItem);
        categoryBreakdown[category] =
          (categoryBreakdown[category] ?? 0) + toFloat(lineItem.totalPrice);
      }
    }

    const topCategory = Object.entries(categoryBreakdown).sort(
      (a, b) => b[1] - a[1],
    )[0];

    const insights: string[] = [];

    if (cashOut === 0) {
      insights.push('No expenses recorded this month yet.');
    } else {
      if (topCategory) {
        insights.push(
          `Top spending category: ${topCategory[0]} (RM ${topCategory[1].toFixed(2)}).`,
        );
      }

      if (prevCashOut > 0) {
        if ((spendDelta.percentage ?? 0) > 10) {
          insights.push(
            `Cash out increased by ${Math.abs(spendDelta.percentage ?? 0).toFixed(1)}% vs previous month.`,
          );
        } else if ((spendDelta.percentage ?? 0) < -10) {
          insights.push(
            `Cash out decreased by ${Math.abs(spendDelta.percentage ?? 0).toFixed(1)}% vs previous month.`,
          );
        } else {
          insights.push('Cash out remained relatively stable vs previous month.');
        }
      }

      if ((categoryBreakdown.groceries ?? 0) > cashOut * 0.4) {
        insights.push(
          'Groceries are above 40% of spending; use store comparison before shopping trips.',
        );
      }

      if (topItems.length > 0) {
        const topItem = topItems[0];
        insights.push(
          `Highest spend item: ${topItem.item} (RM ${topItem.amount.toFixed(2)}).`,
        );
      }

      if (anomalies.length > 0) {
        insights.push(
          `Detected ${anomalies.length} high-spend outlier${anomalies.length > 1 ? 's' : ''} this month.`,
        );
      }
    }

    await this.prisma.monthlyReport.upsert({
      where: {
        userId_year_month: {
          userId: user.id,
          year: query.year,
          month: query.month,
        },
      },
      create: {
        userId: user.id,
        year: query.year,
        month: query.month,
        cashIn: new Prisma.Decimal(cashIn),
        cashOut: new Prisma.Decimal(cashOut),
        netCashFlow: new Prisma.Decimal(netCashFlow),
        categoryBreakdown,
        insights,
      },
      update: {
        cashIn: new Prisma.Decimal(cashIn),
        cashOut: new Prisma.Decimal(cashOut),
        netCashFlow: new Prisma.Decimal(netCashFlow),
        categoryBreakdown,
        insights,
      },
    });

    this.metrics.trackCounter('reports.monthly.anomaly.count', anomalies.length, {
      year: String(query.year),
      month: String(query.month),
    });
    this.metrics.trackTiming('reports.monthly.latency_ms', Date.now() - startedAt, {
      hasExpenses: String(expenses.length > 0),
    });

    return {
      year: query.year,
      month: query.month,
      cashIn,
      cashOut,
      netCashFlow,
      spendDelta,
      categoryBreakdown,
      topItems,
      topMerchants,
      anomalies,
      insights,
    };
  }

  async getWeeklyReport(user: AuthenticatedUser) {
    const weekKey = getIsoWeekKey(new Date());
    const { start, end } = getWeekBounds(weekKey);

    const cached = await this.prisma.weeklyReport.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
    });

    if (cached) {
      return {
        weekKey,
        slides: cached.slides as unknown as WeeklySlide[],
        cached: true,
      };
    }

    const prevStart = new Date(start);
    prevStart.setUTCDate(start.getUTCDate() - 7);

    const [expenses, prevExpenses] = await Promise.all([
      this.prisma.expense.findMany({
        where: { userId: user.id, transactionAt: { gte: start, lt: end } },
        include: { lineItems: true },
      }),
      this.prisma.expense.findMany({
        where: { userId: user.id, transactionAt: { gte: prevStart, lt: start } },
      }),
    ]);

    const cashOut = expenses.reduce((sum, e) => sum + toFloat(e.totalAmount), 0);
    const prevCashOut = prevExpenses.reduce((sum, e) => sum + toFloat(e.totalAmount), 0);
    const currency = expenses[0]?.currency ?? 'MYR';
    const symbol = currency === 'MYR' ? 'RM' : currency;

    let slides: WeeklySlide[];

    if (expenses.length === 0) {
      slides = buildFallbackSlides(cashOut, 0, currency);
    } else {
      slides = await this.generateSlidesViaLlm(expenses, cashOut, prevCashOut, currency, symbol);
    }

    await this.prisma.weeklyReport.upsert({
      where: { userId_weekKey: { userId: user.id, weekKey } },
      create: { userId: user.id, weekKey, slides: slides as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
      update: { slides: slides as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });

    return { weekKey, slides, cached: false };
  }

  private async generateSlidesViaLlm(
    expenses: Array<Expense & { lineItems: ExpenseLineItem[] }>,
    cashOut: number,
    prevCashOut: number,
    currency: string,
    symbol: string,
  ): Promise<WeeklySlide[]> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const baseUrl = this.config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const model = this.config.get<string>('OPENROUTER_PARSER_MODEL', 'openai/gpt-4.1-mini');

    if (!apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set — returning fallback weekly slides');
      return buildFallbackSlides(cashOut, expenses.length, currency);
    }

    const expenseSummary = expenses.map((e) => ({
      merchant: e.merchantText ?? 'Unknown',
      amount: toFloat(e.totalAmount),
      currency: e.currency,
      date: e.transactionAt.toISOString().slice(0, 10),
      items: e.lineItems.map((l) => ({
        name: l.descriptionRaw,
        unitPrice: l.unitPrice ? toFloat(l.unitPrice) : undefined,
        qty: l.quantity ? toFloat(l.quantity) : undefined,
        total: toFloat(l.totalPrice),
      })),
    }));

    const systemPrompt = [
      'You are a smart personal finance advisor for a Malaysian household spending app.',
      'Analyze the weekly transactions and return a JSON array of story slides.',
      'Return ONLY a valid JSON array — no markdown, no commentary, no code fences.',
      'Each slide object has these keys: type, title, body, metric (optional), subtitle (optional), emoji (optional).',
      'type must be one of: summary, anomaly, education, tip.',
      'Generate 4 to 6 slides total. Always start with a summary slide and end with a tip slide.',
      'The anomaly slide should highlight unusually high amounts or overpriced items compared to typical market prices.',
      'The education slide explains WHY prices changed (supply chain, inflation, seasonal factors).',
      'The tip slide must give specific, actionable savings advice based on the actual spending data.',
      'Keep body text concise — under 120 characters per slide.',
      `Currency is ${currency} (symbol: ${symbol}).`,
    ].join(' ');

    const userPrompt = JSON.stringify({
      weeklyTotal: round2(cashOut),
      previousWeekTotal: round2(prevCashOut),
      transactionCount: expenses.length,
      currency,
      expenses: expenseSummary,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      const appUrl = this.config.get<string>('OPENROUTER_APP_URL');
      const appName = this.config.get<string>('OPENROUTER_APP_NAME');
      if (appUrl) headers['HTTP-Referer'] = appUrl;
      if (appName) headers['X-Title'] = appName;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.error(`OpenRouter weekly report request failed (${response.status})`);
        return buildFallbackSlides(cashOut, expenses.length, currency);
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawText = (payload.choices?.[0]?.message?.content ?? '').trim();

      const jsonText = rawText.startsWith('[')
        ? rawText
        : (rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? rawText);

      const parsed = JSON.parse(jsonText) as unknown;
      if (!Array.isArray(parsed) || !parsed.length) {
        return buildFallbackSlides(cashOut, expenses.length, currency);
      }

      return (parsed as Array<Record<string, unknown>>).map((slide) => ({
        type: (['summary', 'anomaly', 'education', 'tip'].includes(String(slide.type))
          ? slide.type
          : 'summary') as WeeklySlide['type'],
        title: String(slide.title ?? ''),
        body: String(slide.body ?? ''),
        metric: slide.metric ? String(slide.metric) : undefined,
        subtitle: slide.subtitle ? String(slide.subtitle) : undefined,
        emoji: slide.emoji ? String(slide.emoji) : undefined,
      }));
    } catch (err) {
      this.logger.error(`Weekly report LLM call failed: ${String(err)}`);
      return buildFallbackSlides(cashOut, expenses.length, currency);
    } finally {
      clearTimeout(timeout);
    }
  }
}
