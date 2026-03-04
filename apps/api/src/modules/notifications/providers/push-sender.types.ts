export interface PushDeliveryMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushDeliveryResult {
  to: string;
  status: 'ok' | 'error';
  ticketId?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PushSender {
  readonly providerName: string;
  sendMany(messages: PushDeliveryMessage[]): Promise<PushDeliveryResult[]>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');
