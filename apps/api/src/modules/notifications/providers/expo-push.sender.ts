import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';
import {
  type PushDeliveryMessage,
  type PushDeliveryResult,
  type PushSender,
} from './push-sender.types';

interface ExpoPushTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

@Injectable()
export class ExpoPushSender implements PushSender {
  readonly providerName = 'expo';

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async sendMany(messages: PushDeliveryMessage[]): Promise<PushDeliveryResult[]> {
    if (!messages.length) {
      return [];
    }

    const endpoint =
      this.config.get<string>('EXPO_PUSH_API_URL')?.trim() ||
      'https://exp.host/--/api/v2/push/send';
    const accessToken = this.config.get<string>('EXPO_PUSH_ACCESS_TOKEN')?.trim();

    const results: PushDeliveryResult[] = [];
    const startedAt = Date.now();

    for (const batch of chunk(messages, 100)) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(
            batch.map((message) => ({
              to: message.to,
              title: message.title,
              body: message.body,
              data: message.data,
              sound: 'default',
              priority: 'high',
            })),
          ),
        });

        const payload = asRecord(await response.json().catch(() => ({})));
        const tickets = Array.isArray(payload.data) ? (payload.data as ExpoPushTicket[]) : [];

        if (!response.ok || tickets.length === 0) {
          const fallbackError = String(
            payload.errors ?? payload.message ?? response.statusText ?? 'Push API error',
          );
          for (const message of batch) {
            results.push({
              to: message.to,
              status: 'error',
              error: fallbackError,
              details: { status: response.status },
            });
          }
          continue;
        }

        for (let index = 0; index < batch.length; index += 1) {
          const message = batch[index];
          const ticket = tickets[index] ?? {};

          if (ticket.status === 'ok') {
            results.push({
              to: message.to,
              status: 'ok',
              ticketId: ticket.id,
            });
            continue;
          }

          results.push({
            to: message.to,
            status: 'error',
            error: ticket.message ?? 'Push delivery failed',
            details: asRecord(ticket.details),
          });
        }
      } catch (error) {
        const fallbackError = error instanceof Error ? error.message : String(error);
        for (const message of batch) {
          results.push({
            to: message.to,
            status: 'error',
            error: fallbackError,
            details: { source: 'network' },
          });
        }
      }
    }

    this.metrics.trackTiming('alerts.push.latency_ms', Date.now() - startedAt, {
      provider: this.providerName,
    });

    return results;
  }
}
