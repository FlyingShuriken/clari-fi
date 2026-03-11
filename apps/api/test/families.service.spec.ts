import { FamilyMemberStatus, FamilyRole } from '@prisma/client';
import { FamiliesService } from '../src/modules/families/families.service';

describe('FamiliesService', () => {
  const subscriptionsService = {
    assertFamilyCapacity: jest.fn().mockResolvedValue(undefined),
  } as any;

  const user = {
    id: 'user_owner',
    email: 'owner@example.com',
    clerkUserId: 'clerk_owner',
  };

  it('rejects invite creation when requester is not OWNER', async () => {
    const prisma = {
      familyMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'member-1',
          familyId: 'family-1',
          userId: user.id,
          role: FamilyRole.VIEWER,
          status: FamilyMemberStatus.ACTIVE,
          family: {
            id: 'family-1',
            name: 'Household',
          },
        }),
      },
    } as any;

    const service = new FamiliesService(prisma, subscriptionsService);

    await expect(service.createInvite(user, 'family-1', { expiresInDays: 7 })).rejects.toThrow(
      'Insufficient family permissions',
    );
  });

  it('prevents demoting the last OWNER in a family', async () => {
    const prisma = {
      familyMember: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.familyId_userId) {
            return Promise.resolve({
              id: 'membership-owner',
              familyId: 'family-1',
              userId: user.id,
              role: FamilyRole.OWNER,
              status: FamilyMemberStatus.ACTIVE,
              family: {
                id: 'family-1',
                name: 'Household',
              },
            });
          }

          return Promise.resolve({
            id: 'member-target',
            familyId: 'family-1',
            userId: user.id,
            role: FamilyRole.OWNER,
            status: FamilyMemberStatus.ACTIVE,
            user: {
              id: user.id,
              email: user.email,
              displayName: 'Owner',
            },
          });
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;

    const service = new FamiliesService(prisma, subscriptionsService);

    await expect(
      service.updateMemberRole(user, 'family-1', 'member-target', { role: FamilyRole.EDITOR }),
    ).rejects.toThrow('Family must have at least one owner');
  });
});
