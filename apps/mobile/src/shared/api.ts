import type {
  AlertEvent,
  AuthVerifyResponse,
  FamilyInviteCreated,
  FamilyListResponse,
  FamilyProfile,
  FamilyRole,
  HealthLiveResponse,
  HealthReadyResponse,
  MultiStoreCompareResponse,
  MonthlyReportResponse,
  PriceAlert,
  PriceCompareResponse,
  DocumentParseResult,
  PriceHistoryResponse,
  PriceLocationSearchResponse,
  PriceSignalResponse,
  PromoIngestionItem,
  PromoReviewStatus,
  PushDevice,
  ReceiptParseResult,
  SplitDetailResponse,
  SplitSummary,
  SubscriptionSnapshot,
  UploadArtifactResponse,
  VoiceParseResult,
} from './types';

function sanitizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const API_TIMEOUT_MS = 20000;

function normalizeApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rawMessage = (payload as { message?: unknown }).message;
  if (typeof rawMessage === 'string' && rawMessage.trim()) {
    return rawMessage.trim();
  }
  if (Array.isArray(rawMessage)) {
    const joined = rawMessage
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(', ');
    return joined || null;
  }

  const rawError = (payload as { error?: unknown }).error;
  if (typeof rawError === 'string' && rawError.trim()) {
    return rawError.trim();
  }

  return null;
}

function normalizeHttpErrorMessage(status: number, message: string): string {
  if (status === 401) {
    return 'Session expired or unauthorized. Please sign in again.';
  }
  if (status === 403) {
    if (message) {
      return message;
    }
    return 'You do not have permission for this action.';
  }
  if (status === 413) {
    return 'Upload too large. Please use a smaller file.';
  }
  if (status >= 500) {
    return 'Server error. Please try again in a moment.';
  }
  if (status >= 400 && message) {
    return message;
  }

  return 'Unexpected API error.';
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.requestId = requestId;
  }
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${sanitizeUrl(baseUrl)}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw new Error('Network error. Please check internet connectivity and retry.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let payload: unknown;
    let text: string | undefined;

    try {
      payload = await response.clone().json();
    } catch {
      text = await response.text();
    }

    const apiMessage =
      normalizeApiMessage(payload) ??
      (typeof text === 'string' && text.trim() ? text.trim() : 'Request failed');
    const requestId = response.headers.get('x-request-id') ?? undefined;

    throw new ApiRequestError(
      response.status,
      normalizeHttpErrorMessage(response.status, apiMessage),
      requestId,
    );
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

export async function getHealthLive(baseUrl: string): Promise<HealthLiveResponse> {
  return apiRequest<HealthLiveResponse>(baseUrl, '/health/live', {
    method: 'GET',
  });
}

export async function getHealthReady(baseUrl: string): Promise<HealthReadyResponse> {
  return apiRequest<HealthReadyResponse>(baseUrl, '/health/ready', {
    method: 'GET',
  });
}

export async function registerPushDevice(
  baseUrl: string,
  bearerToken: string,
  input: {
    expoPushToken: string;
    platform?: 'ios' | 'android' | 'web';
    appVersion?: string;
  },
): Promise<PushDevice> {
  return apiRequest<PushDevice>(baseUrl, '/notifications/devices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listPushDevices(
  baseUrl: string,
  bearerToken: string,
): Promise<{ total: number; items: PushDevice[] }> {
  return apiRequest<{ total: number; items: PushDevice[] }>(baseUrl, '/notifications/devices', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function revokePushDevice(
  baseUrl: string,
  bearerToken: string,
  expoPushToken: string,
): Promise<{ token: string; revoked: boolean; updatedAt: string; userId: string }> {
  const encoded = encodeURIComponent(expoPushToken);
  return apiRequest<{ token: string; revoked: boolean; updatedAt: string; userId: string }>(
    baseUrl,
    `/notifications/devices/${encoded}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
}

export async function uploadArtifact(
  baseUrl: string,
  bearerToken: string,
  input: {
    kind: 'audio' | 'receipt' | 'document';
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

export async function parseDocument(
  baseUrl: string,
  bearerToken: string,
  input: {
    fileRefs?: string[];
    imageBase64s?: string[];
    mimeType?: string;
    preferredKind?: 'receipt' | 'flyer';
  },
): Promise<DocumentParseResult> {
  return apiRequest<DocumentParseResult>(baseUrl, '/parse/document', {
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
  query?: {
    familyId?: string;
  },
): Promise<{ total: number; items: unknown[] }> {
  const params = new URLSearchParams();
  if (query?.familyId) {
    params.set('familyId', query.familyId);
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';

  return apiRequest<{ total: number; items: unknown[] }>(baseUrl, `/expenses${suffix}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function loadMonthlyReport(
  baseUrl: string,
  bearerToken: string,
): Promise<MonthlyReportResponse> {
  const now = new Date();
  return apiRequest<MonthlyReportResponse>(
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

export async function loadMultiPriceCompare(
  baseUrl: string,
  bearerToken: string,
  input: {
    items: string[];
    area?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
    includePromo?: boolean;
  },
): Promise<MultiStoreCompareResponse> {
  return apiRequest<MultiStoreCompareResponse>(baseUrl, '/prices/compare/multi', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function searchPriceLocations(
  baseUrl: string,
  bearerToken: string,
  query: {
    q: string;
    lat?: number;
    lng?: number;
    limit?: number;
  },
): Promise<PriceLocationSearchResponse> {
  const params = new URLSearchParams({
    q: query.q,
  });

  if (typeof query.lat === 'number' && Number.isFinite(query.lat)) {
    params.set('lat', String(query.lat));
  }
  if (typeof query.lng === 'number' && Number.isFinite(query.lng)) {
    params.set('lng', String(query.lng));
  }
  if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
    params.set('limit', String(query.limit));
  }

  return apiRequest<PriceLocationSearchResponse>(
    baseUrl,
    `/prices/locations/search?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
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

export async function loadPriceSignal(
  baseUrl: string,
  bearerToken: string,
  query: {
    item: string;
    areaText?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    horizonDays?: number;
    includePromo?: boolean;
  },
): Promise<PriceSignalResponse> {
  const params = new URLSearchParams({
    item: query.item,
  });

  if (query.areaText) {
    params.set('areaText', query.areaText);
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
  if (typeof query.horizonDays === 'number' && Number.isFinite(query.horizonDays)) {
    params.set('horizonDays', String(query.horizonDays));
  }
  if (typeof query.includePromo === 'boolean') {
    params.set('includePromo', String(query.includePromo));
  }

  return apiRequest<PriceSignalResponse>(baseUrl, `/prices/signal?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function createPriceAlert(
  baseUrl: string,
  bearerToken: string,
  input: {
    item: string;
    targetUnitPrice?: number;
    radiusKm?: number;
    areaText?: string;
    storeId?: string;
    active?: boolean;
    kind?: 'THRESHOLD' | 'SIGNAL';
    signalDecisionFilter?: 'BUY_NOW' | 'WAIT' | 'BOTH';
    signalMinConfidence?: number;
    signalCooldownMinutes?: number;
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
    kind: 'THRESHOLD' | 'SIGNAL';
    radiusKm: number;
    areaText: string;
    storeId: string;
    active: boolean;
    signalDecisionFilter: 'BUY_NOW' | 'WAIT' | 'BOTH';
    signalMinConfidence: number;
    signalCooldownMinutes: number;
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
  return apiRequest<{ total: number; items: AlertEvent[] }>(
    baseUrl,
    `/prices/alerts/events${suffix}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
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

export async function markAllAlertEventsRead(
  baseUrl: string,
  bearerToken: string,
): Promise<{ updated: number; readAt: string; userId: string }> {
  return apiRequest<{ updated: number; readAt: string; userId: string }>(
    baseUrl,
    '/prices/alerts/events/read-all',
    {
      method: 'POST',
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

export async function confirmPromoIngestion(
  baseUrl: string,
  bearerToken: string,
  input: {
    fileRefs: string[];
    mimeType: string;
    merchantText?: string;
    areaText?: string;
    note?: string;
    validFrom?: string;
    validTo?: string;
    currency: 'MYR' | 'SGD' | 'USD';
    lineItems: Array<{
      descriptionRaw: string;
      quantity?: number;
      unitRaw?: string;
      unitPrice?: number;
      totalPrice: number;
      originalPrice?: number;
      promoText?: string;
      confidence?: number;
    }>;
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
  }>(baseUrl, '/prices/promos/confirm', {
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
  return apiRequest<{ total: number; items: PromoIngestionItem[] }>(
    baseUrl,
    `/prices/promos${suffix}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
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

export async function createFamily(
  baseUrl: string,
  bearerToken: string,
  input: { name: string },
): Promise<{ family: FamilyProfile }> {
  return apiRequest<{ family: FamilyProfile }>(baseUrl, '/families', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function getSubscription(
  baseUrl: string,
  bearerToken: string,
): Promise<SubscriptionSnapshot> {
  return apiRequest<SubscriptionSnapshot>(baseUrl, '/subscription/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function updateMockSubscription(
  baseUrl: string,
  bearerToken: string,
  input: {
    plan: 'FREE' | 'PREMIUM';
    addonCount: number;
  },
): Promise<SubscriptionSnapshot> {
  return apiRequest<SubscriptionSnapshot>(baseUrl, '/subscription/mock', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listFamilies(
  baseUrl: string,
  bearerToken: string,
): Promise<FamilyListResponse> {
  return apiRequest<FamilyListResponse>(baseUrl, '/families', {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function createFamilyInvite(
  baseUrl: string,
  bearerToken: string,
  familyId: string,
  input?: { expiresInDays?: number },
): Promise<FamilyInviteCreated> {
  return apiRequest<FamilyInviteCreated>(baseUrl, `/families/${familyId}/invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input ?? {}),
  });
}

export async function joinFamilyByCode(
  baseUrl: string,
  bearerToken: string,
  input: { code: string },
): Promise<{ family: FamilyProfile; joinedAt: string }> {
  return apiRequest<{ family: FamilyProfile; joinedAt: string }>(baseUrl, '/families/join', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function updateFamilyMemberRole(
  baseUrl: string,
  bearerToken: string,
  familyId: string,
  memberId: string,
  input: { role: FamilyRole },
): Promise<{ member: { id: string; role: FamilyRole } }> {
  return apiRequest<{ member: { id: string; role: FamilyRole } }>(
    baseUrl,
    `/families/${familyId}/members/${memberId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bearerToken}` },
      body: JSON.stringify(input),
    },
  );
}

export async function removeFamilyMember(
  baseUrl: string,
  bearerToken: string,
  familyId: string,
  memberId: string,
): Promise<{ memberId: string; familyId: string; removed: boolean; removedAt: string }> {
  return apiRequest<{ memberId: string; familyId: string; removed: boolean; removedAt: string }>(
    baseUrl,
    `/families/${familyId}/members/${memberId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
}

export async function createSplit(
  baseUrl: string,
  bearerToken: string,
  input: {
    familyId: string;
    expenseId?: string;
    title?: string;
    currency?: 'MYR' | 'SGD' | 'USD';
    sharedCharge?: number;
    participantFamilyMemberIds?: string[];
    guestParticipants?: string[];
  },
): Promise<SplitDetailResponse> {
  return apiRequest<SplitDetailResponse>(baseUrl, '/splits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function listSplits(
  baseUrl: string,
  bearerToken: string,
  query: {
    familyId: string;
    status?: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
    limit?: number;
  },
): Promise<{ total: number; items: SplitSummary[] }> {
  const params = new URLSearchParams({
    familyId: query.familyId,
  });

  if (query.status) {
    params.set('status', query.status);
  }
  if (typeof query.limit === 'number') {
    params.set('limit', String(query.limit));
  }

  return apiRequest<{ total: number; items: SplitSummary[] }>(
    baseUrl,
    `/splits?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
  );
}

export async function getSplit(
  baseUrl: string,
  bearerToken: string,
  splitId: string,
): Promise<SplitDetailResponse> {
  return apiRequest<SplitDetailResponse>(baseUrl, `/splits/${splitId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

export async function updateSplitParticipants(
  baseUrl: string,
  bearerToken: string,
  splitId: string,
  input: {
    participants: Array<{
      familyMemberId?: string;
      displayName?: string;
      isPayer?: boolean;
      paidAmount?: number;
    }>;
  },
): Promise<SplitDetailResponse> {
  return apiRequest<SplitDetailResponse>(baseUrl, `/splits/${splitId}/participants`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function updateSplitAllocations(
  baseUrl: string,
  bearerToken: string,
  splitId: string,
  input: {
    lineAssignments: Array<{
      expenseLineItemId: string;
      participantIds: string[];
    }>;
    sharedCharge?: number;
  },
): Promise<SplitDetailResponse> {
  return apiRequest<SplitDetailResponse>(baseUrl, `/splits/${splitId}/allocations`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify(input),
  });
}

export async function finalizeSplit(
  baseUrl: string,
  bearerToken: string,
  splitId: string,
): Promise<SplitDetailResponse> {
  return apiRequest<SplitDetailResponse>(baseUrl, `/splits/${splitId}/finalize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
    body: JSON.stringify({}),
  });
}

export async function getSplitBalances(
  baseUrl: string,
  bearerToken: string,
  splitId: string,
): Promise<{
  splitId: string;
  familyId: string;
  currency: string;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  balances: Array<{
    participantId: string;
    displayName: string;
    owedAmount: number;
    paidAmount: number;
    netAmount: number;
  }>;
  settlements: Array<{
    fromParticipantId: string;
    toParticipantId: string;
    amount: number;
  }>;
  generatedAt: string;
}> {
  return apiRequest(baseUrl, `/splits/${splitId}/balances`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}
