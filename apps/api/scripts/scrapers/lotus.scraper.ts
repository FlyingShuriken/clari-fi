/**
 * Lotus's Malaysia scraper
 * Uses the public GraphQL API at https://mcprod.lotuss.com.my/graphql
 * No auth required — same endpoint the website frontend calls.
 *
 * Run: ts-node scripts/scrapers/lotus.scraper.ts
 */

import { ScrapeResult, ScrapedProduct } from './types';
import { fetchWithRetry, normalizeProductName, sleep } from './utils';

const GQL_URL = 'https://mcprod.lotuss.com.my/graphql';

const GQL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://www.lotuss.com.my',
  'Referer': 'https://www.lotuss.com.my/',
};

// Key grocery category IDs (from categoryList query)
const CATEGORY_IDS: Array<{ id: string; name: string }> = [
  { id: '3189', name: 'Fresh Produce' },
  { id: '5304', name: 'Meat & Poultry' },
  { id: '23946', name: 'Chilled & Frozen' },
  { id: '9405', name: 'Beverages' },
  { id: '2730', name: 'Grocery' },
  { id: '5763', name: 'Health & Beauty' },
  { id: '49146', name: 'Household' },
  { id: '6003', name: 'Baby' },
];

const PRODUCTS_QUERY = `
  query GetProducts($categoryId: String!, $page: Int!) {
    products(
      filter: { category_id: { eq: $categoryId } }
      pageSize: 48
      currentPage: $page
    ) {
      total_count
      items {
        name
        sku
        price_range {
          minimum_price {
            final_price { value currency }
            regular_price { value }
          }
        }
        categories { name }
        image { url }
        thumbnail { url }
      }
    }
  }
`;

interface LotusProduct {
  name: string;
  sku: string;
  price_range: {
    minimum_price: {
      final_price: { value: number; currency: string };
      regular_price: { value: number };
    };
  };
  categories: Array<{ name: string }>;
  image: { url: string } | null;
}

function mapProduct(raw: LotusProduct, categoryName: string): ScrapedProduct {
  const finalPrice = raw.price_range?.minimum_price?.final_price?.value ?? 0;
  const regularPrice = raw.price_range?.minimum_price?.regular_price?.value ?? finalPrice;

  // Extract unit from product name (e.g. "PISANG 1KG", "MILK 1L")
  const unitMatch = raw.name.match(/\d+(?:\.\d+)?\s*(?:G|KG|ML|L|PCS|PACK|PC)\b/i);

  // Primary category is the most specific non-promo one
  const nonPromoCategories = raw.categories
    ?.filter(c => !/(promotion|promo|deal|segar|murah|nomination|total|weekly|cny)/i.test(c.name))
    ?? [];
  const primaryCategory = nonPromoCategories[nonPromoCategories.length - 1]?.name ?? categoryName;

  return {
    productName: raw.name,
    normalizedName: normalizeProductName(raw.name),
    price: finalPrice,
    originalPrice: regularPrice > finalPrice ? regularPrice : undefined,
    currency: 'MYR',
    unit: unitMatch?.[0]?.toLowerCase(),
    category: primaryCategory,
    imageUrl: raw.image?.url,
    productUrl: `https://www.lotuss.com.my/en/product/${raw.sku}`,
    sku: raw.sku,
    inStock: true,
    store: 'lotus',
    scrapedAt: new Date().toISOString(),
  };
}

async function gqlFetch(query: string, variables: Record<string, unknown>) {
  const res = await fetchWithRetry(GQL_URL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const body = await res.json() as { data?: { products?: { total_count: number; items: LotusProduct[] } }; errors?: unknown[] };
  if (body.errors) throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  return body.data?.products;
}

export async function scrapeLotus(maxPages = 10): Promise<ScrapeResult> {
  const start = Date.now();
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];
  const seenSkus = new Set<string>();

  for (const cat of CATEGORY_IDS) {
    console.log(`[Lotus] Scraping: ${cat.name} (id:${cat.id})`);
    let page = 1;

    while (page <= maxPages) {
      try {
        const data = await gqlFetch(PRODUCTS_QUERY, { categoryId: cat.id, page });
        const items = data?.items ?? [];

        if (items.length === 0) break;

        const newItems = items.filter(p => !seenSkus.has(p.sku));
        newItems.forEach(p => seenSkus.add(p.sku));
        products.push(...newItems.map(p => mapProduct(p, cat.name)));

        console.log(`  Page ${page}: ${items.length} raw, ${newItems.length} new (total: ${products.length})`);

        const totalPages = Math.ceil((data?.total_count ?? 0) / 48);
        if (page >= totalPages) break;
        page++;
        await sleep(600);
      } catch (err) {
        const msg = `[Lotus] Error ${cat.name} p${page}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
        break;
      }
    }

    await sleep(1000);
  }

  return { store: 'lotus', products, totalFound: products.length, errors, durationMs: Date.now() - start };
}

if (require.main === module) {
  scrapeLotus()
    .then((result) => {
      const { saveResults } = require('./utils');
      const path = require('path');
      const fs = require('fs');
      const outDir = path.join(__dirname, '..', '..', '..', '..', 'output');
      fs.mkdirSync(outDir, { recursive: true });
      saveResults(result.products, path.join(outDir, 'lotus-products.json'));
      console.log(`Done. ${result.totalFound} products, ${result.errors.length} errors, ${result.durationMs}ms`);
    })
    .catch(console.error);
}
