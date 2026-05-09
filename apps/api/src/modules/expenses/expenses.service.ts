import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { ContributionsService } from '../contributions/contributions.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly contributionsService: ContributionsService,
    private readonly pricesService: PricesService,
    private readonly notificationsService: NotificationsService,
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

      let receiptId: string | undefined;
      if (dto.receipt) {
        const ocrRaw = dto.receipt.ocrRaw as Prisma.InputJsonValue | undefined;
        const parsedPayload = dto.receipt.parsedPayload as
          | Prisma.InputJsonValue
          | undefined;

        const receipt = await tx.receipt.create({
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
        receiptId = receipt.id;
      }

      return {
        expense,
        receiptId,
      };
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
      const ingestResult = await this.pricesService.ingestExpense(created.expense.id);
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

    let contributionReward:
      | Awaited<ReturnType<ContributionsService['recordAcceptedReceiptContribution']>>
      | undefined;

    if (
      (dto.provenance ?? defaultProvenanceForSource(dto.source)) === ExpenseProvenance.RECEIPT_OCR &&
      dto.receipt
    ) {
      try {
        contributionReward = await this.contributionsService.recordAcceptedReceiptContribution({
          userId: user.id,
          expenseId: created.expense.id,
          receiptId: created.receiptId,
          fileRef: dto.receipt.fileRef,
          merchantText: dto.merchantText,
          transactionAt: new Date(dto.transactionAt),
          totalAmount: dto.totalAmount,
          currency: dto.currency,
          lineItems: dto.lineItems,
        });
      } catch {
        this.metrics.trackCounter('contributions.receipt_award_failed.count', 1, {
          userId: user.id,
        });
      }
    }

    void this.analyzeCheaperAlternatives(created.expense.id, user).catch((err: unknown) => {
      this.logger.warn(`cheaper-alternative analysis failed for expense ${created.expense.id}: ${String(err)}`);
    });

    return {
      expenseId: created.expense.id,
      lineItemCount: dto.lineItems.length,
      createdAt: created.expense.createdAt,
      contributionReward,
    };
  }

  private async analyzeCheaperAlternatives(expenseId: string, user: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { lineItems: true },
    });

    if (
      !expense ||
      expense.locationLat == null ||
      expense.locationLng == null
    ) {
      return;
    }

    const lat = Number(expense.locationLat.toString());
    const lng = Number(expense.locationLng.toString());
    const currency = expense.currency;

    const cheaperItems: Array<{
      description: string;
      currentUnitPrice: number;
      cheapestStore: string;
      cheapestUnitPrice: number;
      distanceKm: number;
      savingsPerUnit: number;
      currency: string;
      storeId?: string;
      lat?: number;
      lng?: number;
    }> = [];

    for (const lineItem of expense.lineItems) {
      if (lineItem.unitPrice == null) {
        continue;
      }

      const currentUnitPrice = Number(lineItem.unitPrice.toString());
      if (currentUnitPrice <= 0) {
        continue;
      }

      try {
        const result = await this.pricesService.compare(user, {
          item: lineItem.descriptionRaw,
          lat,
          lng,
          radiusKm: 5,
          limit: 5,
          includePromo: true,
        });

        if (!result.rows.length) {
          continue;
        }

        const cheapest = result.rows[0];
        if (cheapest.latestUnitPrice >= currentUnitPrice) {
          continue;
        }

        cheaperItems.push({
          description: lineItem.descriptionRaw,
          currentUnitPrice,
          cheapestStore: cheapest.storeName ?? cheapest.areaText ?? 'Nearby store',
          cheapestUnitPrice: cheapest.latestUnitPrice,
          distanceKm: cheapest.distanceKm ?? 0,
          savingsPerUnit: Number((currentUnitPrice - cheapest.latestUnitPrice).toFixed(2)),
          currency,
          storeId: cheapest.storeId,
        });
      } catch {
        // skip individual item failures
      }
    }

    if (!cheaperItems.length) {
      return;
    }

    const totalSavingsEstimate = Number(
      cheaperItems.reduce((sum, item) => sum + item.savingsPerUnit, 0).toFixed(2),
    );

    const existingPayload =
      (expense.rawPayload as Record<string, unknown> | null) ?? {};

    await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        rawPayload: {
          ...existingPayload,
          cheaperOption: {
            analyzedAt: new Date().toISOString(),
            hasAlternative: true,
            items: cheaperItems,
            totalSavingsEstimate,
          },
        },
      },
    });

    this.notificationsService
      .sendCheaperAlternativeFound({
        userId: user.id,
        expenseId,
        itemName: cheaperItems[0].description,
        savingsEstimate: totalSavingsEstimate,
        currency,
      })
      .catch(() => {});
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

  async deleteExpense(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id: expenseId,
        userId: user.id,
      },
      select: {
        id: true,
        receipt: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (expense.receipt) {
        await tx.receipt.delete({
          where: { id: expense.receipt.id },
        });
      }

      await tx.expense.delete({
        where: { id: expense.id },
      });
    });

    return {
      expenseId: expense.id,
      deleted: true,
    };
  }
}
