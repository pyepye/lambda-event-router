export interface WarehouseOrder {
  orderId: string;
  reference: string;
  customer: string;
  status: 'pending' | 'packed' | 'dispatched';
  total: number;
}

export interface OrderLine {
  itemId: string;
  sku: string;
  quantity: number;
}

export interface StockRecord {
  sku: string;
  description: string;
  quantity: number;
}

export const ORDERS: Record<string, WarehouseOrder> = {
  'ord-1042': {
    orderId: 'ord-1042',
    reference: 'WH-1042',
    customer: 'Northfield Supplies',
    status: 'packed',
    total: 148.5,
  },
  'ord-1043': {
    orderId: 'ord-1043',
    reference: 'WH-1043',
    customer: 'Calder Joinery',
    status: 'pending',
    total: 76.2,
  },
};

export const ORDER_LINES: Record<string, OrderLine> = {
  'line-1': { itemId: 'line-1', sku: 'brk-9', quantity: 4 },
  'line-2': { itemId: 'line-2', sku: 'clp-3', quantity: 12 },
};

export const CONSIGNMENTS: Record<string, { consignmentId: string; carrier: string; weightKg: number }> = {
  'con-5501': { consignmentId: 'con-5501', carrier: 'palletline', weightKg: 320 },
};

export const STOCK: Record<string, StockRecord> = {
  'brk-9': { sku: 'brk-9', description: 'Shelf bracket, 300mm', quantity: 120 },
  'clp-3': { sku: 'clp-3', description: 'Cable clip, 8mm', quantity: 0 },
};

export function pendingOrders(): WarehouseOrder[] {
  return Object.values(ORDERS).filter((order) => order.status === 'pending');
}
