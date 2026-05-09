/**
 * Partner price ingestion script
 * Reads scraped JSON → upserts CanonicalItem + PartnerPriceObservation into the DB.
 *
 * Uses Claude AI in batches to normalize messy product names into clean canonical names.
 *
 * Run:
 *   ts-node --project tsconfig.json scripts/scrapers/ingest.ts
 *   ts-node --project tsconfig.json scripts/scrapers/ingest.ts --store lotus
 *   ts-node --project tsconfig.json scripts/scrapers/ingest.ts --store jaya_grocer --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import * as fs from 'fs';
import { PrismaClient, StoreProvider } from '@prisma/client';
import { ScrapedProduct, StoreKey } from './types';

const prisma = new PrismaClient();

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const NORMALIZER_MODEL = process.env.OPENROUTER_NORMALIZER_MODEL || 'anthropic/claude-haiku-4-5';

// ─── Partner store definitions ──────────────────────────────────────────────

const PARTNER_STORES: Record<StoreKey, {
  displayName: string;
  normalizedName: string;
  partnerKey: string;
}> = {
  lotus: {
    displayName: "Lotus's Malaysia",
    normalizedName: "lotus's malaysia",
    partnerKey: 'lotus',
  },
  jaya_grocer: {
    displayName: 'Jaya Grocer',
    normalizedName: 'jaya grocer',
    partnerKey: 'jaya_grocer',
  },
  aeon: {
    displayName: 'AEON',
    normalizedName: 'aeon',
    partnerKey: 'aeon',
  },
  nsk: {
    displayName: 'NSK Trade City',
    normalizedName: 'nsk trade city',
    partnerKey: 'nsk',
  },
};

// ─── AI name normalization ───────────────────────────────────────────────────

interface NormalizeResult {
  canonicalName: string;
  canonicalUnit?: string;
  category?: string;
}

async function normalizeProductNames(
  products: Array<{ name: string; unit?: string; category?: string }>,
): Promise<NormalizeResult[]> {
  const prompt = `You are a grocery product data normalizer for a Malaysian price comparison app.

For each product below, return a JSON array with one object per product containing:
- "canonicalName": clean, lowercase English product name. Strip brand names, origin labels (Malaysia/USA/etc), pack sizes, store codes, and promotional text. Keep the essential product name. Examples:
  "PISANG BERANGAN/CHESTNUT BANANA-KG(2406)" → "chestnut banana"
  "Dole Banana (Philippines) 1pack" → "banana"
  "LACTEL KIDS YOGURT GRAPE 100G" → "kids yogurt grape"
  "FRZ LALA 1KG PACK" → "frozen lala clam"
  "ANCHOR BUTTER SALTED 500G" → "salted butter"
- "canonicalUnit": the unit if applicable (e.g. "kg", "g", "ml", "L", "pcs"). Omit if unclear.
- "category": one of: fresh produce, meat & poultry, seafood, dairy & eggs, beverages, grocery, snacks, household, health & beauty, bakery, frozen, baby. Pick the best fit.

Products to normalize:
${products.map((p, i) => `${i + 1}. name="${p.name}"${p.unit ? ` unit="${p.unit}"` : ''}${p.category ? ` category="${p.category}"` : ''}`).join('\n')}

Respond ONLY with a valid JSON array. No explanation.`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: NORMALIZER_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return products.map(() => ({ canonicalName: '' }));

  try {
    return JSON.parse(jsonMatch[0]) as NormalizeResult[];
  } catch {
    return products.map(() => ({ canonicalName: '' }));
  }
}

// ─── DB retry helper ─────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries) throw err;
      if (err?.message?.includes('connection') || err?.code === 'P1017') {
        console.warn(`\n  DB connection lost, reconnecting (attempt ${attempt})...`);
        await prisma.$disconnect();
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        await prisma.$connect();
      } else {
        throw err;
      }
    }
  }
  throw new Error('unreachable');
}

// ─── Upsert helpers ──────────────────────────────────────────────────────────

async function upsertStore(storeKey: StoreKey) {
  const meta = PARTNER_STORES[storeKey];
  return prisma.store.upsert({
    where: { provider_providerPlaceId: { provider: StoreProvider.PARTNER, providerPlaceId: meta.partnerKey } },
    create: {
      displayName: meta.displayName,
      normalizedName: meta.normalizedName,
      provider: StoreProvider.PARTNER,
      providerPlaceId: meta.partnerKey,
      isPartner: true,
      partnerKey: meta.partnerKey,
    },
    update: {
      displayName: meta.displayName,
      isPartner: true,
      partnerKey: meta.partnerKey,
    },
  });
}

async function upsertCanonicalItem(normalized: NormalizeResult) {
  const name = normalized.canonicalName.trim().toLowerCase();
  if (!name) return null;

  return prisma.canonicalItem.upsert({
    where: { canonicalName: name },
    create: {
      canonicalName: name,
      canonicalUnit: normalized.canonicalUnit,
      category: normalized.category,
    },
    update: {
      canonicalUnit: normalized.canonicalUnit ?? undefined,
      category: normalized.category ?? undefined,
    },
  });
}

async function upsertAlias(canonicalItemId: string, aliasText: string) {
  const normalized = aliasText.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  try {
    await prisma.itemAlias.upsert({
      where: { aliasText_locale: { aliasText: normalized, locale: 'en-MY' } },
      create: { canonicalItemId, aliasText: normalized, locale: 'en-MY' },
      update: { canonicalItemId },
    });
  } catch { /* ignore duplicate alias conflicts */ }
}

async function upsertPartnerObservation(
  storeId: string,
  canonicalItemId: string,
  product: ScrapedProduct,
) {
  await prisma.partnerPriceObservation.upsert({
    where: { storeId_canonicalItemId: { storeId, canonicalItemId } },
    create: {
      storeId,
      canonicalItemId,
      unitPrice: product.price,
      originalPrice: product.originalPrice ?? null,
      unit: product.unit ?? null,
      category: product.category ?? null,
      sourceUrl: product.productUrl ?? null,
      scrapedAt: new Date(product.scrapedAt),
    },
    update: {
      unitPrice: product.price,
      originalPrice: product.originalPrice ?? null,
      unit: product.unit ?? null,
      category: product.category ?? null,
      sourceUrl: product.productUrl ?? null,
      scrapedAt: new Date(product.scrapedAt),
    },
  });
}

// ─── Main ingestion logic ────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', '..', 'output');

const SOURCE_FILES: Record<StoreKey, string> = {
  lotus: path.join(OUTPUT_DIR, 'lotus-products.json'),
  jaya_grocer: path.join(OUTPUT_DIR, 'jaya-grocer-products.json'),
  aeon: path.join(OUTPUT_DIR, 'aeon-products.json'),
  nsk: path.join(OUTPUT_DIR, 'nsk-products.json'),
};

async function ingestStore(storeKey: StoreKey, dryRun: boolean) {
  const filePath = SOURCE_FILES[storeKey];
  if (!fs.existsSync(filePath)) {
    console.log(`[${storeKey}] No file at ${filePath} — run the scraper first`);
    return;
  }

  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\n[${storeKey}] Loaded ${products.length} products from file`);

  if (dryRun) {
    console.log(`[${storeKey}] DRY RUN — no DB writes`);
  }

  // Upsert store record
  const store = await upsertStore(storeKey);
  console.log(`[${storeKey}] Store: ${store.displayName} (id: ${store.id})`);

  // Process in batches of 20 for AI normalization
  const BATCH = 20;
  let processed = 0;
  let skipped = 0;
  let created = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);

    // AI normalize
    let normalized: NormalizeResult[];
    try {
      normalized = await normalizeProductNames(
        batch.map((p) => ({ name: p.productName, unit: p.unit, category: p.category })),
      );
    } catch (err) {
      console.error(`  Batch ${i / BATCH + 1} AI error: ${(err as Error).message}`);
      skipped += batch.length;
      continue;
    }

    if (!dryRun) {
      for (let j = 0; j < batch.length; j++) {
        const product = batch[j];
        const norm = normalized[j];

        if (!norm?.canonicalName) {
          skipped++;
          continue;
        }

        const canonicalItem = await withRetry(() => upsertCanonicalItem(norm));
        if (!canonicalItem) { skipped++; continue; }

        // Register the raw scraped name as an alias
        await withRetry(() => upsertAlias(canonicalItem.id, product.normalizedName));

        await withRetry(() => upsertPartnerObservation(store.id, canonicalItem.id, product));
        created++;
      }
    }

    processed += batch.length;
    process.stdout.write(`\r  ${processed}/${products.length} processed, ${created} upserted, ${skipped} skipped`);

    // Small delay between AI batches
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n[${storeKey}] Done: ${created} observations upserted, ${skipped} skipped`);
}

async function main() {
  const args = process.argv.slice(2);
  const storeArg = args.find((_, i) => args[i - 1] === '--store');
  const dryRun = args.includes('--dry-run');
  const stores: StoreKey[] = storeArg
    ? [storeArg as StoreKey]
    : (['lotus', 'jaya_grocer'] as StoreKey[]); // only ingest what we have scrapers for

  console.log(`Ingesting: ${stores.join(', ')} | dry-run: ${dryRun}`);

  for (const store of stores) {
    await ingestStore(store, dryRun);
  }

  await prisma.$disconnect();
  console.log('\nIngestion complete.');
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
