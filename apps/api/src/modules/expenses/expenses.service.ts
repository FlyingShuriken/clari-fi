import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ExpenseProvenance,
  ExpenseSource,
  FamilyMemberStatus,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PricesService } from '../prices/prices.service';
import { ConfirmExpenseDto } from './dto/confirm-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

function defaultProvenanceForSource(source: ExpenseSource): ExpenseProvenance {
  if (source === ExpenseSource.RECEIPT) {
    return ExpenseProvenance.RECEIPT_OCR;
  }
  if (source === ExpenseSource.MANUAL) {
    return ExpenseProvenance.MANUAL;
  }
  return ExpenseProvenance.VOICE_ON_DEVICE;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly pricesService: PricesService,
  ) {}

  async confirmExpense(user: AuthenticatedUser, dto: ConfirmExpenseDto) {
    if (dto.familyId) {
      const membership = await this.prisma.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: dto.familyId,
            userId: user.id,
          },
        },
        select: {
          status: true,
        },
      });

      if (!membership || membership.status !== FamilyMemberStatus.ACTIVE) {
        throw new ForbiddenException('You are not an active member of the selected family.');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rawPayload = dto.rawPayload as Prisma.InputJsonValue | undefined;
      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          familyId: dto.familyId,
          source: dto.source,
          provenance: dto.provenance ?? defaultProvenanceForSource(dto.source),
          currency: dto.currency,
          totalAmount: new Prisma.Decimal(dto.totalAmount),
          merchantText: dto.merchantText,
          paymentMethod: dto.paymentMethod,
          transactionAt: new Date(dto.transactionAt),
          locationLat:
            typeof dto.locationLat === 'number'
              ? new Prisma.Decimal(dto.locationLat)
              : undefined,
          locationLng:
            typeof dto.locationLng === 'number'
              ? new Prisma.Decimal(dto.locationLng)
              : undefined,
          areaText: dto.areaText,
          note: dto.note,
          parseLatencyMs: dto.parseLatencyMs,
          requiresCorrection: dto.requiresCorrection ?? false,
          confidence:
            typeof dto.confidence === 'number'
              ? new Prisma.Decimal(dto.confidence)
              : undefined,
          rawPayload,
          lineItems: {
            create: dto.lineItems.map((item) => ({
              descriptionRaw: item.descriptionRaw,
              quantity:
                typeof item.quantity === 'number'
                  ? new Prisma.Decimal(item.quantity)
                  : undefined,
              unitRaw: item.unitRaw,
              unitPrice:
                typeof item.unitPrice === 'number'
                  ? new Prisma.Decimal(item.unitPrice)
                  : undefined,
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
            fileRef: dto.receipt.fileRef,
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

    this.metrics.trackCounter('expenses.confirmed.count', 1, {
      source: dto.source,
      provenance: dto.provenance ?? defaultProvenanceForSource(dto.source),
      userId: user.id,
    });

    if (dto.requiresCorrection) {
      this.metrics.trackCounter('expenses.requires_correction.count', 1, {
        userId: user.id,
      });
    }

    try {
      const ingestResult = await this.pricesService.ingestExpense(created.id);
      this.metrics.trackCounter('prices.ingest.expense_processed.count', 1, {
        userId: user.id,
        created: String(ingestResult.created),
        updated: String(ingestResult.updated),
        skipped: String(ingestResult.skipped),
        errors: String(ingestResult.errors),
      });
    } catch {
      this.metrics.trackCounter('prices.ingest.expense_failed.count', 1, {
        userId: user.id,
      });
    }

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

    const where: Prisma.ExpenseWhereInput = query.familyId
      ? {
          familyId: query.familyId,
        }
      : {
          userId: user.id,
        };

    if (query.familyId) {
      const membership = await this.prisma.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: query.familyId,
            userId: user.id,
          },
        },
        select: {
          status: true,
        },
      });

      if (!membership || membership.status !== FamilyMemberStatus.ACTIVE) {
        throw new ForbiddenException('You are not an active member of the selected family.');
      }
    }

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
          receipt: true,
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
