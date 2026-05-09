/**
 * NSK Trade City scraper
 * nsktrade.com.my — custom PHP/WooCommerce-style site.
 * Tries WooCommerce REST API first, then falls back to HTML parsing.
 * Note: WooCommerce public API requires no auth for product listings.
 *
 * Run: ts-node scripts/scrapers/nsk.scraper.ts
 */

import { ScrapeResult, ScrapedProduct } from './types';
import { fetchWithRetry, BROWSER_HEADERS, JSON_HEADERS, normalizeProductName, parsePrice, sleep } from './utils';

const BASE_URL = 'https://www.nsktrade.com.my';

// WooCommerce REST API v3 — public read endpoint (no auth for product listing)
const WC_API_BASE = `${BASE_URL}/wp-json/wc/v3`;

// WooCommerce category IDs to scrape (discovered by calling /wp-json/wc/v3/products/categories)
// These are guesses — the bootstrap() step will discover actual IDs
const CATEGORY_SLUGS = [
  'fresh-produce',
  'fresh-fruits',
  'fresh-vegetables',
  'meat-poultry',
  'seafood',
  'dairy-eggs',
  'beverages',
  'rice-noodles',
  'snacks',
  'household',
  'personal-care',
];

interface WooCategory {
  id: number;
  name: string;
  slug: string;
}

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  sku?: string;
  stock_status?: 'instock' | 'outofstock';
  categories?: WooCategory[];
  images?: Array<{ src: string }>;
  attributes?: Array<{ name: string; options: string[] }>;
  weight?: string;
}

function extractUnit(product: WooProduct): string | undefined {
  // Check attributes like "Weight", "Volume", "Unit"
  const weightAttr = product.attributes?.find((a) =>
    /weight|volume|size|unit/i.test(a.name),
  );
  if (weightAttr?.options?.[0]) return weightAttr.options[0].toLowerCase();

  // Check weight field
  if (product.weight) return `${product.weight}kg`;

  // Try to extract from name
  const match = product.name.match(/\d+(?:\.\d+)?\s*(?:g|kg|ml|L|l|pcs|pack)/i);
  return match?.[0]?.toLowerCase();
}

function mapProduct(raw: WooProduct): ScrapedProduct {
  const price = parsePrice(raw.sale_price || raw.price) ?? 0;
  const originalPrice = parsePrice(raw.regular_price) ?? undefined;
  const category = raw.categories?.[0]?.name;

  return {
    productName: raw.name,
    normalizedName: normalizeProductName(raw.name),
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    currency: 'MYR',
    unit: extractUnit(raw),
    category,
    imageUrl: raw.images?.[0]?.src,
    productUrl: raw.permalink,
    sku: raw.sku || String(raw.id),
    inStock: raw.stock_status !== 'outofstock',
    store: 'nsk',
    scrapedAt: new Date().toISOString(),
  };
}

async function discoverCategories(): Promise<WooCategory[]> {
  try {
    const url = `${WC_API_BASE}/products/categories?per_page=100&hide_empty=true`;
    const res = await fetchWithRetry(url, { headers: JSON_HEADERS });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function scrapeByCategory(categoryId: number, page: number): Promise<WooProduct[]> {
  const url = `${WC_API_BASE}/products?category=${categoryId}&per_page=100&page=${page}&status=publish`;
  const res = await fetchWithRetry(url, { headers: JSON_HEADERS });

  if (!res.ok) {
    console.warn(`[NSK] Category ${categoryId} page ${page}: HTTP ${res.status}`);
    return [];
  }

  return await res.json();
}

async function scrapeBySlug(slug: string, page: number): Promise<WooProduct[]> {
  const url = `${WC_API_BASE}/products?category=${slug}&per_page=100&page=${page}&status=publish`;
  const res = await fetchWithRetry(url, { headers: JSON_HEADERS });
  if (!res.ok) return [];
  return await res.json();
}

async function scrapeAllProducts(page: number): Promise<WooProduct[]> {
  // Fallback: scrape all products without category filter
  const url = `${WC_API_BASE}/products?per_page=100&page=${page}&status=publish&orderby=date&order=desc`;
  const res = await fetchWithRetry(url, { headers: JSON_HEADERS });
  if (!res.ok) {
    console.warn(`[NSK] All products page ${page}: HTTP ${res.status}`);
    return [];
  }
  return await res.json();
}

export async function scrapeNsk(maxPages = 10): Promise<ScrapeResult> {
  const start = Date.now();
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];
  const seenIds = new Set<number>();

  console.log('[NSK] Discovering categories via WooCommerce API...');
  const categories = await discoverCategories();

  if (categories.length > 0) {
    console.log(`[NSK] Found ${categories.length} categories`);
    for (const cat of categories) {
      console.log(`[NSK] Scraping category: ${cat.name} (id:${cat.id})`);
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= maxPages) {
        try {
          const raw = await scrapeByCategory(cat.id, page);
          if (raw.length === 0) {
            hasMore = false;
          } else {
            const newProducts = raw.filter((p) => !seenIds.has(p.id));
            newProducts.forEach((p) => seenIds.add(p.id));
            products.push(...newProducts.map(mapProduct));
            console.log(`  Page ${page}: ${raw.length} raw, ${newProducts.length} new (total: ${products.length})`);
            hasMore = raw.length === 100;
            page++;
            await sleep(600);
          }
        } catch (err) {
          const msg = `[NSK] Error category ${cat.id} page ${page}: ${(err as Error).message}`;
          console.error(msg);
          errors.push(msg);
          hasMore = false;
        }
      }
      await sleep(1000);
    }
  } else {
    // WooCommerce API not available or blocked — fall back to paginated all-products
    console.log('[NSK] Category discovery failed. Falling back to all-products scrape...');
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      try {
        const raw = await scrapeAllProducts(page);
        if (raw.length === 0) {
          hasMore = false;
        } else {
          const newProducts = raw.filter((p) => !seenIds.has(p.id));
          newProducts.forEach((p) => seenIds.add(p.id));
          products.push(...newProducts.map(mapProduct));
          console.log(`Page ${page}: ${raw.length} raw, ${newProducts.length} new (total: ${products.length})`);
          hasMore = raw.length === 100;
          page++;
          await sleep(800);
        }
      } catch (err) {
        const msg = `[NSK] Fallback page ${page}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
        hasMore = false;
      }
    }
  }

  return {
    store: 'nsk',
    products,
    totalFound: products.length,
    errors,
    durationMs: Date.now() - start,
  };
}

if (require.main === module) {
  scrapeNsk()
    .then((result) => {
      const { saveResults } = require('./utils');
      const path = require('path');
      const fs = require('fs');
      const outDir = path.join(__dirname, '..', '..', '..', '..', 'output');
      fs.mkdirSync(outDir, { recursive: true });
      saveResults(result.products, path.join(outDir, 'nsk-products.json'));
      console.log(`Done. ${result.totalFound} products, ${result.errors.length} errors, ${result.durationMs}ms`);
    })
    .catch(console.error);
}
