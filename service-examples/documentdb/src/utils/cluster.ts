export const CLUSTER_SECRET_NAME = 'ler-example-documentdb/cluster';

export const DATABASES = {
  storefront: 'storefront',
  catalogue: 'catalogue',
  fulfilment: 'fulfilment',
} as const;

export const COLLECTIONS = {
  orders: 'orders',
  invoices: 'invoices',
  products: 'products',
  payments: 'payments',
  shipments: 'shipments',
  stockLevels: 'stockLevels',
  priceHistory: 'priceHistory',
  carrierWebhooks: 'carrierWebhooks',
} as const;

export interface ChangeStreamSource {
  id: string;
  database: string;
  collection?: string;
  fullDocument: 'Default' | 'UpdateLookup';
}

// One event source mapping is one ordered stream with one position, and a change that throws takes
// its whole batch with it. Every collection whose changes are meant to fail needs a mapping of its
// own or the failures behind the first one never arrive.
export const CHANGE_STREAM_SOURCES: ChangeStreamSource[] = [
  { id: 'StorefrontChanges', database: DATABASES.storefront, fullDocument: 'UpdateLookup' },
  {
    id: 'CatalogueChanges',
    database: DATABASES.catalogue,
    collection: COLLECTIONS.products,
    fullDocument: 'Default',
  },
  {
    id: 'PaymentsChanges',
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.payments,
    fullDocument: 'UpdateLookup',
  },
  {
    id: 'ShipmentsChanges',
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.shipments,
    fullDocument: 'UpdateLookup',
  },
  {
    id: 'StockLevelsChanges',
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.stockLevels,
    fullDocument: 'UpdateLookup',
  },
  {
    id: 'PriceHistoryChanges',
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.priceHistory,
    fullDocument: 'UpdateLookup',
  },
  {
    id: 'CarrierWebhooksChanges',
    database: DATABASES.fulfilment,
    collection: COLLECTIONS.carrierWebhooks,
    fullDocument: 'UpdateLookup',
  },
];
