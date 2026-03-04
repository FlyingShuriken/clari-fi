import { Injectable } from '@nestjs/common';
import {
  ClerkVerifierService,
  type VerifiedClerkIdentity,
} from '../../infrastructure/auth/clerk-verifier.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkVerifierService: ClerkVerifierService,
  ) {}

  async verifyClerkSessionToken(token: string): Promise<VerifiedClerkIdentity> {
    return this.clerkVerifierService.verifySessionToken(token);
  }

  async upsertUser(identity: VerifiedClerkIdentity) {
    return this.prisma.user.upsert({
      where: { clerkUserId: identity.sub },
      create: {
        clerkUserId: identity.sub,
        email: identity.email,
      },
      update: {
        email: identity.email,
      },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
      },
    });
  }

  async resolveAndUpsertFromToken(token: string) {
    const identity = await this.verifyClerkSessionToken(token);
    return this.upsertUser(identity);
  }
}
