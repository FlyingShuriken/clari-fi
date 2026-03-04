import type {
  AuthVerifyResponse,
  PriceBackfillResponse,
  PriceCompareResponse,
  PriceHistoryResponse,
  ReceiptParseResult,
  UploadArtifactResponse,
  VoiceParseResult,
} from './types';

function sanitizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestInit,
): Promise<T> {
  const response = await fetch(`${sanitizeUrl(baseUrl)}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function verifyClerkSessionToken(
  baseUrl: string,
  clerkSessionToken: string,
): Promise<AuthVerifyResponse> {
  return apiRequest<AuthVerifyResponse>(baseUrl, '/auth/clerk/verify', {
    method: 'POST',
    body: JSON.stringify({ clerkSessionToken }),
  });
}

export async function uploadArtifact(
  baseUrl: string,
  bearerToken: string,
  input: {
    kind: 'audio' | 'receipt';
    mimeType: string;
    fileBase64: string;
  },
): Promise<UploadArtifactResponse> {
  return apiRequest<UploadArtifactResponse>(baseUrl, '/artifacts/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function parseVoice(
  baseUrl: string,
  bearerToken: string,
  input: {
    transcript?: string;
    audioBase64?: string;
    locale?: string;
    deviceConfidence?: number;
  },
): Promise<VoiceParseResult> {
  return apiRequest<VoiceParseResult>(baseUrl, '/parse/voice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function parseReceipt(
  baseUrl: string,
  bearerToken: string,
  input: {
    fileRef?: string;
    mimeType?: string;
    imageBase64?: string;
  },
): Promise<ReceiptParseResult> {
  return apiRequest<ReceiptParseResult>(baseUrl, '/parse/receipt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function confirmExpense(
  baseUrl: string,
  bearerToken: string,
  payload: Record<string, unknown>,
): Promise<{ expenseId: string }> {
  return apiRequest<{ expenseId: string }>(baseUrl, '/expenses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(payload),
  });
}

export async function listExpenses(
  baseUrl: string,
  bearerToken: string,
): Promise<{ total: number; items: unknown[] }> {
  return apiRequest<{ total: number; items: unknown[] }>(baseUrl, '/expenses', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function loadMonthlyReport(
  baseUrl: string,
  bearerToken: string,
): Promise<Record<string, unknown>> {
  const now = new Date();
  return apiRequest<Record<string, unknown>>(
    baseUrl,
    `/reports/monthly?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
}

export async function loadPriceCompare(
  baseUrl: string,
  bearerToken: string,
  query: {
    item: string;
    area?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  },
): Promise<PriceCompareResponse> {
  const params = new URLSearchParams({
    item: query.item,
  });

  if (query.area) {
    params.set('area', query.area);
  }
  if (typeof query.lat === 'number' && Number.isFinite(query.lat)) {
    params.set('lat', String(query.lat));
  }
  if (typeof query.lng === 'number' && Number.isFinite(query.lng)) {
    params.set('lng', String(query.lng));
  }
  if (typeof query.radiusKm === 'number' && Number.isFinite(query.radiusKm)) {
    params.set('radiusKm', String(query.radiusKm));
  }
  if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
    params.set('limit', String(query.limit));
  }

  return apiRequest<PriceCompareResponse>(baseUrl, `/prices/compare?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function loadPriceHistory(
  baseUrl: string,
  bearerToken: string,
  query: {
    item: string;
    area?: string;
    storeId?: string;
    from?: string;
    to?: string;
    interval?: 'day' | 'week';
  },
): Promise<PriceHistoryResponse> {
  const params = new URLSearchParams({
    item: query.item,
  });

  if (query.area) {
    params.set('area', query.area);
  }
  if (query.storeId) {
    params.set('storeId', query.storeId);
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.interval) {
    params.set('interval', query.interval);
  }

  return apiRequest<PriceHistoryResponse>(baseUrl, `/prices/history?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function runPriceBackfill(
  baseUrl: string,
  bearerToken: string,
  input?: {
    from?: string;
    to?: string;
    dryRun?: boolean;
    scope?: 'user' | 'all';
  },
): Promise<PriceBackfillResponse> {
  return apiRequest<PriceBackfillResponse>(baseUrl, '/prices/backfill', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input ?? {}),
  });
}
