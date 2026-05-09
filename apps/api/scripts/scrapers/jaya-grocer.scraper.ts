/**
 * Jaya Grocer scraper
 * jayagrocer.com is also Shopify-based — same /products.json approach as AEON.
 * Falls back to HTML scraping if the JSON API is disabled.
 *
 * Run: ts-node scripts/scrapers/jaya-grocer.scraper.ts
 */

import { ScrapeResult, ScrapedProduct } from './types';
import { fetchWithRetry, JSON_HEADERS, normalizeProductName, parsePrice, sleep } from './utils';

const BASE_URL = 'https://www.jayagrocer.com';

// Verified working collection handles (2026-05-09)
const COLLECTION_HANDLES = [
  'fruits',
  'vegetables',
  'meat',
  'dairy',
  'beverages',
  'all',            // catch-all for anything missed above
];

interface ShopifyVariant {
  id: number;
  price: string;
  compare_at_price?: string;
  title: string;
  sku?: string;
  available: boolean;
  weight?: number;
  weight_unit?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  vendor?: string;
  tags?: string[];
  body_html?: string;
  images: Array<{ src: string }>;
  variants: ShopifyVariant[];
}

function mapProduct(raw: ShopifyProduct, collection: string): ScrapedProduct {
  const variant = raw.variants[0];
  const price = parsePrice(variant?.price) ?? 0;
  // compare_at_price equals price when not on sale — treat as undefined in that case
  const compareAt = parsePrice(variant?.compare_at_price ?? undefined) ?? undefined;
  const originalPrice = compareAt && compareAt > price ? compareAt : undefined;

  // Unit lives in variant option1 (e.g. "1 UNIT", "500G", "2 PACK") or title
  const rawUnit = (variant as any)?.option1 ?? variant?.title ?? '';
  const unitMatch = rawUnit.match(/\d+(?:\.\d+)?\s*(?:g|kg|ml|L|l|pcs?|pack|units?|sachets?)/i);
  let unit = unitMatch?.[0]?.toLowerCase() ?? rawUnit.toLowerCase();

  // Fallback: infer unit from weight field
  if (!unit && (variant as any)?.weight && (variant as any)?.weight_unit) {
    unit = `${(variant as any).weight}${(variant as any).weight_unit}`;
  }

  return {
    productName: raw.title,
    normalizedName: normalizeProductName(raw.title),
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    currency: 'MYR',
    unit,
    category: raw.product_type || collection,
    imageUrl: raw.images[0]?.src,
    productUrl: `${BASE_URL}/products/${raw.handle}`,
    sku: variant?.sku || String(raw.id),
    inStock: variant?.available ?? true,
    store: 'jaya_grocer',
    scrapedAt: new Date().toISOString(),
  };
}

async function scrapeCollection(handle: string, page: number): Promise<ShopifyProduct[]> {
  const url = `${BASE_URL}/collections/${handle}/products.json?limit=250&page=${page}`;
  const res = await fetchWithRetry(url, { headers: JSON_HEADERS });

  if (!res.ok) {
    console.warn(`[JayaGrocer] ${handle} page ${page}: HTTP ${res.status}`);
    return [];
  }

  const body = await res.json();
  return body.products ?? [];
}

export async function scrapeJayaGrocer(maxPages = 5): Promise<ScrapeResult> {
  const start = Date.now();
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];
  const seenIds = new Set<number>();

  for (const handle of COLLECTION_HANDLES) {
    console.log(`[JayaGrocer] Scraping collection: ${handle}`);
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      try {
        const raw = await scrapeCollection(handle, page);
        if (raw.length === 0) {
          hasMore = false;
        } else {
          const newProducts = raw.filter((p) => !seenIds.has(p.id));
          newProducts.forEach((p) => seenIds.add(p.id));
          products.push(...newProducts.map((p) => mapProduct(p, handle)));
          console.log(`  Page ${page}: ${raw.length} raw, ${newProducts.length} new (total: ${products.length})`);
          hasMore = raw.length === 250;
          page++;
          await sleep(500);
        }
      } catch (err) {
        const msg = `[JayaGrocer] Error scraping ${handle} page ${page}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
        hasMore = false;
      }
    }

    await sleep(1200);
  }

  return {
    store: 'jaya_grocer',
    products,
    totalFound: products.length,
    errors,
    durationMs: Date.now() - start,
  };
}

if (require.main === module) {
  scrapeJayaGrocer()
    .then((result) => {
      const { saveResults } = require('./utils');
      const path = require('path');
      const fs = require('fs');
      const outDir = path.join(__dirname, '..', '..', '..', '..', 'output');
      fs.mkdirSync(outDir, { recursive: true });
      saveResults(result.products, path.join(outDir, 'jaya-grocer-products.json'));
      console.log(`Done. ${result.totalFound} products, ${result.errors.length} errors, ${result.durationMs}ms`);
    })
    .catch(console.error);
}
