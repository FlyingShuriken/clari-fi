import { Injectable } from '@nestjs/common';
import { Prisma, ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ConfirmExpenseDto } from './dto/confirm-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

function normalizeStoreName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async confirmExpense(user: AuthenticatedUser, dto: ConfirmExpenseDto) {
    let areaId: string | undefined;
    let storeId: string | undefined;

    if (dto.location?.city) {
      const areaName = dto.location.areaName ?? dto.location.city;
      const area = await this.prisma.area.findFirst({
        where: {
          city: dto.location.city,
          district: dto.location.district ?? null,
          name: areaName,
        },
        select: { id: true },
      });

      if (area) {
        areaId = area.id;
      } else {
        const createdArea = await this.prisma.area.create({
          data: {
            city: dto.location.city,
            district: dto.location.district,
            name: areaName,
          },
          select: { id: true },
        });
        areaId = createdArea.id;
      }
    }

    if (dto.location?.storeName) {
      const normalizedName = normalizeStoreName(dto.location.storeName);
      const store = await this.prisma.store.findFirst({
        where: {
          normalizedName,
          areaId: areaId ?? null,
        },
        select: { id: true },
      });

      if (store) {
        storeId = store.id;
      } else {
        const createdStore = await this.prisma.store.create({
          data: {
            name: dto.location.storeName,
            normalizedName,
            addressLine: dto.location.addressLine,
            areaId,
          },
          select: { id: true },
        });
        storeId = createdStore.id;
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rawPayload = dto.rawPayload as Prisma.InputJsonValue | undefined;
      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          source: dto.source,
          currency: dto.currency,
          totalAmount: new Prisma.Decimal(dto.totalAmount),
          merchantText: dto.merchantText,
          paymentMethod: dto.paymentMethod,
          transactionAt: new Date(dto.transactionAt),
          note: dto.note,
          confidence:
            typeof dto.confidence === 'number'
              ? new Prisma.Decimal(dto.confidence)
              : undefined,
          rawPayload,
          areaId,
          storeId,
          lineItems: {
            create: dto.lineItems.map((item) => ({
              descriptionRaw: item.descriptionRaw,
              quantity:
                typeof item.quantity === 'number'
                  ? new Prisma.Decimal(item.quantity)
                  : undefined,
              unitRaw: item.unitRaw,
              totalPrice: new Prisma.Decimal(item.totalPrice),
              currency: dto.currency,
              confidence:
                typeof item.confidence === 'number'
                  ? new Prisma.Decimal(item.confidence)
                  : undefined,
            })),
          },
        },
        include: {
          lineItems: true,
        },
      });

      if (dto.receipt) {
        const ocrRaw = dto.receipt.ocrRaw as Prisma.InputJsonValue | undefined;
        const parsedPayload = dto.receipt.parsedPayload as
          | Prisma.InputJsonValue
          | undefined;
        await tx.receipt.create({
          data: {
            userId: user.id,
            expenseId: expense.id,
            sourceFileUrl: dto.receipt.sourceFileUrl,
            mimeType: dto.receipt.mimeType,
            ocrStatus: ProcessingStatus.COMPLETED,
            ocrRaw,
            parsedPayload,
            confidence:
              typeof dto.receipt.confidence === 'number'
                ? new Prisma.Decimal(dto.receipt.confidence)
                : undefined,
          },
        });
      }

      return expense;
    });

    return {
      expenseId: created.id,
      lineItemCount: dto.lineItems.length,
      createdAt: created.createdAt,
    };
  }

  async listExpenses(user: AuthenticatedUser, query: ListExpensesDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      userId: user.id,
    };

    if (query.from || query.to) {
      where.transactionAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          transactionAt: 'desc',
        },
        include: {
          lineItems: true,
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      items,
    };
  }
}
