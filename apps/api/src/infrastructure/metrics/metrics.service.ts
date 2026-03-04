import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  trackTiming(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    this.logger.log(
      JSON.stringify({ metric: name, type: 'timing', durationMs, tags, ts: new Date().toISOString() }),
    );
  }

  trackCounter(name: string, value = 1, tags: Record<string, string> = {}): void {
    this.logger.log(
      JSON.stringify({ metric: name, type: 'counter', value, tags, ts: new Date().toISOString() }),
    );
  }
}
