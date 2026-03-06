export interface StoreItemPrice {
  itemName: string;
  latestUnitPrice: number;
  averageUnitPrice: number;
  averageTrustScore: number;
  sampleSize: number;
}

export interface StoreAggregate {
  storeId: string;
  storeName: string;
  areaText: string;
  distanceKm: number;
  items: StoreItemPrice[];
  totalLatestPrice: number;
  itemCoverage: number;
}
