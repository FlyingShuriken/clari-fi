import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PricesService } from './prices.service';

@Injectable()
export class PricesAlertsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PricesAlertsScheduler.name);
  private readonly jobName = 'price-alerts-scheduler';
  private running = false;

  constructor(
    private readonly pricesService: PricesService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const expression = this.config.get<string>('ALERT_CHECK_CRON')?.trim() || '*/30 * * * *';
    const job = new CronJob(expression, () => {
      void this.handleCron();
    });

    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();
    this.logger.log(
      JSON.stringify({
        job: this.jobName,
        status: 'started',
        cron: expression,
      }),
    );
  }

  async handleCron() {
    if (this.running) {
      return;
    }

    const enabled =
      this.config.get<string>('PRICE_ALERTS_ENABLED')?.trim().toLowerCase() ?? 'true';
    if (enabled === 'false') {
      return;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      const thresholdResult = await this.pricesService.runScheduledAlertChecks();
      const signalResult = await this.pricesService.runScheduledSignalChecks();
      this.metrics.trackCounter('alerts.scheduler.run.count', 1, { status: 'success' });
      this.metrics.trackCounter('alerts.scheduler.triggered.count', thresholdResult.triggeredCount);
      this.metrics.trackCounter('alerts.push.sent.count', thresholdResult.pushSent);
      this.metrics.trackCounter('alerts.push.failed.count', thresholdResult.pushFailed);
      this.metrics.trackCounter('signals.alerts.scheduler.triggered.count', signalResult.triggeredCount);
      this.metrics.trackCounter('signals.alerts.scheduler.cooldown_skipped.count', signalResult.cooldownSkipped);
      this.logger.log(JSON.stringify({
        job: 'price-alerts-scheduler',
        thresholdResult,
        signalResult,
        finishedAt: new Date().toISOString(),
      }));
    } catch (error) {
      this.metrics.trackCounter('alerts.scheduler.run.count', 1, { status: 'error' });
      this.logger.error(
        JSON.stringify({
          job: 'price-alerts-scheduler',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      this.running = false;
      this.metrics.trackTiming('alerts.scheduler.latency_ms', Date.now() - startedAt);
    }
  }
}
