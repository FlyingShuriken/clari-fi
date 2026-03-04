import { Injectable } from '@nestjs/common';
import {
  type PushDeliveryMessage,
  type PushDeliveryResult,
  type PushSender,
} from './push-sender.types';

@Injectable()
export class MockPushSender implements PushSender {
  readonly providerName = 'mock';

  async sendMany(messages: PushDeliveryMessage[]): Promise<PushDeliveryResult[]> {
    return messages.map((message) => ({
      to: message.to,
      status: message.to.includes('invalid') ? 'error' : 'ok',
      ticketId: message.to.includes('invalid') ? undefined : `mock-${Date.now()}`,
      error: message.to.includes('invalid') ? 'DeviceNotRegistered' : undefined,
      details: message.to.includes('invalid')
        ? { error: 'DeviceNotRegistered', source: 'mock' }
        : undefined,
    }));
  }
}
