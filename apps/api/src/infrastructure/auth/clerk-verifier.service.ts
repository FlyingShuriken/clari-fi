import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';

export interface VerifiedClerkIdentity {
  sub: string;
  email: string;
}

@Injectable()
export class ClerkVerifierService {
  constructor(private readonly config: ConfigService) {}

  private getSecretKey(): string {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY', '').trim();
    if (!secretKey) {
      throw new UnauthorizedException('CLERK_SECRET_KEY is not configured');
    }
    return secretKey;
  }

  private getClerkClient() {
    return createClerkClient({
      secretKey: this.getSecretKey(),
    });
  }

  private async resolveEmailFromPayloadOrApi(
    sub: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const candidateEmail =
      typeof payload.email === 'string'
        ? payload.email
        : typeof payload.email_address === 'string'
          ? payload.email_address
          : undefined;

    if (candidateEmail) {
      return candidateEmail.toLowerCase();
    }

    const clerkClient = this.getClerkClient();
    const user = await clerkClient.users.getUser(sub);

    const primaryEmail = user.emailAddresses.find(
      (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
    );

    const fallbackEmail =
      primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

    if (!fallbackEmail) {
      throw new UnauthorizedException('Unable to resolve Clerk user email');
    }

    return fallbackEmail.toLowerCase();
  }

  async verifySessionToken(token: string): Promise<VerifiedClerkIdentity> {
    const audience = this.config.get<string>('CLERK_AUDIENCE', '').trim();
    const authorizedPartiesRaw = this.config
      .get<string>('CLERK_AUTHORIZED_PARTIES', '')
      .trim();

    let payload: Record<string, unknown>;
    try {
      payload = await verifyToken(token, {
        secretKey: this.getSecretKey(),
        audience: audience || undefined,
        authorizedParties: authorizedPartiesRaw
          ? authorizedPartiesRaw.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
      });
    } catch {
      throw new UnauthorizedException('Invalid Clerk session token');
    }

    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Clerk token missing subject');
    }

    const email = await this.resolveEmailFromPayloadOrApi(sub, payload);

    return { sub, email };
  }
}
