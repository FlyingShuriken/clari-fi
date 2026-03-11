import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePrismaDatabaseUrl(
  databaseUrl: string | undefined,
  options?: {
    connectionLimit?: number;
    poolTimeoutSeconds?: number;
  },
): string | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return databaseUrl;
  }

  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', String(options?.connectionLimit ?? 1));
  }

  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', String(options?.poolTimeoutSeconds ?? 20));
  }

  return parsed.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = normalizePrismaDatabaseUrl(process.env.DATABASE_URL, {
      connectionLimit: parsePositiveInteger(process.env.PRISMA_CONNECTION_LIMIT, 1),
      poolTimeoutSeconds: parsePositiveInteger(process.env.PRISMA_POOL_TIMEOUT_SECONDS, 20),
    });

    super(
      databaseUrl
        ? {
            datasources: {
              db: {
                url: databaseUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
