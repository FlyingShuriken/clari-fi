function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  const databaseUrl = asString(config.DATABASE_URL);
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  const clerkSecretKey = asString(config.CLERK_SECRET_KEY);
  if (!clerkSecretKey) {
    errors.push('CLERK_SECRET_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
