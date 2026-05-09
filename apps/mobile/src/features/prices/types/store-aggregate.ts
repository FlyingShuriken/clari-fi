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
  storeLat?: number;
  storeLng?: number;
  distanceKm: number;
  items: StoreItemPrice[];
  totalLatestPrice: number;
  itemCoverage: number;
}
