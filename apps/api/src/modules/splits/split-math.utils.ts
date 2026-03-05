export type SplitAllocationKind = 'ITEM' | 'SHARED_CHARGE';

export interface SplitParticipantSeed {
  id: string;
  displayName: string;
  isPayer: boolean;
  paidAmount: number;
}

export interface SplitLineItemSeed {
  expenseLineItemId: string;
  label: string;
  totalPrice: number;
  participantIds: string[];
}

export interface ComputedAllocation {
  participantId: string;
  allocationType: SplitAllocationKind;
  expenseLineItemId?: string;
  lineItemLabel?: string;
  amount: number;
}

export interface ParticipantBalance {
  participantId: string;
  displayName: string;
  owedAmount: number;
  paidAmount: number;
  netAmount: number;
}

export interface SettlementEdge {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function splitEvenly(amount: number, participantIds: string[]): Map<string, number> {
  const sorted = [...participantIds].sort();
  const result = new Map<string, number>();
  if (sorted.length === 0) {
    return result;
  }

  const cents = Math.round(round2(amount) * 100);
  const base = Math.trunc(cents / sorted.length);
  let remainder = cents - base * sorted.length;

  for (const participantId of sorted) {
    let value = base;
    if (remainder > 0) {
      value += 1;
      remainder -= 1;
    }
    result.set(participantId, value / 100);
  }

  return result;
}

function distributeByWeights(
  amount: number,
  participantIds: string[],
  weightByParticipantId: Map<string, number>,
): Map<string, number> {
  const ids = [...participantIds];
  const result = new Map<string, number>();
  if (ids.length === 0 || amount <= 0) {
    return result;
  }

  const totalWeight = ids.reduce((acc, id) => acc + Math.max(0, weightByParticipantId.get(id) ?? 0), 0);
  const rawShares = new Map<string, number>();

  if (totalWeight <= 0) {
    return splitEvenly(amount, ids);
  }

  for (const id of ids) {
    const weight = Math.max(0, weightByParticipantId.get(id) ?? 0);
    rawShares.set(id, (amount * weight) / totalWeight);
  }

  let roundedSum = 0;
  for (const id of ids) {
    const rounded = round2(rawShares.get(id) ?? 0);
    result.set(id, rounded);
    roundedSum += rounded;
  }
  roundedSum = round2(roundedSum);

  let diffCents = Math.round((round2(amount) - roundedSum) * 100);
  const adjustmentOrder = [...ids].sort((a, b) => {
    const w = (weightByParticipantId.get(b) ?? 0) - (weightByParticipantId.get(a) ?? 0);
    if (w !== 0) {
      return w;
    }
    return a.localeCompare(b);
  });

  while (diffCents !== 0 && adjustmentOrder.length > 0) {
    for (const id of adjustmentOrder) {
      if (diffCents === 0) {
        break;
      }
      const current = result.get(id) ?? 0;
      if (diffCents < 0 && current < 0.01) {
        continue;
      }
      result.set(id, round2(current + (diffCents > 0 ? 0.01 : -0.01)));
      diffCents += diffCents > 0 ? -1 : 1;
    }
  }

  return result;
}

export function computeAllocations(input: {
  participants: SplitParticipantSeed[];
  lineItems: SplitLineItemSeed[];
  sharedCharge: number;
}) {
  const participantMap = new Map(input.participants.map((participant) => [participant.id, participant]));
  const allocations: ComputedAllocation[] = [];
  const itemSubtotalByParticipantId = new Map<string, number>();

  for (const lineItem of input.lineItems) {
    const validParticipants = lineItem.participantIds.filter((id) => participantMap.has(id));
    if (validParticipants.length === 0) {
      continue;
    }

    const split = splitEvenly(lineItem.totalPrice, validParticipants);
    for (const [participantId, amount] of split.entries()) {
      allocations.push({
        participantId,
        allocationType: 'ITEM',
        expenseLineItemId: lineItem.expenseLineItemId,
        lineItemLabel: lineItem.label,
        amount,
      });
      itemSubtotalByParticipantId.set(
        participantId,
        round2((itemSubtotalByParticipantId.get(participantId) ?? 0) + amount),
      );
    }
  }

  const subtotal = round2(
    [...itemSubtotalByParticipantId.values()].reduce((acc, amount) => acc + amount, 0),
  );

  const sharedCharge = round2(Math.max(0, input.sharedCharge));
  if (sharedCharge > 0 && input.participants.length > 0) {
    const participantIds = input.participants.map((participant) => participant.id);
    const sharedDistribution = distributeByWeights(
      sharedCharge,
      participantIds,
      itemSubtotalByParticipantId,
    );

    for (const [participantId, amount] of sharedDistribution.entries()) {
      if (amount <= 0) {
        continue;
      }
      allocations.push({
        participantId,
        allocationType: 'SHARED_CHARGE',
        lineItemLabel: 'Shared charge',
        amount,
      });
    }
  }

  return {
    allocations,
    subtotal,
    sharedCharge,
    totalAmount: round2(subtotal + sharedCharge),
    itemSubtotalByParticipantId,
  };
}

export function computeParticipantBalances(input: {
  participants: SplitParticipantSeed[];
  allocations: ComputedAllocation[];
}): ParticipantBalance[] {
  const owedByParticipantId = new Map<string, number>();
  for (const allocation of input.allocations) {
    owedByParticipantId.set(
      allocation.participantId,
      round2((owedByParticipantId.get(allocation.participantId) ?? 0) + allocation.amount),
    );
  }

  return input.participants.map((participant) => {
    const owed = round2(owedByParticipantId.get(participant.id) ?? 0);
    const paid = round2(participant.paidAmount);
    return {
      participantId: participant.id,
      displayName: participant.displayName,
      owedAmount: owed,
      paidAmount: paid,
      netAmount: round2(paid - owed),
    };
  });
}

export function buildSettlements(balances: ParticipantBalance[]): SettlementEdge[] {
  const creditors = balances
    .filter((row) => row.netAmount > 0)
    .map((row) => ({ id: row.participantId, amount: row.netAmount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((row) => row.netAmount < 0)
    .map((row) => ({ id: row.participantId, amount: Math.abs(row.netAmount) }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: SettlementEdge[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const transfer = round2(Math.min(creditor.amount, debtor.amount));
    if (transfer > 0) {
      settlements.push({
        fromParticipantId: debtor.id,
        toParticipantId: creditor.id,
        amount: transfer,
      });
    }

    creditor.amount = round2(creditor.amount - transfer);
    debtor.amount = round2(debtor.amount - transfer);

    if (creditor.amount <= 0) {
      creditorIndex += 1;
    }
    if (debtor.amount <= 0) {
      debtorIndex += 1;
    }
  }

  return settlements;
}
