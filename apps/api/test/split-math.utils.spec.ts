import {
  buildSettlements,
  computeAllocations,
  computeParticipantBalances,
} from '../src/modules/splits/split-math.utils';

describe('split-math.utils', () => {
  it('allocates item totals and prorates shared charges by assigned subtotals', () => {
    const computed = computeAllocations({
      participants: [
        { id: 'p1', displayName: 'Alice', isPayer: true, paidAmount: 14 },
        { id: 'p2', displayName: 'Bob', isPayer: false, paidAmount: 0 },
      ],
      lineItems: [
        {
          expenseLineItemId: 'line-1',
          label: 'watermelon',
          totalPrice: 10,
          participantIds: ['p1', 'p2'],
        },
      ],
      sharedCharge: 4,
    });

    expect(computed.subtotal).toBe(10);
    expect(computed.sharedCharge).toBe(4);
    expect(computed.totalAmount).toBe(14);

    const p1Total = computed.allocations
      .filter((row) => row.participantId === 'p1')
      .reduce((acc, row) => acc + row.amount, 0);
    const p2Total = computed.allocations
      .filter((row) => row.participantId === 'p2')
      .reduce((acc, row) => acc + row.amount, 0);

    expect(p1Total).toBe(7);
    expect(p2Total).toBe(7);
  });

  it('builds settlement edges from participant net balances', () => {
    const balances = computeParticipantBalances({
      participants: [
        { id: 'p1', displayName: 'Alice', isPayer: true, paidAmount: 20 },
        { id: 'p2', displayName: 'Bob', isPayer: false, paidAmount: 0 },
        { id: 'p3', displayName: 'Carol', isPayer: false, paidAmount: 0 },
      ],
      allocations: [
        { participantId: 'p1', allocationType: 'ITEM', amount: 5 },
        { participantId: 'p2', allocationType: 'ITEM', amount: 7 },
        { participantId: 'p3', allocationType: 'ITEM', amount: 8 },
      ],
    });

    const settlements = buildSettlements(balances);
    const totalSettled = settlements.reduce((acc, row) => acc + row.amount, 0);

    expect(totalSettled).toBe(15);
    expect(settlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromParticipantId: 'p3', toParticipantId: 'p1', amount: 8 }),
        expect.objectContaining({ fromParticipantId: 'p2', toParticipantId: 'p1', amount: 7 }),
      ]),
    );
  });
});
