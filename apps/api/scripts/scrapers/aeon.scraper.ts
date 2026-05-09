/**
 * AEON myaeon2go.com scraper
 *
 * AEON is protected by DataDome (TLS-fingerprint-level bot detection).
 * Strategy: one headed browser context for the entire session.
 *   1. Open the browser visibly → user sees the page / any CAPTCHA
 *   2. Wait until the category page actually loads (HTTP 200 in flight)
 *   3. Scrape all categories in the same context (DataDome cookie stays valid)
 *   4. Intercept the JSON API calls the SPA makes for product listings
 *
 * Run: ts-node scripts/scrapers/aeon.scraper.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapeResult, ScrapedProduct } from './types';
import { normalizeProductName, parsePrice, sleep } from './utils';

chromium.use(StealthPlugin());

const CATEGORIES = [
  { id: '1208101', slug: 'fresh_foods',             name: 'Fresh Foods' },
  { id: '545234',  slug: 'aeon_fresh',              name: 'AEON Fresh' },
  { id: '8124135', slug: 'chill_%26_frozen',        name: 'Chill & Frozen' },
  { id: '4995043', slug: 'beverage',                name: 'Beverages' },
  { id: '6683309', slug: 'carbonated_%26_packed_drink', name: 'Carbonated & Packed Drinks' },
  { id: '6528959', slug: 'grocery',                 name: 'Grocery' },
  { id: '754391',  slug: 'dry_%26_canned_food',     name: 'Dry & Canned Food' },
  { id: '9567504', slug: 'noodles_%26_pasta',       name: 'Noodles & Pasta' },
  { id: '5420599', slug: 'rice_and_grains',         name: 'Rice & Grains' },
  { id: '6758871', slug: 'snacks',                  name: 'Snacks' },
  { id: '9759566', slug: 'sauce_%26_paste',         name: 'Sauce & Paste' },
  { id: '303964',  slug: 'bakery',                  name: 'Bakery' },
  { id: '8630656', slug: 'ready_to_eat',            name: 'Ready to Eat' },
];

interface AeonProduct {
  id: number;
  name: string;
  slug?: string;
  price?: number | string;
  original_price?: number | string;
  selling_price?: number | string;
  regular_price?: number | string;
  unit?: string;
  uom?: string;
  category?: string;
  category_name?: string;
  image_url?: string;
  images?: Array<{ url: string }>;
  in_stock?: boolean;
  available?: boolean;
  [key: string]: unknown;
}

function extractPrice(raw: AeonProduct): { price: number; originalPrice?: number } {
  const candidates = [raw.selling_price, raw.price, raw.regular_price];
  const price = candidates.map(v => parsePrice(v as string | number)).find(v => v !== null) ?? 0;
  const orig = parsePrice((raw.original_price ?? raw.regular_price) as string | number) ?? undefined;
  return { price, originalPrice: orig && orig > price ? orig : undefined };
}

function mapProduct(raw: AeonProduct, categoryName: string): ScrapedProduct {
  const { price, originalPrice } = extractPrice(raw);
  const unit = ((raw.uom ?? raw.unit) as string | undefined)?.toLowerCase();
  const image = raw.image_url ?? (raw.images as Array<{ url: string }>)?.[0]?.url;
  const cat = (raw.category_name ?? raw.category ?? categoryName) as string;

  return {
    productName: raw.name,
    normalizedName: normalizeProductName(raw.name),
    price,
    originalPrice,
    currency: 'MYR',
    unit,
    category: cat,
    imageUrl: image,
    productUrl: raw.slug
      ? `https://myaeon2go.com/product/${raw.id}/${raw.slug}`
      : `https://myaeon2go.com/product/${raw.id}`,
    sku: String(raw.id),
    inStock: (raw.in_stock ?? raw.available) !== false,
    store: 'aeon',
    scrapedAt: new Date().toISOString(),
  };
}

/** Returns true if the response looks like a real product API response */
function isProductApiResponse(url: string, ct: string): boolean {
  if (!ct.includes('json')) return false;
  if (url.includes('datadome') || url.includes('captcha') || url.includes('analytics')) return false;
  return (
    url.includes('/api/') ||
    url.includes('product') ||
    url.includes('catalog') ||
    url.includes('item') ||
    url.includes('listing')
  );
}

async function scrapeCategoryPage(
  context: import('playwright').BrowserContext,
  cat: typeof CATEGORIES[0],
  pageNum: number,
): Promise<{ products: AeonProduct[]; apiFound: boolean }> {
  const url = `https://myaeon2go.com/products/category/${cat.id}/${cat.slug}?page=${pageNum}`;
  const captured: AeonProduct[] = [];
  let apiFound = false;

  const page = await context.newPage();

  page.on('response', async (response) => {
    if (!isProductApiResponse(response.url(), response.headers()['content-type'] ?? '')) return;
    try {
      const body = await response.json();
      const items: AeonProduct[] =
        body?.data?.products ?? body?.data ?? body?.products ?? body?.items ??
        (Array.isArray(body) ? body : []);
      if (items.length > 0) {
        captured.push(...items);
        apiFound = true;
        console.log(`    API hit: ${response.url().slice(0, 80)} → ${items.length} items`);
      }
    } catch {}
  });

  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (res?.status() === 403) {
      console.warn(`    [blocked] ${url}`);
      await page.close();
      return { products: [], apiFound: false };
    }

    // Give SPA time to fire its data fetches
    await sleep(3000);

    if (!apiFound) {
      // Scroll down to trigger lazy-loaded product cards
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await sleep(1500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
    }

    // Fallback: scrape product cards from HTML if API wasn't intercepted
    if (!apiFound) {
      const htmlProducts = await page.$$eval(
        '[data-product-id], [class*="product-card"], [class*="ProductCard"], [class*="product_card"]',
        (els) => els.map((el: Element) => {
          const nameEl = el.querySelector('[class*="name"], [class*="title"], h3, h4, p');
          const priceEl = el.querySelector('[class*="price"], [class*="Price"]');
          const imgEl = el.querySelector('img');
          const linkEl = el.closest('a') ?? el.querySelector('a');
          const idMatch = (linkEl as HTMLAnchorElement | null)?.href?.match(/\/product\/(\d+)\//);
          return {
            id: parseInt(idMatch?.[1] ?? '0', 10),
            name: nameEl?.textContent?.trim() ?? '',
            price: parseFloat(priceEl?.textContent?.replace(/[^0-9.]/g, '') ?? '0'),
            image_url: (imgEl as HTMLImageElement | null)?.src,
            slug: (linkEl as HTMLAnchorElement | null)?.href?.split('/product/')?.[1],
          } as AeonProduct;
        }).filter(p => p.name && p.id > 0),
      ).catch(() => [] as AeonProduct[]);

      if (htmlProducts.length > 0) {
        captured.push(...htmlProducts);
        console.log(`    HTML fallback: ${htmlProducts.length} items`);
      }
    }
  } catch (err) {
    console.warn(`    Error: ${(err as Error).message}`);
  }

  await page.close();
  return { products: captured, apiFound };
}

export async function scrapeAeon(maxPages = 10): Promise<ScrapeResult> {
  const start = Date.now();
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];

  console.log('\n[AEON] Launching headed browser (DataDome requires real Chrome fingerprint)...');

  const browser = await chromium.launch({
    headless: false,   // must stay headed — DataDome binds session to TLS fingerprint
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-MY',
    viewport: { width: 1440, height: 900 },
  });

  // ── Step 1: warm up session ─────────────────────────────────────────────
  console.log('[AEON] Warming up session — loading first category page...');
  const warmPage = await context.newPage();
  let sessionOk = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await warmPage.goto(
      `https://myaeon2go.com/products/category/1208101/fresh_foods`,
      { waitUntil: 'domcontentloaded', timeout: 30000 },
    ).catch(() => null);

    const status = res?.status() ?? 0;
    if (status === 200) {
      sessionOk = true;
      console.log('[AEON] Session established (HTTP 200). Starting scrape...');
      break;
    }

    console.log(`[AEON] Got HTTP ${status}. DataDome active — waiting 10s for challenge to clear...`);
    await sleep(10000);
  }

  await warmPage.close();

  if (!sessionOk) {
    await browser.close();
    throw new Error('[AEON] Could not pass DataDome after 3 attempts. Try running with a VPN or residential proxy.');
  }

  // ── Step 2: scrape all categories in the same context ──────────────────
  const seenIds = new Set<number>();

  for (const cat of CATEGORIES) {
    console.log(`\n[AEON] Scraping: ${cat.name}`);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const { products: pageProducts, apiFound } = await scrapeCategoryPage(context, cat, pageNum);

        if (pageProducts.length === 0) {
          console.log(`  Page ${pageNum}: empty — moving to next category`);
          break;
        }

        const newItems = pageProducts.filter(p => !seenIds.has(p.id));
        newItems.forEach(p => seenIds.add(p.id));
        products.push(...newItems.map(p => mapProduct(p, cat.name)));

        console.log(`  Page ${pageNum}: ${pageProducts.length} raw, ${newItems.length} new (total: ${products.length}) [${apiFound ? 'API' : 'HTML'}]`);

        if (!apiFound && pageProducts.length < 10) break; // likely last page
        await sleep(1000);
      } catch (err) {
        const msg = `[AEON] ${cat.name} p${pageNum}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
        break;
      }
    }

    await sleep(1500);
  }

  await browser.close();

  return { store: 'aeon', products, totalFound: products.length, errors, durationMs: Date.now() - start };
}

if (require.main === module) {
  scrapeAeon()
    .then((result) => {
      const outDir = path.join(__dirname, '..', '..', '..', '..', 'output');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'aeon-products.json');
      fs.writeFileSync(outFile, JSON.stringify(result.products, null, 2));
      console.log(`\nSaved ${result.totalFound} products → ${outFile}`);
      console.log(`Errors: ${result.errors.length} | Duration: ${result.durationMs}ms`);
    })
    .catch(console.error);
}
