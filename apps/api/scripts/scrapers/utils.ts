import { ScrapedProduct } from './types';

export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

export const JSON_HEADERS = {
  ...BROWSER_HEADERS,
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeProductName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function saveResults(products: ScrapedProduct[], outputPath: string): void {
  const fs = require('fs');
  fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
  console.log(`Saved ${products.length} products to ${outputPath}`);
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delayMs = 2000,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers: { ...BROWSER_HEADERS, ...options.headers } });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
        console.warn(`Rate limited. Waiting ${retryAfter}s before retry ${attempt}/${retries}`);
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        console.warn(`Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delayMs}ms...`);
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url} after ${retries} attempts`);
}
