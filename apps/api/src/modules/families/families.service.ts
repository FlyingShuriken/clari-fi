import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyInviteStatus, FamilyMemberStatus, FamilyRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateFamilyInviteDto } from './dto/create-family-invite.dto';
import { CreateFamilyDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { UpdateFamilyMemberDto } from './dto/update-family-member.dto';

type FamilySnapshot = Awaited<ReturnType<FamiliesService['getFamilySnapshotById']>>;

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
export class FamiliesService {
  private static readonly DEFAULT_INVITE_TTL_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(
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
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership || membership.status !== FamilyMemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active member of this family.');
    }

    if (roleRank(membership.role) < roleRank(minRole)) {
      throw new ForbiddenException('Insufficient family permissions.');
    }

    return membership;
  }

  private async getFamilySnapshotById(familyId: string) {
    return this.prisma.familyProfile.findUnique({
      where: { id: familyId },
      include: {
        members: {
          where: { status: FamilyMemberStatus.ACTIVE },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
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
        invites: {
          where: {
            status: FamilyInviteStatus.ACTIVE,
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
          take: 5,
        },
      },
    });
  }

  private mapFamilySnapshot(snapshot: NonNullable<FamilySnapshot>, currentUserId: string) {
    const currentMember = snapshot.members.find((member) => member.userId === currentUserId);

    return {
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      currentUserRole: currentMember?.role ?? null,
      members: snapshot.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        email: member.user.email,
        displayName: member.user.displayName,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
      })),
      invites: snapshot.invites
        .filter((invite) => invite.expiresAt > new Date())
        .map((invite) => ({
          id: invite.id,
          code: invite.code,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          createdBy: {
            id: invite.createdBy.id,
            email: invite.createdBy.email,
            displayName: invite.createdBy.displayName,
          },
        })),
    };
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.familyInvite.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }
    throw new BadRequestException('Could not generate invite code. Try again.');
  }

  async createFamily(user: AuthenticatedUser, dto: CreateFamilyDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      const family = await tx.familyProfile.create({
        data: {
          name: dto.name.trim(),
          createdByUserId: user.id,
        },
      });

      await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role: FamilyRole.OWNER,
          status: FamilyMemberStatus.ACTIVE,
        },
      });

      return family;
    });

    const snapshot = await this.getFamilySnapshotById(created.id);
    if (!snapshot) {
      throw new NotFoundException('Family was created but could not be loaded.');
    }

    return {
      family: this.mapFamilySnapshot(snapshot, user.id),
    };
  }

  async listFamilies(user: AuthenticatedUser) {
    const memberships = await this.prisma.familyMember.findMany({
      where: {
        userId: user.id,
        status: FamilyMemberStatus.ACTIVE,
      },
      orderBy: {
        joinedAt: 'desc',
      },
      include: {
        family: {
          include: {
            members: {
              where: { status: FamilyMemberStatus.ACTIVE },
              orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
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
            invites: {
              where: {
                status: FamilyInviteStatus.ACTIVE,
              },
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                createdBy: {
                  select: {
                    id: true,
                    email: true,
                    displayName: true,
                  },
                },
              },
              take: 5,
            },
          },
        },
      },
    });

    return {
      total: memberships.length,
      items: memberships.map((membership) =>
        this.mapFamilySnapshot(membership.family, user.id),
      ),
    };
  }

  async createInvite(user: AuthenticatedUser, familyId: string, dto: CreateFamilyInviteDto) {
    await this.requireMembership(user.id, familyId, FamilyRole.OWNER);
    const expiresInDays = dto.expiresInDays ?? FamiliesService.DEFAULT_INVITE_TTL_DAYS;
    const code = await this.generateUniqueInviteCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.familyInvite.create({
      data: {
        familyId,
        code,
        createdByUserId: user.id,
        status: FamilyInviteStatus.ACTIVE,
        expiresAt,
      },
    });

    return {
      invite: {
        id: invite.id,
        familyId: invite.familyId,
        code: invite.code,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    };
  }

  async joinByCode(user: AuthenticatedUser, dto: JoinFamilyDto) {
    const code = dto.code.trim().toUpperCase();
    const invite = await this.prisma.familyInvite.findUnique({
      where: { code },
      include: {
        family: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite code not found.');
    }

    const now = new Date();
    if (invite.status !== FamilyInviteStatus.ACTIVE || invite.expiresAt <= now) {
      if (invite.status === FamilyInviteStatus.ACTIVE && invite.expiresAt <= now) {
        await this.prisma.familyInvite.update({
          where: { id: invite.id },
          data: {
            status: FamilyInviteStatus.EXPIRED,
          },
        });
      }
      throw new BadRequestException('Invite code is invalid or expired.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyInvite.update({
        where: { id: invite.id },
        data: {
          status: FamilyInviteStatus.USED,
          usedByUserId: user.id,
          usedAt: now,
        },
      });

      await tx.familyMember.upsert({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId: user.id,
          },
        },
        update: {
          status: FamilyMemberStatus.ACTIVE,
          removedAt: null,
          joinedAt: now,
        },
        create: {
          familyId: invite.familyId,
          userId: user.id,
          role: FamilyRole.VIEWER,
          status: FamilyMemberStatus.ACTIVE,
          joinedAt: now,
        },
      });
    });

    const snapshot = await this.getFamilySnapshotById(invite.family.id);
    if (!snapshot) {
      throw new NotFoundException('Joined family but could not load profile.');
    }

    return {
      family: this.mapFamilySnapshot(snapshot, user.id),
      joinedAt: now,
    };
  }

  async updateMemberRole(
    user: AuthenticatedUser,
    familyId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto,
  ) {
    await this.requireMembership(user.id, familyId, FamilyRole.OWNER);

    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
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

    if (!member || member.familyId !== familyId || member.status !== FamilyMemberStatus.ACTIVE) {
      throw new NotFoundException('Family member not found.');
    }

    if (member.role === FamilyRole.OWNER && dto.role !== FamilyRole.OWNER) {
      const activeOwnerCount = await this.prisma.familyMember.count({
        where: {
          familyId,
          status: FamilyMemberStatus.ACTIVE,
          role: FamilyRole.OWNER,
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Family must have at least one owner.');
      }
    }

    const updated = await this.prisma.familyMember.update({
      where: { id: member.id },
      data: {
        role: dto.role,
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

    return {
      member: {
        id: updated.id,
        userId: updated.userId,
        email: updated.user.email,
        displayName: updated.user.displayName,
        role: updated.role,
        status: updated.status,
        joinedAt: updated.joinedAt,
      },
    };
  }

  async removeMember(user: AuthenticatedUser, familyId: string, memberId: string) {
    await this.requireMembership(user.id, familyId, FamilyRole.OWNER);

    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.familyId !== familyId || member.status !== FamilyMemberStatus.ACTIVE) {
      throw new NotFoundException('Family member not found.');
    }

    if (member.role === FamilyRole.OWNER) {
      const activeOwnerCount = await this.prisma.familyMember.count({
        where: {
          familyId,
          status: FamilyMemberStatus.ACTIVE,
          role: FamilyRole.OWNER,
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Family must have at least one owner.');
      }
    }

    const removedAt = new Date();
    await this.prisma.familyMember.update({
      where: { id: member.id },
      data: {
        status: FamilyMemberStatus.REMOVED,
        removedAt,
      },
    });

    return {
      memberId: member.id,
      familyId,
      removed: true,
      removedAt,
    };
  }
}
