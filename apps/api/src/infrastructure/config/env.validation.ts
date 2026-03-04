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

  const parserProvider = asString(config.EXPENSE_PARSER_PROVIDER).trim().toLowerCase();
  if (
    parserProvider &&
    parserProvider !== 'heuristic' &&
    parserProvider !== 'openrouter' &&
    parserProvider !== 'shadow'
  ) {
    errors.push('EXPENSE_PARSER_PROVIDER must be one of: heuristic, openrouter, shadow');
  }

  const parserTimeoutRaw = asString(config.OPENROUTER_PARSER_TIMEOUT_MS).trim();
  if (parserTimeoutRaw) {
    const parserTimeout = Number(parserTimeoutRaw);
    if (!Number.isFinite(parserTimeout) || parserTimeout <= 0) {
      errors.push('OPENROUTER_PARSER_TIMEOUT_MS must be a positive number');
    }
  }

  const outlierThresholdRaw = asString(config.PRICE_OUTLIER_ZSCORE_THRESHOLD).trim();
  if (outlierThresholdRaw) {
    const threshold = Number(outlierThresholdRaw);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      errors.push('PRICE_OUTLIER_ZSCORE_THRESHOLD must be a positive number');
    }
  }

  const priceIntelligenceEnabled = asString(config.PRICE_INTELLIGENCE_ENABLED)
    .trim()
    .toLowerCase();
  if (
    priceIntelligenceEnabled &&
    priceIntelligenceEnabled !== 'true' &&
    priceIntelligenceEnabled !== 'false'
  ) {
    errors.push('PRICE_INTELLIGENCE_ENABLED must be true or false');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
