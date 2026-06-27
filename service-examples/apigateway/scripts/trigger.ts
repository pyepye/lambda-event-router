import { Sha256 } from '@aws-crypto/sha256-js';
import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import WebSocket from 'ws';

import {
  CHANNEL_HEADER,
  DISPATCH_ROLE,
  EXPIRED_TOKEN,
  RETIRED_SERVICE_TOKEN,
  REVOKED_TOKEN,
  SERVICE_TOKEN,
  SIMPLE_MODE_TOKEN,
  STAFF_ID_HEADER,
  STAFF_ROLE_HEADER,
  STAFF_TOKEN,
  WAREHOUSE_FLOOR_CHANNEL,
} from '../src/utils/constants.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-apigateway';

const cloudFormation = new CloudFormationClient({ region });
const apiGateway = new APIGatewayClient({ region });

const signer = new SignatureV4({
  service: 'execute-api',
  region,
  credentials: fromNodeProviderChain(),
  sha256: Sha256,
});

// The IAM authorized route checks a SigV4 signature rather than calling the authorizer Lambda.
async function signedHeaders(url: string): Promise<Record<string, string>> {
  const target = new URL(url);
  const signed = await signer.sign(
    new HttpRequest({
      method: 'GET',
      protocol: target.protocol,
      hostname: target.hostname,
      path: target.pathname,
      headers: { host: target.hostname },
    }),
  );
  return signed.headers;
}

const ALLOWED_ORIGIN = 'https://floor.warehouse.example';
const BLOCKED_ORIGIN = 'https://attacker.example';
const SOCKET_TIMEOUT_MS = 10_000;

// =============================================================================
// Stack outputs
// =============================================================================

const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const restUrl = output('RestApiUrl').replace(/\/$/, '');
const httpUrl = output('HttpApiUrl').replace(/\/$/, '');
const socketUrl = output('WebSocketUrl').replace(/\/$/, '');

const { value: apiKeyValue } = await apiGateway.send(
  new GetApiKeyCommand({ apiKey: output('StockApiKeyId'), includeValue: true }),
);
if (!apiKeyValue) throw new Error('The stock API key has no value.');

// =============================================================================
// Assertions
// =============================================================================

const failures: string[] = [];

function assert(step: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${step}`);
    return;
  }
  failures.push(step);
  console.log(`FAIL ${step}: ${problems.join(', ')}`);
}

interface Expected {
  status: number;
  bodyIncludes?: string;
  bodyIs?: string;
  headers?: Record<string, string | null>;
}

async function call(step: string, url: string, init: RequestInit, expected: Expected): Promise<void> {
  const response = await fetch(url, { redirect: 'manual', ...init });
  const body = await response.text();
  const problems: string[] = [];

  if (response.status !== expected.status) problems.push(`status ${response.status} (${body.slice(0, 120)})`);
  if (expected.bodyIncludes && !body.includes(expected.bodyIncludes)) problems.push(`body ${body.slice(0, 200)}`);
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${JSON.stringify(body)}`);

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actual = response.headers.get(name);
    if (value === null && actual !== null) problems.push(`${name} is ${actual}`);
    if (value !== null && actual !== value) problems.push(`${name} is ${String(actual)}`);
  }

  assert(step, problems);
}

// =============================================================================
// REST API: payload format 1.0
// =============================================================================

const staffHeaders = { [STAFF_ID_HEADER]: 'staff-77' };
const jsonHeaders = { 'content-type': 'application/json' };

await call('REST list pending orders', `${restUrl}/orders/pending`, {}, { status: 200, bodyIncludes: 'ord-1043' });

await call(
  'REST read an order',
  `${restUrl}/orders/ord-1042?page=2&include=lines&tag=urgent&tag=fragile`,
  { headers: staffHeaders },
  { status: 200, bodyIncludes: 'WH-1042', headers: { 'x-order-version': '3' } },
);

await call('REST read an order with no staff id', `${restUrl}/orders/ord-1042`, {}, { status: 403 });

await call(
  'REST read an order with an uncoercible page',
  `${restUrl}/orders/ord-1042?page=soon`,
  { headers: staffHeaders },
  { status: 400, bodyIncludes: 'expected number' },
);

await call(
  'REST read an order that does not exist',
  `${restUrl}/orders/ord-9999`,
  { headers: staffHeaders },
  { status: 404, bodyIncludes: 'does not exist' },
);

await call(
  'REST read an order line',
  `${restUrl}/orders/ord-1042/lines/line-1`,
  {},
  { status: 200, bodyIncludes: 'brk-9' },
);

await call(
  'REST read an order line that does not exist',
  `${restUrl}/orders/ord-1042/lines/line-9`,
  {},
  { status: 404 },
);

const manifest = 'sku,quantity\nbrk-9,4\nclp-3,12\n';

await call(
  'REST upload an order manifest as binary',
  `${restUrl}/orders/ord-1042/manifest`,
  { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: manifest },
  { status: 200, bodyIncludes: '"lines":3' },
);

await call(
  'REST create an order',
  `${restUrl}/orders`,
  {
    method: 'POST',
    headers: { ...jsonHeaders, authorization: STAFF_TOKEN },
    body: JSON.stringify({ reference: 'WH-1099', customer: 'Ridley Fabrication', total: 22.5 }),
  },
  { status: 201, bodyIncludes: 'ord-1099' },
);

await call(
  'REST create an order with a body the schema rejects',
  `${restUrl}/orders`,
  {
    method: 'POST',
    headers: { ...jsonHeaders, authorization: STAFF_TOKEN },
    body: JSON.stringify({ reference: 'WH-1100' }),
  },
  { status: 422, bodyIncludes: 'customer' },
);

await call(
  'REST create an order with an expired token',
  `${restUrl}/orders`,
  { method: 'POST', headers: { ...jsonHeaders, authorization: EXPIRED_TOKEN }, body: '{}' },
  { status: 403 },
);

await call(
  'REST create an order with a revoked token',
  `${restUrl}/orders`,
  { method: 'POST', headers: { ...jsonHeaders, authorization: REVOKED_TOKEN }, body: '{}' },
  { status: 403 },
);

await call(
  'REST create an order with a token the authorizer answers with a boolean',
  `${restUrl}/orders`,
  { method: 'POST', headers: { ...jsonHeaders, authorization: SIMPLE_MODE_TOKEN }, body: '{}' },
  { status: 500 },
);

await call(
  'REST amend an order from the warehouse floor',
  `${restUrl}/orders/ord-1042`,
  {
    method: 'PATCH',
    headers: { ...jsonHeaders, [CHANNEL_HEADER]: WAREHOUSE_FLOOR_CHANNEL },
    body: JSON.stringify({ status: 'packed' }),
  },
  { status: 204, bodyIs: '' },
);

await call(
  'REST amend an order from the office',
  `${restUrl}/orders/ord-1042`,
  { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status: 'dispatched' }) },
  { status: 204, bodyIs: '' },
);

await call(
  'REST amend an order with a status the schema rejects',
  `${restUrl}/orders/ord-1042`,
  { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status: 'lost' }) },
  { status: 422 },
);

await call(
  'REST delete an order the authorizer has no route for',
  `${restUrl}/orders/ord-1042`,
  { method: 'DELETE', headers: staffHeaders },
  { status: 500 },
);

await call(
  'REST read stock levels with the API key',
  `${restUrl}/warehouse/stock`,
  { headers: { 'x-api-key': apiKeyValue } },
  { status: 200, bodyIncludes: 'brk-9' },
);

await call('REST read stock levels with no API key', `${restUrl}/warehouse/stock`, {}, { status: 403 });

// =============================================================================
// HTTP API: payload format 1.0
// =============================================================================

await call(
  'HTTP 1.0 read a consignment',
  `${httpUrl}/dispatch/con-5501?depot=leeds&depot=hull`,
  {},
  { status: 200, bodyIncludes: 'palletline' },
);

await call('HTTP 1.0 read a consignment that does not exist', `${httpUrl}/dispatch/con-9999`, {}, { status: 404 });

await call(
  'HTTP 1.0 follow a label redirect',
  `${httpUrl}/dispatch/con-5501/label`,
  {},
  { status: 307, headers: { location: 'https://labels.carrier.example/con-5501.pdf' } },
);

await call(
  'HTTP 1.0 quote a carrier rate the response schema rejects',
  `${httpUrl}/dispatch/quote`,
  {},
  { status: 500, bodyIncludes: 'Internal server error' },
);

const booking = JSON.stringify({ consignmentId: 'con-5502', carrier: 'palletline', weightKg: 18 });

await call(
  'HTTP 1.0 book a consignment as a dispatcher',
  `${httpUrl}/dispatch`,
  { method: 'POST', headers: { ...jsonHeaders, [STAFF_ROLE_HEADER]: DISPATCH_ROLE }, body: booking },
  { status: 500, bodyIncludes: 'rejected the booking' },
);

await call(
  'HTTP 1.0 book a consignment with no role',
  `${httpUrl}/dispatch`,
  { method: 'POST', headers: jsonHeaders, body: booking },
  { status: 401, bodyIncludes: STAFF_ROLE_HEADER },
);

await call(
  'HTTP 1.0 book a consignment as a picker',
  `${httpUrl}/dispatch`,
  { method: 'POST', headers: { ...jsonHeaders, [STAFF_ROLE_HEADER]: 'picker' }, body: booking },
  { status: 403, bodyIncludes: 'cannot book a consignment' },
);

await call(
  'HTTP 1.0 book a consignment with a carrier the schema rejects',
  `${httpUrl}/dispatch`,
  {
    method: 'POST',
    headers: { ...jsonHeaders, [STAFF_ROLE_HEADER]: DISPATCH_ROLE },
    body: JSON.stringify({ consignmentId: 'con-5503', carrier: 'pigeon', weightKg: 1 }),
  },
  { status: 422, bodyIncludes: 'carrier' },
);

// =============================================================================
// HTTP API: payload format 2.0
// =============================================================================

await call(
  'HTTP 2.0 read a stock record',
  `${httpUrl}/inventory/brk-9?depot=leeds&depot=hull`,
  { headers: { origin: ALLOWED_ORIGIN } },
  {
    status: 200,
    bodyIncludes: '"quantity":120',
    headers: { 'access-control-allow-origin': ALLOWED_ORIGIN, vary: 'Origin' },
  },
);

await call(
  'HTTP 2.0 read a stock record from a blocked origin',
  `${httpUrl}/inventory/brk-9`,
  { headers: { origin: BLOCKED_ORIGIN } },
  { status: 200, headers: { 'access-control-allow-origin': null, vary: 'Origin' } },
);

await call('HTTP 2.0 read a stock record that does not exist', `${httpUrl}/inventory/nut-1`, {}, { status: 404 });

const auditUrl = `${httpUrl}/inventory/brk-9/audit`;

await call(
  'HTTP 2.0 read a stock audit with a signed request',
  auditUrl,
  { headers: await signedHeaders(auditUrl) },
  { status: 200, bodyIncludes: '"sku":"brk-9"' },
);

await call('HTTP 2.0 read a stock audit unsigned', auditUrl, {}, { status: 403 });

await call(
  'HTTP 2.0 check a stock record with HEAD',
  `${httpUrl}/inventory/brk-9`,
  { method: 'HEAD' },
  { status: 200, bodyIs: '', headers: { 'x-stock-quantity': '120' } },
);

await call(
  'HTTP 2.0 answer a preflight from the registered OPTIONS route',
  `${httpUrl}/inventory/brk-9`,
  {
    method: 'OPTIONS',
    headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'PUT' },
  },
  { status: 200, headers: { allow: 'GET, HEAD, PUT, PATCH, DELETE, OPTIONS' } },
);

await call(
  'HTTP 2.0 answer a preflight automatically',
  `${httpUrl}/dispatch/con-5501`,
  {
    method: 'OPTIONS',
    headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
  },
  {
    status: 204,
    headers: {
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type, x-staff-id, x-staff-role, x-channel',
      'access-control-max-age': '600',
    },
  },
);

await call(
  'HTTP 2.0 answer a preflight from a blocked origin',
  `${httpUrl}/dispatch/con-5501`,
  {
    method: 'OPTIONS',
    headers: { origin: BLOCKED_ORIGIN, 'access-control-request-method': 'GET' },
  },
  { status: 404 },
);

const adjustment = JSON.stringify({ delta: -4, reason: 'damaged in transit' });

await call(
  'HTTP 2.0 adjust stock behind the simple authorizer',
  `${httpUrl}/inventory/brk-9`,
  { method: 'PUT', headers: { ...jsonHeaders, authorization: SERVICE_TOKEN }, body: adjustment },
  { status: 200, bodyIncludes: '"quantity":116' },
);

await call(
  'HTTP 2.0 adjust stock with a token the simple authorizer refuses',
  `${httpUrl}/inventory/brk-9`,
  { method: 'PUT', headers: { ...jsonHeaders, authorization: 'nope' }, body: adjustment },
  { status: 403 },
);

await call(
  'HTTP 2.0 reconcile stock behind the policy authorizer',
  `${httpUrl}/inventory/brk-9`,
  { method: 'PATCH', headers: { ...jsonHeaders, authorization: SERVICE_TOKEN }, body: adjustment },
  { status: 200, bodyIncludes: '"counted":116' },
);

await call(
  'HTTP 2.0 reconcile stock with a token the policy authorizer denies',
  `${httpUrl}/inventory/brk-9`,
  { method: 'PATCH', headers: { ...jsonHeaders, authorization: 'nope' }, body: adjustment },
  { status: 403 },
);

await call(
  'HTTP 2.0 discard a stock record with nothing left',
  `${httpUrl}/inventory/clp-3`,
  { method: 'DELETE' },
  { status: 204, bodyIs: '' },
);

await call(
  'HTTP 2.0 discard a stock record that still holds units',
  `${httpUrl}/inventory/brk-9`,
  { method: 'DELETE' },
  { status: 409, bodyIncludes: 'still holds 120 units' },
);

await call(
  'HTTP 2.0 redirect a retired SKU',
  `${httpUrl}/inventory/retired/brk-9`,
  {},
  { status: 308, headers: { location: '/inventory/brk-9' } },
);

await call(
  'HTTP 2.0 request a path no route matches',
  `${httpUrl}/nowhere`,
  { headers: { origin: ALLOWED_ORIGIN } },
  { status: 404, bodyIs: '{"error":"Not found"}', headers: { 'access-control-allow-origin': ALLOWED_ORIGIN } },
);

// =============================================================================
// WebSocket API
// =============================================================================

function openSocket(query: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${socketUrl}${query}`);
    const timer = setTimeout(() => reject(new Error('handshake timed out')), SOCKET_TIMEOUT_MS);
    socket.once('open', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sendAndWait(socket: WebSocket, frame: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no reply within the timeout')), SOCKET_TIMEOUT_MS);
    socket.once('message', (data) => {
      clearTimeout(timer);
      resolve(data.toString());
    });
    socket.send(frame);
  });
}

async function expectRefusedHandshake(step: string, query: string, status: number): Promise<void> {
  try {
    const socket = await openSocket(query);
    socket.close();
    assert(step, ['the handshake succeeded']);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(step, message.includes(String(status)) ? [] : [message]);
  }
}

await expectRefusedHandshake('WebSocket connect with no token', '', 401);
await expectRefusedHandshake('WebSocket connect with a retired token', `?token=${RETIRED_SERVICE_TOKEN}`, 403);

const socket = await openSocket(`?token=${SERVICE_TOKEN}`);
assert('WebSocket connect with a token', []);

async function expectFrame(step: string, frame: string, includes: string): Promise<void> {
  const reply = await sendAndWait(socket, frame);
  assert(step, reply.includes(includes) ? [] : [`reply ${reply}`]);
}

await expectFrame(
  'WebSocket send an alert',
  JSON.stringify({ action: 'sendAlert', sku: 'brk-9', message: 'Bracket stock is low' }),
  '"quantity":120',
);

await expectFrame(
  'WebSocket send an alert with a body the schema rejects',
  JSON.stringify({ action: 'sendAlert', sku: 'brk-9' }),
  'Internal server error',
);

await expectFrame(
  'WebSocket run an admin command',
  JSON.stringify({ action: 'adminDrainQueue' }),
  '"status":"accepted"',
);

await expectFrame('WebSocket send an unknown action', JSON.stringify({ action: 'reindex' }), 'Unknown action');

await expectFrame(
  'WebSocket send an action the router has no route for',
  JSON.stringify({ action: 'subscribe' }),
  'Internal server error',
);

socket.close();
await new Promise((resolve) => socket.once('close', resolve));
assert('WebSocket disconnect', []);

console.log(
  failures.length === 0
    ? `\nEvery step passed. Worker log: ${output('WorkerLogGroupName')}`
    : `\n${failures.length} step(s) failed: ${failures.join('; ')}`,
);

if (failures.length > 0) process.exitCode = 1;
