import { Injectable } from '@nestjs/common';
import { Prisma, type Expense, type ExpenseLineItem } from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
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
}
