export interface ScrapedProduct {
  productName: string;
  normalizedName: string;
  price: number;
  originalPrice?: number;        // before promo
  currency: 'MYR';
  unit?: string;                 // e.g. "1kg", "500ml", "each"
  category?: string;
  subCategory?: string;
  imageUrl?: string;
  productUrl?: string;
  sku?: string;
  inStock: boolean;
  store: StoreKey;
  scrapedAt: string;             // ISO timestamp
}

export type StoreKey = 'lotus' | 'aeon' | 'nsk' | 'jaya_grocer';

export interface ScrapeResult {
  store: StoreKey;
  products: ScrapedProduct[];
  totalFound: number;
  errors: string[];
  durationMs: number;
}

export const STORE_META: Record<StoreKey, { displayName: string; baseUrl: string }> = {
  lotus: { displayName: "Lotus's Malaysia", baseUrl: 'https://www.lotusonline.com.my' },
  aeon: { displayName: 'AEON Online', baseUrl: 'https://shop.aeon.com.my' },
  nsk: { displayName: 'NSK Trade City', baseUrl: 'https://www.nsktrade.com.my' },
  jaya_grocer: { displayName: 'Jaya Grocer', baseUrl: 'https://www.jayagrocer.com' },
};
