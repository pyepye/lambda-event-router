export interface ReturnRecord {
  returnId: string;
  orderId: string;
  carrier: string;
  units: number;
  state: 'open' | 'settled';
}

export interface ReturnLine {
  lineId: string;
  returnId: string;
  sku: string;
  units: number;
}

export const RETURNS: Record<string, ReturnRecord> = {
  'ret-8801': { returnId: 'ret-8801', orderId: 'ord-1042', carrier: 'dpd', units: 3, state: 'open' },
  'ret-8802': { returnId: 'ret-8802', orderId: 'ord-1043', carrier: 'evri', units: 0, state: 'settled' },
};

export const RETURN_LINES: Record<string, ReturnLine> = {
  'line-1': { lineId: 'line-1', returnId: 'ret-8801', sku: 'brk-9', units: 2 },
};

export const CARRIER_RETURNS: Record<string, string[]> = {
  'car-dpd': ['ret-8801'],
};

// A return merged into another one moves for good, so it points at its successor. One still under
// review has no successor yet and points at the open list instead.
export const MERGED_RETURNS: Record<string, string> = {
  'ret-8790': 'ret-8801',
};

export const RETURNS_UNDER_REVIEW = ['ret-8791'];

// The desk writes off more returns than it holds, so every count taken against this is negative.
export const WRITE_OFFS = 4;

// A one pixel PNG stands in for the carrier label a desk would print. It holds bytes utf-8 cannot
// carry, so a response that reached the caller intact proves the bytes were never read as text.
export const RETURN_LABEL_PNG: Record<string, Buffer> = {
  'ret-8801': Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
    'base64',
  ),
};
