import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface QueuedPayload {
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redisUrl: string;

  constructor(private readonly config: ConfigService) {
    this.redisUrl = this.config.get<string>('REDIS_URL', '');
  }

  isEnabled(): boolean {
    return Boolean(this.redisUrl);
  }

  async enqueue(jobName: string, data: QueuedPayload): Promise<string | null> {
    if (!this.isEnabled()) {
      this.logger.warn(`Queue disabled (REDIS_URL missing). Skipping job ${jobName}.`);
      return null;
    }

    // BullMQ adapter placeholder: structured to allow drop-in Queue/Worker wiring.
    const syntheticJobId = `${jobName}_${Date.now()}`;
    this.logger.log(
      JSON.stringify({
        queue: 'clarifi-jobs',
        jobName,
        jobId: syntheticJobId,
        redis: 'configured',
        data,
      }),
    );

    return syntheticJobId;
  }

  async onModuleDestroy(): Promise<void> {
    return Promise.resolve();
  }
}
