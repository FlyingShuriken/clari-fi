import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppTokenPayload, VerifiedSupabaseIdentity } from './auth.types';
import {
  createRemoteJWKSet,
  decodeJwt,
  JWTPayload,
  jwtVerify,
  SignJWT,
} from 'jose';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async verifySupabaseToken(token: string): Promise<VerifiedSupabaseIdentity> {
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');

    let payload: JWTPayload;

    try {
      if (supabaseJwtSecret) {
        const verified = await jwtVerify(
          token,
          new TextEncoder().encode(supabaseJwtSecret),
        );
        payload = verified.payload;
      } else {
        if (!supabaseUrl) {
          throw new UnauthorizedException(
            'SUPABASE_URL or SUPABASE_JWT_SECRET must be configured',
          );
        }
        const jwks = createRemoteJWKSet(
          new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
        );
        const verified = await jwtVerify(token, jwks);
        payload = verified.payload;
      }
    } catch {
      throw new UnauthorizedException('Invalid Supabase access token');
    }

    const sub = payload.sub;
    const email = payload.email;

    if (!sub || typeof sub !== 'string' || !email || typeof email !== 'string') {
      throw new UnauthorizedException('Supabase token missing required claims');
    }

    return { sub, email };
  }

  async upsertUser(identity: VerifiedSupabaseIdentity) {
    return this.prisma.user.upsert({
      where: { supabaseUserId: identity.sub },
      create: {
        supabaseUserId: identity.sub,
        email: identity.email,
      },
      update: {
        email: identity.email,
      },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
      },
    });
  }

  async signAppToken(payload: AppTokenPayload): Promise<string> {
    const secret = this.config.get<string>('APP_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('APP_JWT_SECRET is not configured');
    }

    const expiresIn = this.config.get<string>('APP_JWT_EXPIRES_IN', '1d');

    return new SignJWT({ email: payload.email, supabaseUserId: payload.supabaseUserId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(new TextEncoder().encode(secret));
  }

  async verifyAppToken(token: string): Promise<AppTokenPayload> {
    const secret = this.config.get<string>('APP_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('APP_JWT_SECRET is not configured');
    }

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.supabaseUserId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid app token payload');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        supabaseUserId: payload.supabaseUserId,
      };
    } catch {
      throw new UnauthorizedException('Invalid app access token');
    }
  }

  decodeUnsafe(token: string): JWTPayload {
    return decodeJwt(token);
  }
}
