import {
  ALLOWED_ORIGIN_SUFFIX,
  CHANNEL_HEADER,
  DEPOT_HEADER,
  STOCK_VERSION_HEADER,
  STOCKTAKE_FROZEN,
  STOCKTAKE_HEADER,
  WAREHOUSE_FLOOR_CHANNEL,
} from '../utils/constants.js';
import type { RequestInput } from './latticeRequest.js';

export type PayloadVersion = '1.0' | '2.0';

export interface Expected {
  status: number;
  bodyIncludes?: string;
  bodyIs?: string;
  headers?: Record<string, string | null>;
}

export interface Step {
  name: string;
  request: Omit<RequestInput, 'port'>;
  expected: Expected;
}

const ALLOWED_ORIGIN = `https://floor${ALLOWED_ORIGIN_SUFFIX}`;
const BLOCKED_ORIGIN = 'https://attacker.example';

const JSON_HEADERS = { 'content-type': 'application/json' };
const COUNT_SHEET = 'sku,depot,counted\nbrk-9,leeds,118\nbrk-9,hull,2\n';

// Every route is called on both listeners, so the two payload versions run the same requests.
// Only the stock read answers differently, because a 1.0 payload cannot carry a repeated query
// param and a 2.0 one can.
export function buildSteps(version: PayloadVersion): Step[] {
  return [
    {
      name: 'list available stock',
      request: { method: 'GET', path: '/stock/available' },
      expected: { status: 200, bodyIncludes: '"sku":"brk-9"' },
    },
    {
      name: 'read a stock item',
      request: {
        method: 'GET',
        path: '/stock/brk-9',
        query: { page: '2', expand: 'movements', depot: ['leeds', 'hull'] },
        headers: { [DEPOT_HEADER]: ['leeds', 'hull'] },
      },
      expected: {
        status: 200,
        bodyIncludes: version === '2.0' ? '"page":2,"depots":["leeds","hull"]' : '"page":2,"depots":["leeds"]',
        headers: { [STOCK_VERSION_HEADER]: '4' },
      },
    },
    {
      name: 'list available stock scoped to a depot',
      request: { method: 'GET', path: '/stock/available', query: { depot: 'leeds' } },
      expected: { status: 200, bodyIncludes: '"sku":"brk-9"' },
    },
    {
      name: 'read a stock item that is not stocked',
      request: { method: 'GET', path: '/stock/zzz-0' },
      expected: { status: 404, bodyIncludes: 'is not stocked' },
    },
    {
      name: 'read a stock item with an uncoercible page',
      request: { method: 'GET', path: '/stock/brk-9', query: { page: 'soon' } },
      expected: { status: 400, bodyIncludes: 'expected number' },
    },
    {
      name: 'check a stock item',
      request: { method: 'HEAD', path: '/stock/brk-9' },
      expected: { status: 200, bodyIs: '', headers: { [STOCK_VERSION_HEADER]: '4' } },
    },
    {
      name: 'read a stock movement',
      request: { method: 'GET', path: '/stock/brk-9/movements/mov-501' },
      expected: { status: 200, bodyIncludes: '"movementId":"mov-501"' },
    },
    {
      name: 'list the SKUs a supplier holds',
      request: { method: 'GET', path: '/suppliers/sup-athertons/skus' },
      expected: { status: 200, bodyIncludes: '"skus":["brk-9","clp-3"]' },
    },
    {
      name: 'list the SKUs a supplier holds without signing',
      request: { method: 'GET', path: '/suppliers/sup-athertons/skus', anonymous: true },
      expected: { status: 401, bodyIncludes: 'The caller has no principal' },
    },
    {
      name: 'create a stock item',
      request: {
        method: 'POST',
        path: '/stock',
        headers: JSON_HEADERS,
        body: JSON.stringify({ sku: 'brk-7', description: 'Steel bracket, 70mm', quantity: 40 }),
      },
      expected: { status: 201, bodyIncludes: '"sku":"brk-7"' },
    },
    {
      name: 'create a stock item with a body the schema rejects',
      request: {
        method: 'POST',
        path: '/stock',
        headers: JSON_HEADERS,
        body: JSON.stringify({ sku: 'brk-7' }),
      },
      expected: { status: 422, bodyIncludes: 'description' },
    },
    {
      name: 'create a stock item that is already stocked',
      request: {
        method: 'POST',
        path: '/stock',
        headers: JSON_HEADERS,
        body: JSON.stringify({ sku: 'brk-9', description: 'Steel bracket, 90mm', quantity: 1 }),
      },
      expected: { status: 409, bodyIncludes: 'already stocked' },
    },
    {
      name: 'replace a stock count sheet',
      request: {
        method: 'PUT',
        path: '/stock/brk-9',
        headers: { 'content-type': 'application/octet-stream' },
        body: COUNT_SHEET,
      },
      expected: { status: 200, bodyIncludes: '"lines":3' },
    },
    {
      name: 'replace a stock count sheet during a stocktake',
      request: {
        method: 'PUT',
        path: '/stock/brk-9',
        headers: { 'content-type': 'application/octet-stream', [STOCKTAKE_HEADER]: STOCKTAKE_FROZEN },
        body: COUNT_SHEET,
      },
      expected: { status: 409, bodyIncludes: 'is being counted' },
    },
    {
      name: 'adjust stock from the warehouse floor',
      request: {
        method: 'PATCH',
        path: '/stock/brk-9',
        headers: { ...JSON_HEADERS, [CHANNEL_HEADER]: WAREHOUSE_FLOOR_CHANNEL },
        body: JSON.stringify({ delta: -5, reason: 'Damaged in the racking' }),
      },
      expected: { status: 200, bodyIncludes: '"quantity":115' },
    },
    {
      name: 'adjust stock',
      request: {
        method: 'PATCH',
        path: '/stock/brk-9',
        headers: JSON_HEADERS,
        body: JSON.stringify({ delta: 10, reason: 'Returned from a cancelled order' }),
      },
      expected: { status: 200, bodyIncludes: '"quantity":130' },
    },
    {
      name: 'adjust stock with a body the schema rejects',
      request: {
        method: 'PATCH',
        path: '/stock/brk-9',
        headers: JSON_HEADERS,
        body: JSON.stringify({ delta: 10 }),
      },
      expected: { status: 422, bodyIncludes: 'reason' },
    },
    {
      name: 'discard a stock item that still holds units',
      request: { method: 'DELETE', path: '/stock/brk-9' },
      expected: { status: 409, bodyIncludes: 'still holds 120 units' },
    },
    {
      name: 'discard a stock item',
      request: { method: 'DELETE', path: '/stock/clp-3' },
      expected: { status: 204, bodyIs: '' },
    },
    {
      name: 'follow a retired SKU',
      request: { method: 'GET', path: '/stock/retired/brk-4' },
      expected: { status: 308, headers: { location: '/stock/brk-9' } },
    },
    {
      name: 'follow a SKU under review',
      request: { method: 'GET', path: '/stock/retired/clp-1' },
      expected: { status: 307, headers: { location: '/reports/valuation' } },
    },
    {
      name: 'value the stock holding',
      request: { method: 'GET', path: '/reports/valuation' },
      expected: { status: 500, bodyIncludes: 'Internal server error' },
    },
    {
      name: 'export the stock valuation',
      request: { method: 'GET', path: '/reports/valuation.csv' },
      expected: { status: 200, bodyIncludes: 'sku,depot,quantity\nbrk-9,leeds,120' },
    },
    {
      name: 'read a path where the dot is not a dot',
      request: { method: 'GET', path: '/reports/valuationXcsv' },
      expected: { status: 404, bodyIncludes: 'Not found' },
    },
    {
      name: 'raise a reorder',
      request: {
        method: 'POST',
        path: '/reorders',
        headers: JSON_HEADERS,
        body: JSON.stringify({ sku: 'brk-9', quantity: 200 }),
      },
      expected: { status: 500, bodyIncludes: 'Supplier ordering is unavailable for brk-9' },
    },
    {
      name: 'raise a reorder with a body the schema rejects',
      request: {
        method: 'POST',
        path: '/reorders',
        headers: JSON_HEADERS,
        body: JSON.stringify({ sku: 'brk-9' }),
      },
      expected: { status: 422, bodyIncludes: 'quantity' },
    },
    {
      name: 'read a path with no route',
      request: { method: 'GET', path: '/nowhere' },
      expected: { status: 404, bodyIncludes: 'Not found' },
    },
    {
      name: 'read from an allowed origin',
      request: { method: 'GET', path: '/stock/available', headers: { origin: ALLOWED_ORIGIN } },
      expected: {
        status: 200,
        headers: {
          'access-control-allow-origin': ALLOWED_ORIGIN,
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': STOCK_VERSION_HEADER,
          vary: 'Origin',
        },
      },
    },
    {
      name: 'read from a blocked origin',
      request: { method: 'GET', path: '/stock/available', headers: { origin: BLOCKED_ORIGIN } },
      expected: { status: 200, headers: { 'access-control-allow-origin': null, vary: 'Origin' } },
    },
    {
      name: 'preflight a path the router answers itself',
      request: {
        method: 'OPTIONS',
        path: '/reports/valuation',
        headers: {
          origin: ALLOWED_ORIGIN,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'content-type',
        },
      },
      expected: {
        status: 204,
        bodyIs: '',
        headers: {
          'access-control-allow-origin': ALLOWED_ORIGIN,
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': `content-type, ${CHANNEL_HEADER}, ${DEPOT_HEADER}`,
          'access-control-max-age': '600',
        },
      },
    },
    {
      name: 'preflight a path with its own OPTIONS route',
      request: {
        method: 'OPTIONS',
        path: '/stock/brk-9',
        headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
      },
      expected: {
        status: 204,
        headers: {
          allow: 'GET, HEAD, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-origin': ALLOWED_ORIGIN,
          'access-control-allow-methods': null,
        },
      },
    },
    {
      name: 'preflight a path with no route',
      request: { method: 'OPTIONS', path: '/nowhere', headers: { origin: ALLOWED_ORIGIN } },
      expected: { status: 404, headers: { 'access-control-allow-origin': ALLOWED_ORIGIN } },
    },
  ];
}
