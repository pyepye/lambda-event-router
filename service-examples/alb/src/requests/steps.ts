import { gzipSync } from 'node:zlib';

import {
  ALLOWED_ORIGIN_SUFFIX,
  CHANNEL_HEADER,
  DESK_CLOSED,
  DESK_HEADER,
  DESK_ROLE_HEADER,
  DESK_STATE_HEADER,
  RETURN_VERSION_HEADER,
  RETURNS_DESK_CHANNEL,
  RETURNS_DESK_ROLE,
} from '../utils/constants.js';
import { RETURN_LABEL_PNG } from '../utils/returns.js';

export type EventForm = 'single-value' | 'multi-value';

export interface RequestInput {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer;
}

export interface Expected {
  status: number;
  bodyIncludes?: string | string[];
  bodyExcludes?: string;
  bodyIs?: string;
  // Bytes the response carries. The caller compares what came off the wire, and the in-process run
  // compares the base64 the router handed the adapter.
  bodyBase64?: string;
  headers?: Record<string, string | null>;
}

export interface Step {
  name: string;
  request: RequestInput;
  expected: Expected;
  // Set where the load balancer answers instead of the router, or rewrites what the router built,
  // so the in-process check has its own expectation to compare against.
  expectedInProcess?: Expected;
}

const ALLOWED_ORIGIN = `https://desk${ALLOWED_ORIGIN_SUFFIX}`;
const BLOCKED_ORIGIN = 'https://attacker.example';

const JSON_HEADERS = { 'content-type': 'application/json' };
const GZIP_HEADERS = { 'content-type': 'application/gzip' };
const RETURN_NOTE = 'ret-8801,dpd,checked\nret-8801,dpd,repacked\nret-8801,dpd,shelved\n';
const RETURN_NOTE_ARCHIVE = gzipSync(RETURN_NOTE);

// Every route is called on both listeners, so the two event forms run the same requests. Only the
// return read answers differently, because a single-value target group cannot carry a repeated
// query param or a repeated header. `targetGroupArn` is the one the listener under test serves
// from, which is what the read asserts the router handed the handler. `origin` is the scheme, host
// and port the caller reached, which the redirects need because the load balancer rewrites a
// relative `Location` against it.
export function buildSteps(form: EventForm, targetGroupArn: string, origin: string): Step[] {
  return [
    {
      name: 'list open returns',
      request: { method: 'GET', path: '/returns/open' },
      expected: {
        status: 200,
        bodyIncludes: '"returnId":"ret-8801"',
        headers: { 'access-control-allow-origin': null, vary: 'Origin' },
      },
    },
    {
      name: 'list open returns with a trailing slash',
      request: { method: 'GET', path: '/returns/open/' },
      expected: { status: 200, bodyIncludes: '"returnId":"ret-8801"' },
    },
    {
      name: 'read a return',
      request: {
        method: 'GET',
        path: '/returns/ret-8801',
        query: { page: '2', expand: 'lines', carrier: ['dpd', 'evri'] },
        headers: { [DESK_HEADER]: ['leeds', 'hull'] },
      },
      expected: {
        status: 200,
        bodyIncludes: [
          form === 'multi-value' ? '"carriers":["dpd","evri"]' : '"carriers":["evri"]',
          form === 'multi-value' ? '"deskHeaders":["leeds","hull"]' : '"deskHeaders":["hull"]',
          `"targetGroupArn":"${targetGroupArn}"`,
        ],
        bodyExcludes: '"principalId"',
        headers: { [RETURN_VERSION_HEADER]: '3' },
      },
    },
    {
      name: 'read a return with a reason that needs encoding',
      request: { method: 'GET', path: '/returns/ret-8801', query: { reason: 'damaged in transit' } },
      expected: { status: 200, bodyIncludes: '"reason":"damaged%20in%20transit"' },
    },
    {
      name: 'list open returns scoped to a carrier',
      request: { method: 'GET', path: '/returns/open', query: { carrier: 'dpd' } },
      expected: { status: 200, bodyIncludes: '"returnId":"ret-8801"' },
    },
    {
      name: 'read a return that does not exist',
      request: { method: 'GET', path: '/returns/ret-0000' },
      expected: { status: 404, bodyIncludes: 'does not exist' },
    },
    {
      name: 'read a return with an uncoercible page',
      request: { method: 'GET', path: '/returns/ret-8801', query: { page: 'soon' } },
      expected: { status: 400, bodyIncludes: 'expected number' },
    },
    {
      name: 'check a return',
      request: { method: 'HEAD', path: '/returns/ret-8801' },
      expected: { status: 200, bodyIs: '', headers: { [RETURN_VERSION_HEADER]: '3' } },
    },
    {
      name: 'read a return line',
      request: { method: 'GET', path: '/returns/ret-8801/lines/line-1' },
      expected: { status: 200, bodyIncludes: '"lineId":"line-1"' },
    },
    {
      name: 'list the returns a carrier holds',
      request: {
        method: 'GET',
        path: '/carriers/car-dpd/returns',
        headers: { [DESK_ROLE_HEADER]: RETURNS_DESK_ROLE },
      },
      expected: { status: 200, bodyIncludes: '"returnIds":["ret-8801"]' },
    },
    {
      name: 'list the returns a carrier holds with the wrong desk role',
      request: { method: 'GET', path: '/carriers/car-dpd/returns', headers: { [DESK_ROLE_HEADER]: 'packing' } },
      expected: { status: 403, bodyIncludes: 'not on the returns desk' },
    },
    {
      name: 'list the returns a carrier holds with no desk role',
      request: { method: 'GET', path: '/carriers/car-dpd/returns' },
      expected: { status: 401, bodyIncludes: 'has no desk role' },
    },
    {
      name: 'create a return',
      request: {
        method: 'POST',
        path: '/returns',
        headers: JSON_HEADERS,
        body: JSON.stringify({ returnId: 'ret-8803', orderId: 'ord-1044', units: 2 }),
      },
      expected: { status: 201, bodyIncludes: '"returnId":"ret-8803"' },
    },
    {
      name: 'create a return with a body the schema rejects',
      request: {
        method: 'POST',
        path: '/returns',
        headers: JSON_HEADERS,
        body: JSON.stringify({ returnId: 'ret-8803' }),
      },
      expected: { status: 422, bodyIncludes: 'orderId' },
    },
    {
      name: 'create a return with a body that is not JSON',
      request: { method: 'POST', path: '/returns', headers: JSON_HEADERS, body: 'ret-8803' },
      expected: { status: 422, bodyIncludes: 'expected object' },
    },
    {
      name: 'create a return that already exists',
      request: {
        method: 'POST',
        path: '/returns',
        headers: JSON_HEADERS,
        body: JSON.stringify({ returnId: 'ret-8801', orderId: 'ord-1042', units: 1 }),
      },
      expected: { status: 409, bodyIncludes: 'already exists' },
    },
    {
      name: 'replace a return note',
      request: {
        method: 'PUT',
        path: '/returns/ret-8801/note',
        headers: GZIP_HEADERS,
        body: RETURN_NOTE_ARCHIVE,
      },
      expected: {
        status: 200,
        bodyIncludes: ['"lines":3', `"bytes":${RETURN_NOTE_ARCHIVE.length}`, '"encoded":true'],
      },
    },
    {
      name: 'replace a return note while the desk is closed',
      request: {
        method: 'PUT',
        path: '/returns/ret-8801/note',
        headers: { ...GZIP_HEADERS, [DESK_STATE_HEADER]: DESK_CLOSED },
        body: RETURN_NOTE_ARCHIVE,
      },
      expected: { status: 409, bodyIncludes: 'desk is closed' },
    },
    {
      name: 'replace a return note with a text body',
      request: {
        method: 'PUT',
        path: '/returns/ret-8801/note',
        headers: { 'content-type': 'text/plain' },
        body: RETURN_NOTE,
      },
      expected: { status: 422, bodyIncludes: 'Expected a binary body' },
    },
    {
      name: 'amend a return at the desk',
      request: {
        method: 'PATCH',
        path: '/returns/ret-8801',
        headers: { ...JSON_HEADERS, [CHANNEL_HEADER]: RETURNS_DESK_CHANNEL },
        body: JSON.stringify({ units: -2, reason: 'Damaged on arrival' }),
      },
      expected: { status: 200, bodyIncludes: '"units":1' },
    },
    {
      name: 'amend a return',
      request: {
        method: 'PATCH',
        path: '/returns/ret-8801',
        headers: JSON_HEADERS,
        body: JSON.stringify({ units: 5, reason: 'Second parcel arrived' }),
      },
      expected: { status: 200, bodyIncludes: '"units":8' },
    },
    {
      name: 'amend a return with a body the schema rejects',
      request: {
        method: 'PATCH',
        path: '/returns/ret-8801',
        headers: JSON_HEADERS,
        body: JSON.stringify({ units: 5 }),
      },
      expected: { status: 422, bodyIncludes: 'reason' },
    },
    {
      name: 'withdraw a return that still holds units',
      request: { method: 'DELETE', path: '/returns/ret-8801' },
      expected: { status: 409, bodyIncludes: 'still holds 3 units' },
    },
    {
      name: 'withdraw a return',
      request: { method: 'DELETE', path: '/returns/ret-8802' },
      expected: { status: 204, bodyIs: '' },
    },
    {
      name: 'follow a merged return',
      request: { method: 'GET', path: '/returns/merged/ret-8790' },
      expected: { status: 308, headers: { location: `${origin}/returns/ret-8801` } },
      expectedInProcess: { status: 308, headers: { location: '/returns/ret-8801' } },
    },
    {
      name: 'follow a return under review',
      request: { method: 'GET', path: '/returns/merged/ret-8791' },
      expected: { status: 307, headers: { location: `${origin}/returns/open` } },
      expectedInProcess: { status: 307, headers: { location: '/returns/open' } },
    },
    {
      name: 'summarise the returns',
      request: { method: 'GET', path: '/reports/returns' },
      expected: { status: 500, bodyIncludes: 'Internal server error' },
    },
    {
      name: 'export the returns',
      request: { method: 'GET', path: '/reports/returns.csv' },
      expected: { status: 200, bodyIncludes: 'returnId,carrier,units\nret-8801,dpd,3' },
      expectedInProcess: {
        status: 200,
        bodyIncludes: 'returnId,carrier,units\nret-8801,dpd,3',
        headers: { 'content-type': null },
      },
    },
    {
      name: 'read a path where the dot is not a dot',
      request: { method: 'GET', path: '/reports/returnsXcsv' },
      expected: { status: 404, bodyIncludes: 'Not found' },
    },
    {
      name: 'export the return labels',
      request: { method: 'GET', path: '/reports/labels' },
      expected: { status: 502 },
      expectedInProcess: { status: 200, bodyIncludes: 'ret-8801,dpd,GB-LEEDS-01' },
    },
    {
      name: 'refund a return',
      request: {
        method: 'POST',
        path: '/refunds',
        headers: JSON_HEADERS,
        body: JSON.stringify({ returnId: 'ret-8801', amount: 42.5 }),
      },
      expected: { status: 500, bodyIncludes: 'Refunds are unavailable for ret-8801' },
    },
    {
      name: 'refund a return with a body the schema rejects',
      request: {
        method: 'POST',
        path: '/refunds',
        headers: JSON_HEADERS,
        body: JSON.stringify({ returnId: 'ret-8801' }),
      },
      expected: { status: 422, bodyIncludes: 'amount' },
    },
    {
      name: 'read a path with no route',
      request: { method: 'GET', path: '/nowhere' },
      expected: { status: 404, bodyIncludes: 'Not found' },
    },
    {
      name: 'check a path with no route',
      request: { method: 'HEAD', path: '/nowhere' },
      expected: { status: 404, bodyIs: '' },
    },
    {
      name: 'download a return label',
      request: { method: 'GET', path: '/returns/ret-8801/label' },
      expected: {
        status: 200,
        bodyBase64: RETURN_LABEL_PNG['ret-8801']?.toString('base64'),
        headers: { 'content-type': 'image/png' },
      },
    },
    {
      name: 'download a label for a return that has none',
      request: { method: 'GET', path: '/returns/ret-8802/label' },
      expected: { status: 404, bodyIncludes: 'has no label' },
    },
    {
      name: 'count the open returns',
      request: { method: 'GET', path: '/reports/returns/count' },
      expected: { status: 200, bodyIs: '1' },
      expectedInProcess: { status: 200, bodyIs: '1', headers: { 'content-type': null } },
    },
    {
      name: 'summarise the return queue',
      request: { method: 'GET', path: '/reports/returns/queue' },
      expected: { status: 200, bodyIncludes: '"queued":-3' },
    },
    {
      name: 'check a return is waiting for pickup',
      request: { method: 'GET', path: '/returns/ret-8801/pickup' },
      expected: { status: 204, bodyIs: '' },
    },
    {
      name: 'check a settled return is waiting for pickup',
      request: { method: 'GET', path: '/returns/ret-8802/pickup' },
      expected: { status: 200, bodyIs: 'false' },
    },
    {
      name: 'release a return hold',
      request: { method: 'DELETE', path: '/returns/ret-8801/hold' },
      expected: { status: 204, bodyIs: '' },
    },
    {
      name: 'read from an allowed origin',
      request: { method: 'GET', path: '/returns/open', headers: { origin: ALLOWED_ORIGIN } },
      expected: {
        status: 200,
        headers: {
          'access-control-allow-origin': ALLOWED_ORIGIN,
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': RETURN_VERSION_HEADER,
          vary: 'Origin',
        },
      },
    },
    {
      name: 'read from a blocked origin',
      request: { method: 'GET', path: '/returns/open', headers: { origin: BLOCKED_ORIGIN } },
      expected: { status: 200, headers: { 'access-control-allow-origin': null, vary: 'Origin' } },
    },
    {
      name: 'preflight a path the router answers itself',
      request: {
        method: 'OPTIONS',
        path: '/reports/returns',
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
          'access-control-allow-headers': `content-type, ${CHANNEL_HEADER}, ${DESK_HEADER}`,
          'access-control-max-age': '600',
        },
      },
    },
    {
      name: 'preflight a path with its own OPTIONS route',
      request: {
        method: 'OPTIONS',
        path: '/returns/ret-8801',
        headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
      },
      expected: {
        status: 204,
        headers: {
          allow: 'GET, HEAD, PATCH, DELETE, OPTIONS',
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
