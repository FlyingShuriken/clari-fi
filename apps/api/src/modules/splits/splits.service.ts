import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamilyMemberStatus,
  FamilyRole,
  Prisma,
  SplitAllocationType,
  SplitParticipantType,
  SplitStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateSplitDto } from './dto/create-split.dto';
import { ListSplitsDto } from './dto/list-splits.dto';
import {
  SplitParticipantInput,
  UpdateSplitParticipantsDto,
} from './dto/update-split-participants.dto';
import {
  SplitLineAssignment,
  UpdateSplitAllocationsDto,
} from './dto/update-split-allocations.dto';
import {
  buildSettlements,
  computeAllocations,
  computeParticipantBalances,
  type ComputedAllocation,
} from './split-math.utils';

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  return 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roleRank(role: FamilyRole): number {
  if (role === FamilyRole.OWNER) {
    return 3;
  }
  if (role === FamilyRole.EDITOR) {
    return 2;
  }
  return 1;
}

@Injectable()
export class SplitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireFamilyMembership(
    userId: string,
    familyId: string,
    minRole: FamilyRole = FamilyRole.VIEWER,
  ) {
    const membership = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!membership || membership.status !== FamilyMemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active member of this family.');
    }

    if (roleRank(membership.role) < roleRank(minRole)) {
      throw new ForbiddenException('Insufficient family permissions for this split action.');
    }

    return membership;
  }

  private async loadSplitOrThrow(splitId: string) {
    const split = await this.prisma.splitSession.findUnique({
      where: { id: splitId },
      include: {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        expense: {
          include: {
            lineItems: true,
          },
        },
        participants: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            familyMember: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
        allocations: true,
        settlements: true,
      },
    });

    if (!split) {
      throw new NotFoundException('Split session not found.');
    }

    return split;
  }

  private async requireSplitAccess(
    user: AuthenticatedUser,
    splitId: string,
    minRole: FamilyRole = FamilyRole.VIEWER,
  ) {
    const split = await this.loadSplitOrThrow(splitId);
    await this.requireFamilyMembership(user.id, split.familyId, minRole);
    return split;
  }

  private mapSplitSummary(split: {
    id: string;
    familyId: string;
    expenseId: string | null;
    title: string | null;
    currency: string;
    subtotal: Prisma.Decimal;
    sharedCharge: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    status: SplitStatus;
    finalizedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    participants: Array<{ id: string }>;
  }) {
    return {
      id: split.id,
      familyId: split.familyId,
      expenseId: split.expenseId,
      title: split.title,
      currency: split.currency,
      subtotal: decimalToNumber(split.subtotal),
      sharedCharge: decimalToNumber(split.sharedCharge),
      totalAmount: decimalToNumber(split.totalAmount),
      status: split.status,
      participantCount: split.participants.length,
      finalizedAt: split.finalizedAt,
      createdAt: split.createdAt,
      updatedAt: split.updatedAt,
    };
  }

  private mapSplitDetail(split: Awaited<ReturnType<SplitsService['loadSplitOrThrow']>>) {
    const participants = split.participants.map((participant) => ({
      id: participant.id,
      familyMemberId: participant.familyMemberId,
      userId: participant.familyMember?.userId ?? null,
      displayName:
        participant.familyMember?.user.displayName ??
        participant.familyMember?.user.email ??
        participant.displayName,
      type: participant.type,
      isPayer: participant.isPayer,
      paidAmount: decimalToNumber(participant.paidAmount),
    }));

    const allocations = split.allocations.map((allocation) => ({
      id: allocation.id,
      participantId: allocation.participantId,
      allocationType:
        allocation.allocationType === SplitAllocationType.ITEM ? ('ITEM' as const) : ('SHARED_CHARGE' as const),
      expenseLineItemId: allocation.expenseLineItemId ?? undefined,
      lineItemLabel: allocation.lineItemLabel ?? undefined,
      amount: decimalToNumber(allocation.amount),
    }));

    const balances = computeParticipantBalances({
      participants: participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        isPayer: participant.isPayer,
        paidAmount: participant.paidAmount,
      })),
      allocations,
    });

    return {
      split: {
        id: split.id,
        familyId: split.familyId,
        familyName: split.family.name,
        expenseId: split.expenseId,
        title: split.title,
        currency: split.currency,
        subtotal: decimalToNumber(split.subtotal),
        sharedCharge: decimalToNumber(split.sharedCharge),
        totalAmount: decimalToNumber(split.totalAmount),
        status: split.status,
        finalizedAt: split.finalizedAt,
        createdAt: split.createdAt,
        updatedAt: split.updatedAt,
      },
      expenseLineItems:
        split.expense?.lineItems.map((lineItem) => ({
          id: lineItem.id,
          descriptionRaw: lineItem.descriptionRaw,
          totalPrice: decimalToNumber(lineItem.totalPrice),
          quantity: decimalToNumber(lineItem.quantity),
          unitRaw: lineItem.unitRaw,
          unitPrice: decimalToNumber(lineItem.unitPrice),
        })) ?? [],
      participants,
      allocations,
      balances,
      settlements: split.settlements.map((settlement) => ({
        id: settlement.id,
        fromParticipantId: settlement.fromParticipantId,
        toParticipantId: settlement.toParticipantId,
        amount: decimalToNumber(settlement.amount),
        status: settlement.status,
        settledAt: settlement.settledAt,
        createdAt: settlement.createdAt,
      })),
    };
  }

  private normalizeParticipantsInput(
    split: Awaited<ReturnType<SplitsService['loadSplitOrThrow']>>,
    inputs: SplitParticipantInput[],
    activeFamilyMembers: Array<{
      id: string;
      userId: string;
      user: { email: string; displayName: string | null };
    }>,
  ) {
    if (inputs.length === 0) {
      throw new BadRequestException('At least one split participant is required.');
    }

    const familyMemberById = new Map(activeFamilyMembers.map((member) => [member.id, member]));
    const normalized = inputs.map((input) => {
      if (input.familyMemberId) {
        const member = familyMemberById.get(input.familyMemberId);
        if (!member) {
          throw new BadRequestException(
            `familyMemberId ${input.familyMemberId} is not active in this family.`,
          );
        }
        return {
          splitId: split.id,
          familyMemberId: member.id,
          type: SplitParticipantType.MEMBER,
          displayName: member.user.displayName ?? member.user.email,
          isPayer: input.isPayer ?? false,
          paidAmount: new Prisma.Decimal(round2(input.paidAmount ?? 0)),
        };
      }

      const displayName = input.displayName?.trim();
      if (!displayName) {
        throw new BadRequestException(
          'Each participant must provide either familyMemberId or displayName.',
        );
      }
      return {
        splitId: split.id,
        familyMemberId: null,
        type: SplitParticipantType.GUEST,
        displayName,
        isPayer: input.isPayer ?? false,
        paidAmount: new Prisma.Decimal(round2(input.paidAmount ?? 0)),
      };
    });

    const hasPayer = normalized.some((participant) => participant.isPayer);
    if (!hasPayer) {
      normalized[0].isPayer = true;
      if (round2(normalized[0].paidAmount.toNumber()) <= 0) {
        normalized[0].paidAmount = new Prisma.Decimal(decimalToNumber(split.totalAmount));
      }
    }

    return normalized;
  }

  private normalizeLineAssignments(
    split: Awaited<ReturnType<SplitsService['loadSplitOrThrow']>>,
    lineAssignments: SplitLineAssignment[],
  ) {
    const participants = split.participants.map((participant) => participant.id);
    const participantSet = new Set(participants);
    const lineItems = split.expense?.lineItems ?? [];

    if (lineItems.length > 0 && lineAssignments.length === 0) {
      throw new BadRequestException('lineAssignments are required for expense-based splits.');
    }

    const assignmentByLineItemId = new Map<string, SplitLineAssignment>();
    for (const assignment of lineAssignments) {
      assignmentByLineItemId.set(assignment.expenseLineItemId, assignment);
    }

    for (const lineItem of lineItems) {
      const assignment = assignmentByLineItemId.get(lineItem.id);
      if (!assignment) {
        throw new BadRequestException(
          `Missing participant assignment for line item ${lineItem.descriptionRaw}.`,
        );
      }

      for (const participantId of assignment.participantIds) {
        if (!participantSet.has(participantId)) {
          throw new BadRequestException(`participantId ${participantId} does not belong to this split.`);
        }
      }
    }

    return lineItems.map((lineItem) => {
      const assignment = assignmentByLineItemId.get(lineItem.id);
      return {
        expenseLineItemId: lineItem.id,
        label: lineItem.descriptionRaw,
        totalPrice: decimalToNumber(lineItem.totalPrice),
        participantIds: assignment?.participantIds ?? [],
      };
    });
  }

  private async writeAllocations(
    splitId: string,
    allocations: ComputedAllocation[],
    splitTotals: { subtotal: number; sharedCharge: number; totalAmount: number },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.splitSettlement.deleteMany({
        where: {
          splitId,
        },
      });
      await tx.splitAllocation.deleteMany({
        where: {
          splitId,
        },
      });

      if (allocations.length > 0) {
        await tx.splitAllocation.createMany({
          data: allocations.map((allocation) => ({
            splitId,
            participantId: allocation.participantId,
            expenseLineItemId: allocation.expenseLineItemId,
            allocationType:
              allocation.allocationType === 'ITEM'
                ? SplitAllocationType.ITEM
                : SplitAllocationType.SHARED_CHARGE,
            lineItemLabel: allocation.lineItemLabel,
            amount: new Prisma.Decimal(allocation.amount),
          })),
        });
      }

      await tx.splitSession.update({
        where: { id: splitId },
        data: {
          subtotal: new Prisma.Decimal(splitTotals.subtotal),
          sharedCharge: new Prisma.Decimal(splitTotals.sharedCharge),
          totalAmount: new Prisma.Decimal(splitTotals.totalAmount),
          status: SplitStatus.DRAFT,
          finalizedAt: null,
        },
      });
    });
  }

  async createSplit(user: AuthenticatedUser, dto: CreateSplitDto) {
    const membership = await this.requireFamilyMembership(user.id, dto.familyId, FamilyRole.EDITOR);

    const expense = dto.expenseId
      ? await this.prisma.expense.findUnique({
          where: { id: dto.expenseId },
          include: {
            lineItems: true,
          },
        })
      : null;

    if (dto.expenseId && !expense) {
      throw new NotFoundException('Expense not found.');
    }

    if (expense?.familyId && expense.familyId !== dto.familyId) {
      throw new BadRequestException('Expense belongs to another family.');
    }

    if (!expense?.familyId && expense && expense.userId !== user.id) {
      throw new ForbiddenException('You can only split your own personal expenses.');
    }

    const activeFamilyMembers = await this.prisma.familyMember.findMany({
      where: {
        familyId: dto.familyId,
        status: FamilyMemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
    const familyMemberById = new Map(activeFamilyMembers.map((member) => [member.id, member]));

    const creatorMember = familyMemberById.get(membership.id);
    const creatorDisplayName =
      creatorMember?.user.displayName ?? creatorMember?.user.email ?? user.email;

    const subtotal = round2(
      expense
        ? expense.lineItems.reduce(
            (acc, lineItem) => acc + decimalToNumber(lineItem.totalPrice),
            0,
          ) || decimalToNumber(expense.totalAmount)
        : 0,
    );
    const sharedCharge = round2(Math.max(0, dto.sharedCharge ?? 0));
    const totalAmount = round2(subtotal + sharedCharge);

    const participantByMemberId = new Map<string, SplitParticipantInput>();
    participantByMemberId.set(membership.id, {
      familyMemberId: membership.id,
      isPayer: true,
      paidAmount: totalAmount,
    });

    for (const familyMemberId of dto.participantFamilyMemberIds ?? []) {
      if (!familyMemberById.has(familyMemberId)) {
        participantByMemberId.set(familyMemberId, {
          familyMemberId,
        });
      }
    }

    const participantInputs: SplitParticipantInput[] = [...participantByMemberId.values()];
    for (const guestName of dto.guestParticipants ?? []) {
      const displayName = guestName.trim();
      if (displayName) {
        participantInputs.push({
          displayName,
        });
      }
    }

    if (participantInputs.length === 0) {
      participantInputs.push({
        familyMemberId: membership.id,
        displayName: creatorDisplayName,
        isPayer: true,
        paidAmount: totalAmount,
      });
    }

    const createdSplitId = await this.prisma.$transaction(async (tx) => {
      const createdSplit = await tx.splitSession.create({
        data: {
          familyId: dto.familyId,
          createdByUserId: user.id,
          expenseId: expense?.id,
          title: dto.title?.trim() || expense?.merchantText || undefined,
          currency: dto.currency ?? expense?.currency ?? 'MYR',
          subtotal: new Prisma.Decimal(subtotal),
          sharedCharge: new Prisma.Decimal(sharedCharge),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: SplitStatus.DRAFT,
        },
      });

      const normalizedParticipants = participantInputs.map((input) => {
        if (input.familyMemberId) {
          const member = familyMemberById.get(input.familyMemberId);
          if (!member) {
            throw new BadRequestException(
              `familyMemberId ${input.familyMemberId} is not active in this family.`,
            );
          }
          return {
            splitId: createdSplit.id,
            familyMemberId: member.id,
            type: SplitParticipantType.MEMBER,
            displayName: member.user.displayName ?? member.user.email,
            isPayer: input.isPayer ?? false,
            paidAmount: new Prisma.Decimal(round2(input.paidAmount ?? 0)),
          };
        }

        const displayName = input.displayName?.trim();
        if (!displayName) {
          throw new BadRequestException('Guest participant displayName is required.');
        }
        return {
          splitId: createdSplit.id,
          familyMemberId: null,
          type: SplitParticipantType.GUEST,
          displayName,
          isPayer: input.isPayer ?? false,
          paidAmount: new Prisma.Decimal(round2(input.paidAmount ?? 0)),
        };
      });

      const hasPayer = normalizedParticipants.some((participant) => participant.isPayer);
      if (!hasPayer && normalizedParticipants.length > 0) {
        normalizedParticipants[0].isPayer = true;
        if (normalizedParticipants[0].paidAmount.toNumber() <= 0) {
          normalizedParticipants[0].paidAmount = new Prisma.Decimal(totalAmount);
        }
      }

      await tx.splitParticipant.createMany({
        data: normalizedParticipants,
      });

      return createdSplit.id;
    });

    const split = await this.requireSplitAccess(user, createdSplitId, FamilyRole.VIEWER);
    return this.mapSplitDetail(split);
  }

  async listSplits(user: AuthenticatedUser, query: ListSplitsDto) {
    await this.requireFamilyMembership(user.id, query.familyId, FamilyRole.VIEWER);
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.SplitSessionWhereInput = {
      familyId: query.familyId,
    };
    if (query.status) {
      where.status = query.status;
    }

    const items = await this.prisma.splitSession.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        participants: {
          select: {
            id: true,
          },
        },
      },
    });

    return {
      total: items.length,
      items: items.map((item) => this.mapSplitSummary(item)),
    };
  }

  async getSplit(user: AuthenticatedUser, splitId: string) {
    const split = await this.requireSplitAccess(user, splitId, FamilyRole.VIEWER);
    return this.mapSplitDetail(split);
  }

  async updateParticipants(
    user: AuthenticatedUser,
    splitId: string,
    dto: UpdateSplitParticipantsDto,
  ) {
    const split = await this.requireSplitAccess(user, splitId, FamilyRole.EDITOR);
    const activeFamilyMembers = await this.prisma.familyMember.findMany({
      where: {
        familyId: split.familyId,
        status: FamilyMemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });

    const participants = this.normalizeParticipantsInput(split, dto.participants, activeFamilyMembers);

    await this.prisma.$transaction(async (tx) => {
      await tx.splitSettlement.deleteMany({ where: { splitId } });
      await tx.splitAllocation.deleteMany({ where: { splitId } });
      await tx.splitParticipant.deleteMany({ where: { splitId } });
      await tx.splitParticipant.createMany({
        data: participants,
      });
      await tx.splitSession.update({
        where: { id: splitId },
        data: {
          status: SplitStatus.DRAFT,
          finalizedAt: null,
        },
      });
    });

    const refreshed = await this.requireSplitAccess(user, splitId, FamilyRole.VIEWER);
    return this.mapSplitDetail(refreshed);
  }

  async updateAllocations(
    user: AuthenticatedUser,
    splitId: string,
    dto: UpdateSplitAllocationsDto,
  ) {
    const split = await this.requireSplitAccess(user, splitId, FamilyRole.EDITOR);
    if (split.participants.length === 0) {
      throw new BadRequestException('Split has no participants.');
    }

    const lineItems = this.normalizeLineAssignments(split, dto.lineAssignments);
    const computed = computeAllocations({
      participants: split.participants.map((participant) => ({
        id: participant.id,
        displayName:
          participant.familyMember?.user.displayName ??
          participant.familyMember?.user.email ??
          participant.displayName,
        isPayer: participant.isPayer,
        paidAmount: decimalToNumber(participant.paidAmount),
      })),
      lineItems,
      sharedCharge: dto.sharedCharge ?? decimalToNumber(split.sharedCharge),
    });

    await this.writeAllocations(splitId, computed.allocations, {
      subtotal: computed.subtotal,
      sharedCharge: computed.sharedCharge,
      totalAmount: computed.totalAmount,
    });

    const refreshed = await this.requireSplitAccess(user, splitId, FamilyRole.VIEWER);
    return this.mapSplitDetail(refreshed);
  }

  async finalizeSplit(user: AuthenticatedUser, splitId: string) {
    const split = await this.requireSplitAccess(user, splitId, FamilyRole.EDITOR);
    if (split.allocations.length === 0) {
      throw new BadRequestException('Cannot finalize split without allocations.');
    }

    const allocations = split.allocations.map((allocation) => ({
      participantId: allocation.participantId,
      allocationType:
        allocation.allocationType === SplitAllocationType.ITEM ? 'ITEM' : 'SHARED_CHARGE',
      expenseLineItemId: allocation.expenseLineItemId ?? undefined,
      lineItemLabel: allocation.lineItemLabel ?? undefined,
      amount: decimalToNumber(allocation.amount),
    })) as ComputedAllocation[];

    const participants = split.participants.map((participant) => ({
      id: participant.id,
      displayName:
        participant.familyMember?.user.displayName ??
        participant.familyMember?.user.email ??
        participant.displayName,
      isPayer: participant.isPayer,
      paidAmount: decimalToNumber(participant.paidAmount),
    }));

    const balances = computeParticipantBalances({
      participants,
      allocations,
    });
    const settlements = buildSettlements(balances);

    const subtotal = round2(
      allocations
        .filter((allocation) => allocation.allocationType === 'ITEM')
        .reduce((acc, allocation) => acc + allocation.amount, 0),
    );
    const sharedCharge = round2(
      allocations
        .filter((allocation) => allocation.allocationType === 'SHARED_CHARGE')
        .reduce((acc, allocation) => acc + allocation.amount, 0),
    );
    const totalAmount = round2(subtotal + sharedCharge);

    await this.prisma.$transaction(async (tx) => {
      await tx.splitSettlement.deleteMany({
        where: { splitId },
      });
      if (settlements.length > 0) {
        await tx.splitSettlement.createMany({
          data: settlements.map((settlement) => ({
            splitId,
            fromParticipantId: settlement.fromParticipantId,
            toParticipantId: settlement.toParticipantId,
            amount: new Prisma.Decimal(settlement.amount),
          })),
        });
      }
      await tx.splitSession.update({
        where: { id: splitId },
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          sharedCharge: new Prisma.Decimal(sharedCharge),
          totalAmount: new Prisma.Decimal(totalAmount),
          status: SplitStatus.FINALIZED,
          finalizedAt: new Date(),
        },
      });
    });

    const refreshed = await this.requireSplitAccess(user, splitId, FamilyRole.VIEWER);
    return this.mapSplitDetail(refreshed);
  }

  async getBalances(user: AuthenticatedUser, splitId: string) {
    const split = await this.requireSplitAccess(user, splitId, FamilyRole.VIEWER);
    const allocations = split.allocations.map((allocation) => ({
      participantId: allocation.participantId,
      allocationType:
        allocation.allocationType === SplitAllocationType.ITEM ? 'ITEM' : 'SHARED_CHARGE',
      expenseLineItemId: allocation.expenseLineItemId ?? undefined,
      lineItemLabel: allocation.lineItemLabel ?? undefined,
      amount: decimalToNumber(allocation.amount),
    })) as ComputedAllocation[];

    const participants = split.participants.map((participant) => ({
      id: participant.id,
      displayName:
        participant.familyMember?.user.displayName ??
        participant.familyMember?.user.email ??
        participant.displayName,
      isPayer: participant.isPayer,
      paidAmount: decimalToNumber(participant.paidAmount),
    }));

    const balances = computeParticipantBalances({
      participants,
      allocations,
    });
    const settlements =
      split.status === SplitStatus.FINALIZED && split.settlements.length > 0
        ? split.settlements.map((settlement) => ({
            fromParticipantId: settlement.fromParticipantId,
            toParticipantId: settlement.toParticipantId,
            amount: decimalToNumber(settlement.amount),
          }))
        : buildSettlements(balances);

    return {
      splitId: split.id,
      familyId: split.familyId,
      currency: split.currency,
      status: split.status,
      balances,
      settlements,
      generatedAt: new Date(),
    };
  }
}
