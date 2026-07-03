export interface StockItem {
  sku: string;
  description: string;
  quantity: number;
  depot: string;
}

export interface StockMovement {
  movementId: string;
  sku: string;
  delta: number;
  reason: string;
}

export const STOCK: Record<string, StockItem> = {
  'brk-9': { sku: 'brk-9', description: 'Steel bracket, 90mm', quantity: 120, depot: 'leeds' },
  'clp-3': { sku: 'clp-3', description: 'Pipe clip, 32mm', quantity: 0, depot: 'hull' },
};

export const MOVEMENTS: Record<string, StockMovement> = {
  'mov-501': { movementId: 'mov-501', sku: 'brk-9', delta: -12, reason: 'Picked for order WH-1042' },
};

export const SUPPLIER_SKUS: Record<string, string[]> = {
  'sup-athertons': ['brk-9', 'clp-3'],
};

// A retired SKU redirects to whatever replaced it. A SKU still under review has no successor yet,
// so it redirects to the review queue instead and the redirect is temporary.
export const SUCCESSOR_SKUS: Record<string, string> = {
  'brk-4': 'brk-9',
};

export const SKUS_UNDER_REVIEW = ['clp-1'];
