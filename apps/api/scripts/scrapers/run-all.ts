/**
 * Run all grocery scrapers and produce combined output.
 *
 * Usage:
 *   ts-node scripts/scrapers/run-all.ts                  # all stores
 *   ts-node scripts/scrapers/run-all.ts --stores lotus,aeon
 *   ts-node scripts/scrapers/run-all.ts --stores nsk --max-pages 3
 *
 * Output: output/grocery-prices-<date>.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { ScrapeResult, StoreKey } from './types';
import { scrapeLotus } from './lotus.scraper';
import { scrapeAeon } from './aeon.scraper';
import { scrapeJayaGrocer } from './jaya-grocer.scraper';
import { scrapeNsk } from './nsk.scraper';

const SCRAPERS: Record<StoreKey, (maxPages?: number) => Promise<ScrapeResult>> = {
  lotus: scrapeLotus,
  aeon: scrapeAeon,
  jaya_grocer: scrapeJayaGrocer,
  nsk: scrapeNsk,
};

function parseArgs(): { stores: StoreKey[]; maxPages: number } {
  const args = process.argv.slice(2);
  let stores: StoreKey[] = ['lotus', 'aeon', 'jaya_grocer', 'nsk'];
  let maxPages = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stores' && args[i + 1]) {
      stores = args[i + 1].split(',') as StoreKey[];
      i++;
    }
    if (args[i] === '--max-pages' && args[i + 1]) {
      maxPages = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { stores, maxPages };
}

async function main() {
  const { stores, maxPages } = parseArgs();
  const outputDir = path.join(__dirname, '..', '..', '..', '..', 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];
  const results: ScrapeResult[] = [];

  console.log(`Starting scrape: ${stores.join(', ')} | max pages: ${maxPages}\n`);

  for (const store of stores) {
    const scraper = SCRAPERS[store];
    if (!scraper) {
      console.warn(`Unknown store: ${store}`);
      continue;
    }

    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Scraping: ${store.toUpperCase()}`);
      console.log('='.repeat(50));
      const result = await scraper(maxPages);
      results.push(result);

      // Save per-store file
      const storeFile = path.join(outputDir, `${store}-products-${dateStr}.json`);
      fs.writeFileSync(storeFile, JSON.stringify(result.products, null, 2));
      console.log(`\n[${store}] Saved ${result.totalFound} products → ${path.basename(storeFile)}`);
      if (result.errors.length > 0) {
        console.warn(`[${store}] ${result.errors.length} errors:`);
        result.errors.forEach((e) => console.warn(`  ${e}`));
      }
    } catch (err) {
      console.error(`[${store}] Fatal error: ${(err as Error).message}`);
    }
  }

  // Combined output
  const allProducts = results.flatMap((r) => r.products);
  const combinedFile = path.join(outputDir, `grocery-prices-${dateStr}.json`);
  fs.writeFileSync(
    combinedFile,
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        stores: results.map((r) => ({
          store: r.store,
          totalFound: r.totalFound,
          errors: r.errors.length,
          durationMs: r.durationMs,
        })),
        products: allProducts,
      },
      null,
      2,
    ),
  );

  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log('='.repeat(50));
  results.forEach((r) => {
    console.log(`  ${r.store.padEnd(12)} ${String(r.totalFound).padStart(5)} products  ${r.errors.length} errors  ${r.durationMs}ms`);
  });
  console.log(`\nTotal: ${allProducts.length} products`);
  console.log(`Combined output: ${combinedFile}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
