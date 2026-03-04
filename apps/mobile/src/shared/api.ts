import type {
  AlertEvent,
  AuthVerifyResponse,
  PriceAlert,
  PriceBackfillResponse,
  PriceCompareResponse,
  PriceHistoryResponse,
  PromoIngestionItem,
  PromoReviewStatus,
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
    includePromo?: boolean;
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
  if (typeof query.includePromo === 'boolean') {
    params.set('includePromo', String(query.includePromo));
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
    includePromo?: boolean;
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
  if (typeof query.includePromo === 'boolean') {
    params.set('includePromo', String(query.includePromo));
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

export async function createPriceAlert(
  baseUrl: string,
  bearerToken: string,
  input: {
    item: string;
    targetUnitPrice: number;
    radiusKm?: number;
    areaText?: string;
    storeId?: string;
    active?: boolean;
  },
): Promise<PriceAlert> {
  return apiRequest<PriceAlert>(baseUrl, '/prices/alerts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listPriceAlerts(
  baseUrl: string,
  bearerToken: string,
): Promise<{ total: number; items: PriceAlert[] }> {
  return apiRequest<{ total: number; items: PriceAlert[] }>(baseUrl, '/prices/alerts', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function updatePriceAlert(
  baseUrl: string,
  bearerToken: string,
  alertId: string,
  input: Partial<{
    item: string;
    targetUnitPrice: number;
    radiusKm: number;
    areaText: string;
    storeId: string;
    active: boolean;
  }>,
): Promise<PriceAlert> {
  return apiRequest<PriceAlert>(baseUrl, `/prices/alerts/${alertId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function disablePriceAlert(
  baseUrl: string,
  bearerToken: string,
  alertId: string,
): Promise<{ alertId: string; active: boolean }> {
  return apiRequest<{ alertId: string; active: boolean }>(baseUrl, `/prices/alerts/${alertId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function checkPriceAlerts(
  baseUrl: string,
  bearerToken: string,
  input: {
    lat?: number;
    lng?: number;
    areaText?: string;
    includePromo?: boolean;
    limit?: number;
  },
): Promise<{ checked: number; triggeredCount: number; triggered: Array<Record<string, unknown>> }> {
  return apiRequest<{
    checked: number;
    triggeredCount: number;
    triggered: Array<Record<string, unknown>>;
  }>(baseUrl, '/prices/alerts/check', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listAlertEvents(
  baseUrl: string,
  bearerToken: string,
  query?: {
    limit?: number;
    unreadOnly?: boolean;
  },
): Promise<{ total: number; items: AlertEvent[] }> {
  const params = new URLSearchParams();
  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }
  if (typeof query?.unreadOnly === 'boolean') {
    params.set('unreadOnly', String(query.unreadOnly));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<{ total: number; items: AlertEvent[] }>(baseUrl, `/prices/alerts/events${suffix}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function markAlertEventRead(
  baseUrl: string,
  bearerToken: string,
  eventId: string,
): Promise<{ id: string; readAt: string | null }> {
  return apiRequest<{ id: string; readAt: string | null }>(
    baseUrl,
    `/prices/alerts/events/${eventId}/read`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bearerToken}` },
      body: JSON.stringify({}),
    },
  );
}

export async function ingestPromo(
  baseUrl: string,
  bearerToken: string,
  input: {
    fileRef: string;
    mimeType: string;
    merchantText?: string;
    areaText?: string;
    validFrom?: string;
    validTo?: string;
    autoApprove?: boolean;
  },
): Promise<{
  ingestionId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created: number;
  skipped: number;
  reviewStatus: PromoReviewStatus;
}> {
  return apiRequest<{
    ingestionId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    created: number;
    skipped: number;
    reviewStatus: PromoReviewStatus;
  }>(baseUrl, '/prices/promos/ingest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listPromos(
  baseUrl: string,
  bearerToken: string,
  query?: {
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    reviewStatus?: PromoReviewStatus;
    limit?: number;
  },
): Promise<{ total: number; items: PromoIngestionItem[] }> {
  const params = new URLSearchParams();
  if (query?.status) {
    params.set('status', query.status);
  }
  if (query?.reviewStatus) {
    params.set('reviewStatus', query.reviewStatus);
  }
  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<{ total: number; items: PromoIngestionItem[] }>(baseUrl, `/prices/promos${suffix}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function reviewPromoObservations(
  baseUrl: string,
  bearerToken: string,
  input: {
    observations: Array<{ id: string }>;
    reviewStatus: PromoReviewStatus;
  },
): Promise<{ updated: number; reviewStatus: PromoReviewStatus }> {
  return apiRequest<{ updated: number; reviewStatus: PromoReviewStatus }>(
    baseUrl,
    '/prices/promos/review',
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bearerToken}` },
      body: JSON.stringify(input),
    },
  );
}
