import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

type EnvMap = Record<string, string>;

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const result: EnvMap = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadLocalEnv(): EnvMap {
  const repoRoot = path.resolve(__dirname, '../..');

  return {
    ...parseEnvFile(path.join(repoRoot, '.env')),
    ...parseEnvFile(path.join(repoRoot, '.env.local')),
    ...parseEnvFile(path.join(__dirname, '.env')),
    ...parseEnvFile(path.join(__dirname, '.env.local')),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = loadLocalEnv();
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    env.EXPO_PUBLIC_API_BASE_URL ??
    'http://localhost:3000/v1';
  const clerkPublishableKey =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    '';
  const sttOnDeviceEnabled =
    process.env.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
    env.EXPO_PUBLIC_STT_ON_DEVICE_ENABLED ??
    'true';

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
      EXPO_PUBLIC_STT_ON_DEVICE_ENABLED: sttOnDeviceEnabled,
    },
  };
};
