/**
 * Playwright-based scraper for sites that block direct HTTP requests.
 * Handles Lotus's, AEON, and NSK via headless browser.
 *
 * Prerequisites:
 *   pnpm add -D playwright @playwright/browser-chromium
 *   npx playwright install chromium
 *
 * Run: ts-node scripts/scrapers/playwright-scraper.ts --store lotus
 *      ts-node scripts/scrapers/playwright-scraper.ts --store aeon
 *      ts-node scripts/scrapers/playwright-scraper.ts --store nsk
 */

import { ScrapedProduct, StoreKey } from './types';
import { normalizeProductName, parsePrice, sleep } from './utils';

// ---------------------------------------------------------------------------
// Lotus's Malaysia
// Lotus's SPA loads product data via their internal REST API. We intercept it.
// ---------------------------------------------------------------------------
async function scrapeLotusWithPlaywright(maxPages: number): Promise<ScrapedProduct[]> {
  const { chromium } = await import('playwright');
  const products: ScrapedProduct[] = [];

  const CATEGORIES = [
    'fresh-fruits', 'fresh-vegetables', 'fresh-meat', 'fresh-seafood',
    'dairy-eggs', 'beverages', 'rice-noodles-cooking', 'snacks-confectionery',
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-MY',
    extraHTTPHeaders: { 'Accept-Language': 'en-MY,en;q=0.9' },
  });

  // Intercept API responses
  const captured: any[] = [];
  context.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/2.0/page/category') || url.includes('/api/2.0/search')) {
      try {
        const body = await response.json();
        const prods = body.products ?? body.results ?? body.data?.products ?? [];
        captured.push(...prods);
      } catch {}
    }
  });

  const page = await context.newPage();

  for (const cat of CATEGORIES) {
    for (let p = 1; p <= maxPages; p++) {
      try {
        await page.goto(`https://www.lotusonline.com.my/groceries/fresh-food/${cat}?page=${p}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        await sleep(2000);
      } catch (err) {
        console.warn(`[Lotus Playwright] ${cat} p${p}: ${(err as Error).message}`);
        break;
      }
    }
    await sleep(1500);
  }

  await browser.close();

  // Map intercepted products
  return captured.map((raw: any) => ({
    productName: raw.name,
    normalizedName: normalizeProductName(raw.name),
    price: raw.price?.now ?? 0,
    originalPrice: raw.price?.was,
    currency: 'MYR',
    unit: raw.unitPrice?.unit ?? raw.quantity,
    category: raw.categoryName,
    imageUrl: raw.imageUrl,
    productUrl: raw.url ? `https://www.lotusonline.com.my${raw.url}` : undefined,
    sku: raw.id,
    inStock: raw.isAvailable ?? true,
    store: 'lotus' as StoreKey,
    scrapedAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// AEON Online — intercept their Shopify storefront API calls
// ---------------------------------------------------------------------------
async function scrapeAeonWithPlaywright(maxPages: number): Promise<ScrapedProduct[]> {
  const { chromium } = await import('playwright');
  const products: ScrapedProduct[] = [];
  const seenIds = new Set<number>();

  const COLLECTIONS = ['fresh-produce', 'fruits', 'vegetables', 'meat-poultry', 'dairy-eggs', 'beverages', 'snacks'];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  for (const handle of COLLECTIONS) {
    for (let p = 1; p <= maxPages; p++) {
      try {
        const res = await page.goto(
          `https://shop.aeon.com.my/collections/${handle}/products.json?limit=250&page=${p}`,
          { waitUntil: 'load', timeout: 20000 },
        );
        if (!res?.ok()) break;
        const body: any = await res.json();
        const raw: any[] = body.products ?? [];
        if (raw.length === 0) break;

        for (const p of raw) {
          if (seenIds.has(p.id)) continue;
          seenIds.add(p.id);
          const variant = p.variants?.[0];
          products.push({
            productName: p.title,
            normalizedName: normalizeProductName(p.title),
            price: parsePrice(variant?.price) ?? 0,
            originalPrice: parsePrice(variant?.compare_at_price) ?? undefined,
            currency: 'MYR',
            unit: variant?.title?.match(/\d+\s*(?:g|kg|ml|L|pcs|pack)/i)?.[0]?.toLowerCase(),
            category: p.product_type || handle,
            imageUrl: p.images?.[0]?.src,
            productUrl: `https://shop.aeon.com.my/products/${p.handle}`,
            sku: variant?.sku || String(p.id),
            inStock: variant?.available ?? true,
            store: 'aeon' as StoreKey,
            scrapedAt: new Date().toISOString(),
          });
        }
        await sleep(500);
      } catch (err) {
        console.warn(`[AEON Playwright] ${handle} p${p}: ${(err as Error).message}`);
        break;
      }
    }
    await sleep(1200);
  }

  await browser.close();
  return products;
}

// ---------------------------------------------------------------------------
// NSK Trade City — WooCommerce HTML scraping via Playwright
// ---------------------------------------------------------------------------
async function scrapeNskWithPlaywright(maxPages: number): Promise<ScrapedProduct[]> {
  const { chromium } = await import('playwright');
  const products: ScrapedProduct[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // First try the WooCommerce REST API through Playwright (bypasses IP blocks)
  try {
    const catRes = await page.goto('https://www.nsktrade.com.my/wp-json/wc/v3/products/categories?per_page=100&hide_empty=true', {
      waitUntil: 'load', timeout: 20000,
    });
    if (catRes?.ok()) {
      const cats: any[] = await catRes.json();
      console.log(`[NSK Playwright] Found ${cats.length} categories`);

      for (const cat of cats) {
        for (let p = 1; p <= maxPages; p++) {
          const prodRes = await page.goto(
            `https://www.nsktrade.com.my/wp-json/wc/v3/products?category=${cat.id}&per_page=100&page=${p}`,
            { waitUntil: 'load', timeout: 20000 },
          );
          if (!prodRes?.ok()) break;
          const raw: any[] = await prodRes.json();
          if (raw.length === 0) break;

          for (const r of raw) {
            const price = parsePrice(r.sale_price || r.price) ?? 0;
            const originalPrice = parsePrice(r.regular_price) ?? undefined;
            products.push({
              productName: r.name,
              normalizedName: normalizeProductName(r.name),
              price,
              originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
              currency: 'MYR',
              unit: r.weight ? `${r.weight}kg` : undefined,
              category: r.categories?.[0]?.name ?? cat.name,
              imageUrl: r.images?.[0]?.src,
              productUrl: r.permalink,
              sku: r.sku || String(r.id),
              inStock: r.stock_status !== 'outofstock',
              store: 'nsk' as StoreKey,
              scrapedAt: new Date().toISOString(),
            });
          }
          await sleep(600);
        }
        await sleep(1000);
      }
    }
  } catch (err) {
    // Fall back to HTML scraping of the shop page
    console.warn(`[NSK Playwright] API failed: ${(err as Error).message}. Falling back to HTML scrape.`);
    await scrapeNskHtml(page, maxPages, products);
  }

  await browser.close();
  return products;
}

async function scrapeNskHtml(page: any, maxPages: number, products: ScrapedProduct[]): Promise<void> {
  for (let p = 1; p <= maxPages; p++) {
    try {
      await page.goto(`https://www.nsktrade.com.my/shop/page/${p}/`, {
        waitUntil: 'networkidle', timeout: 30000,
      });
      await sleep(2000);

      // WooCommerce HTML selectors
      const items = await page.$$eval('li.product', (els: Element[]) =>
        els.map((el) => ({
          name: el.querySelector('.woocommerce-loop-product__title')?.textContent?.trim() ?? '',
          price: el.querySelector('.price .woocommerce-Price-amount')?.textContent?.trim() ?? '',
          image: (el.querySelector('img') as HTMLImageElement)?.src ?? '',
          url: (el.querySelector('a.woocommerce-loop-product__link') as HTMLAnchorElement)?.href ?? '',
        })),
      );

      if (items.length === 0) break;

      for (const item of items) {
        const price = parsePrice(item.price) ?? 0;
        products.push({
          productName: item.name,
          normalizedName: normalizeProductName(item.name),
          price,
          currency: 'MYR',
          imageUrl: item.image,
          productUrl: item.url,
          inStock: true,
          store: 'nsk' as StoreKey,
          scrapedAt: new Date().toISOString(),
        });
      }
      console.log(`[NSK HTML] Page ${p}: ${items.length} products (total: ${products.length})`);
      await sleep(2000);
    } catch (err) {
      console.warn(`[NSK HTML] Page ${p}: ${(err as Error).message}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const storeIdx = args.indexOf('--store');
  const store = storeIdx >= 0 ? args[storeIdx + 1] : 'all';
  const maxPagesIdx = args.indexOf('--max-pages');
  const maxPages = maxPagesIdx >= 0 ? parseInt(args[maxPagesIdx + 1], 10) : 5;

  const { saveResults } = await import('./utils');
  const fs = await import('fs');
  fs.mkdirSync('output', { recursive: true });

  const scrapers: Record<string, (maxPages: number) => Promise<ScrapedProduct[]>> = {
    lotus: scrapeLotusWithPlaywright,
    aeon: scrapeAeonWithPlaywright,
    nsk: scrapeNskWithPlaywright,
  };

  if (store === 'all') {
    for (const [name, scraper] of Object.entries(scrapers)) {
      console.log(`\nScraping ${name} with Playwright...`);
      const products = await scraper(maxPages);
      saveResults(products, `output/${name}-playwright-products.json`);
    }
  } else if (scrapers[store]) {
    console.log(`Scraping ${store} with Playwright...`);
    const products = await scrapers[store](maxPages);
    saveResults(products, `output/${store}-playwright-products.json`);
  } else {
    console.error(`Unknown store: ${store}. Options: ${Object.keys(scrapers).join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
