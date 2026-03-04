import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import {
  PUSH_SENDER,
  type PushDeliveryResult,
  type PushSender,
} from './providers/push-sender.types';

function isDeviceNotRegistered(result: PushDeliveryResult): boolean {
  const rawError = [result.error, String(result.details?.error ?? ''), String(result.details?.reason ?? '')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return rawError.includes('devicenotregistered');
}

export interface AlertPushDispatchInput {
  userId: string;
  eventId: string;
  itemName: string;
  triggerUnitPrice: number;
  targetUnitPrice: number;
  source: 'EXPENSE' | 'PROMO';
  storeName?: string;
  areaText?: string;
}

export interface AlertPushDispatchResult {
  enabled: boolean;
  provider: string;
  attempted: number;
  sent: number;
  failed: number;
  revoked: number;
  failures: Array<{ token: string; reason: string }>;
  sentAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    @Inject(PUSH_SENDER) private readonly pushSender: PushSender,
  ) {}

  isEnabled(): boolean {
    const value =
      this.config.get<string>('PUSH_NOTIFICATIONS_ENABLED')?.trim().toLowerCase() ?? 'true';
    return value !== 'false';
  }

  async registerDevice(user: AuthenticatedUser, dto: RegisterPushDeviceDto) {
    const expoPushToken = dto.expoPushToken.trim();
    const now = new Date();

    const device = await this.prisma.pushDevice.upsert({
      where: {
        expoPushToken,
      },
      create: {
        userId: user.id,
        expoPushToken,
        platform: dto.platform,
        appVersion: dto.appVersion,
        lastSeenAt: now,
      },
      update: {
        userId: user.id,
        platform: dto.platform,
        appVersion: dto.appVersion,
        lastSeenAt: now,
        revokedAt: null,
      },
    });

    return this.serializeDevice(device);
  }

  async listDevices(user: AuthenticatedUser) {
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      total: devices.length,
      items: devices.map((device) => this.serializeDevice(device)),
      generatedAt: new Date().toISOString(),
      userId: user.id,
    };
  }

  async revokeDevice(user: AuthenticatedUser, token: string) {
    const expoPushToken = decodeURIComponent(token).trim();
    const now = new Date();

    const updated = await this.prisma.pushDevice.updateMany({
      where: {
        userId: user.id,
        expoPushToken,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Push device not found');
    }

    return {
      token: expoPushToken,
      revoked: true,
      updatedAt: now.toISOString(),
      userId: user.id,
    };
  }

  async sendPriceAlertEvent(input: AlertPushDispatchInput): Promise<AlertPushDispatchResult> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        provider: this.pushSender.providerName,
        attempted: 0,
        sent: 0,
        failed: 0,
        revoked: 0,
        failures: [],
        sentAt: new Date().toISOString(),
      };
    }

    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId: input.userId,
        revokedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
    });

    const nowIso = new Date().toISOString();
    if (!devices.length) {
      return {
        enabled: true,
        provider: this.pushSender.providerName,
        attempted: 0,
        sent: 0,
        failed: 0,
        revoked: 0,
        failures: [],
        sentAt: nowIso,
      };
    }

    const locationText = input.storeName ?? input.areaText ?? 'nearby';
    const title = `Price alert: ${input.itemName}`;
    const body = `Now RM ${input.triggerUnitPrice.toFixed(2)} (target RM ${input.targetUnitPrice.toFixed(2)}) at ${locationText}`;

    const results = await this.pushSender.sendMany(
      devices.map((device) => ({
        to: device.expoPushToken,
        title,
        body,
        data: {
          type: 'price_alert',
          eventId: input.eventId,
          item: input.itemName,
          source: input.source,
        },
      })),
    );

    const sent = results.filter((result) => result.status === 'ok').length;
    const failedResults = results.filter((result) => result.status === 'error');
    const revokedTokens = failedResults
      .filter((result) => isDeviceNotRegistered(result))
      .map((result) => result.to);

    if (revokedTokens.length) {
      await this.prisma.pushDevice.updateMany({
        where: {
          userId: input.userId,
          expoPushToken: {
            in: revokedTokens,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    this.metrics.trackCounter('alerts.push.sent.count', sent, {
      provider: this.pushSender.providerName,
    });
    this.metrics.trackCounter('alerts.push.failed.count', failedResults.length, {
      provider: this.pushSender.providerName,
    });

    return {
      enabled: true,
      provider: this.pushSender.providerName,
      attempted: results.length,
      sent,
      failed: failedResults.length,
      revoked: revokedTokens.length,
      failures: failedResults.slice(0, 5).map((result) => ({
        token: result.to,
        reason: result.error ?? 'Push delivery failed',
      })),
      sentAt: nowIso,
    };
  }

  private serializeDevice(device: {
    id: string;
    expoPushToken: string;
    platform: string | null;
    appVersion: string | null;
    lastSeenAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: device.id,
      expoPushToken: device.expoPushToken,
      platform: device.platform ?? undefined,
      appVersion: device.appVersion ?? undefined,
      lastSeenAt: device.lastSeenAt.toISOString(),
      revokedAt: device.revokedAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
      active: device.revokedAt === null,
    };
  }
}
