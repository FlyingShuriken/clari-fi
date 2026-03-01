import { Injectable } from '@nestjs/common';
import { Prisma, type ExpenseLineItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(user: AuthenticatedUser, query: MonthlyReportQueryDto) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(query.year, query.month, 1, 0, 0, 0));

    const prevStart = new Date(Date.UTC(query.year, query.month - 2, 1, 0, 0, 0));
    const prevEnd = start;

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
        const deltaPct = ((cashOut - prevCashOut) / prevCashOut) * 100;
        if (deltaPct > 10) {
          insights.push(
            `Cash out increased by ${deltaPct.toFixed(1)}% vs previous month.`,
          );
        } else if (deltaPct < -10) {
          insights.push(
            `Cash out decreased by ${Math.abs(deltaPct).toFixed(1)}% vs previous month.`,
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

    return {
      year: query.year,
      month: query.month,
      cashIn,
      cashOut,
      netCashFlow,
      categoryBreakdown,
      insights,
    };
  }
}
