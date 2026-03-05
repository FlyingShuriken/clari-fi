import { FamilyMemberStatus, FamilyRole, SplitStatus } from '@prisma/client';
import { SplitsService } from '../src/modules/splits/splits.service';

describe('SplitsService', () => {
  const user = {
    id: 'user_owner',
    email: 'owner@example.com',
    clerkUserId: 'clerk_owner',
  };

  it('forbids splitting another user personal expense', async () => {
    const prisma = {
      familyMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'membership-owner',
          familyId: 'family-1',
          userId: user.id,
          role: FamilyRole.OWNER,
          status: FamilyMemberStatus.ACTIVE,
          user: {
            id: user.id,
            email: user.email,
            displayName: 'Owner',
          },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      expense: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'expense-1',
          userId: 'other-user',
          familyId: null,
          totalAmount: { toNumber: () => 20 },
          lineItems: [],
          currency: 'MYR',
          merchantText: 'Store',
        }),
      },
    } as any;

    const service = new SplitsService(prisma);

    await expect(
      service.createSplit(user, {
        familyId: 'family-1',
        expenseId: 'expense-1',
      }),
    ).rejects.toThrow('only split your own personal expenses');
  });

  it('blocks finalize when split has no allocations', async () => {
    const prisma = {
      familyMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'membership-owner',
          familyId: 'family-1',
          userId: user.id,
          role: FamilyRole.OWNER,
          status: FamilyMemberStatus.ACTIVE,
          user: {
            id: user.id,
            email: user.email,
            displayName: 'Owner',
          },
        }),
      },
      splitSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'split-1',
          familyId: 'family-1',
          status: SplitStatus.DRAFT,
          family: {
            id: 'family-1',
            name: 'Household',
          },
          expense: null,
          participants: [],
          allocations: [],
          settlements: [],
        }),
      },
    } as any;

    const service = new SplitsService(prisma);

    await expect(service.finalizeSplit(user, 'split-1')).rejects.toThrow(
      'without allocations',
    );
  });
});
