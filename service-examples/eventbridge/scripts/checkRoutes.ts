import type { EventBridgeEventEnvelope } from '@lambda-event-router/eventbridge';
import type { Context } from 'aws-lambda';

const ACCOUNT = '739650895623';
const REGION = 'eu-west-2';

// The router reads the account and region filters from the environment at import time, and the
// logger builds itself on the first call. Both have to be set before the router module loads, which
// is why the imports below are dynamic. JSON is the format the deployed worker writes.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
process.env.LOCAL_ACCOUNT_ID = ACCOUNT;
process.env.LOCAL_REGION = REGION;

const { eventBridgeRouter } = await import('../src/eventbridge.js');
const {
  BATCH_COMPLETED,
  BRISTOL_WAREHOUSE_ARN,
  LEEDS_WAREHOUSE_ARN,
  LEGACY_SOURCE,
  ORDER_PLACED,
  ORDER_UPDATED,
  ORDERS_SOURCE,
  PARTNER_ACCOUNT_ID,
  PAYMENT_CAPTURED,
  PAYMENTS_SOURCE,
  SHIPMENT_DELAYED,
  SHIPMENT_DISPATCHED,
  SHIPPING_SOURCE,
} = await import('../src/config.js');

const context = {
  functionName: 'ler-example-eventbridge-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-eventbridge-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

interface Check {
  name: string;
  source: string;
  detailType: string;
  detail: unknown;
  account?: string;
  region?: string;
  resources?: string[];
  expected: { logIncludes?: string[]; errorIncludes?: string };
}

// The delivered event, copied field for field. EventBridge parses the Detail string before the
// worker sees it, so `detail` is an object here rather than JSON.
function buildEvent(check: Check, index: number): EventBridgeEventEnvelope {
  return {
    version: '0',
    id: `00000000-0000-0000-0000-00000000000${index}`,
    source: check.source,
    'detail-type': check.detailType,
    account: check.account ?? ACCOUNT,
    time: '2026-09-14T09:00:00Z',
    region: check.region ?? REGION,
    resources: check.resources ?? [],
    detail: check.detail,
  };
}

const checks: Check[] = [
  {
    name: 'a large order reaches flagHighValueOrder',
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2041', customerId: 'CU-882', amount: 249_900, currency: 'GBP' },
    expected: {
      logIncludes: ['Handling EventBridge event', 'High value order flagged for review', '"amount":249900'],
    },
  },
  {
    name: 'an ordinary order reaches processOrder',
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2042', customerId: 'CU-114', amount: 4250, currency: 'GBP' },
    expected: { logIncludes: ['Order context loaded', 'Order accepted for fulfilment', '"orderRef":"AB-2042"'] },
  },
  {
    name: 'an order with no amount fails OrderPlacedSchema',
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2043', customerId: 'CU-117', currency: 'GBP' },
    expected: { errorIncludes: 'Schema validation failed for event' },
  },
  {
    name: 'a local order update reaches updateOrder',
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    detail: { orderRef: 'AB-2042', status: 'packed' },
    expected: { logIncludes: ['Order status updated', '"status":"packed"'] },
  },
  {
    name: 'a partner order update reaches archivePartnerOrder',
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    detail: { orderRef: 'ZZ-118', status: 'picking' },
    account: PARTNER_ACCOUNT_ID,
    expected: { logIncludes: ['Partner order update archived', `"account":"${PARTNER_ACCOUNT_ID}"`] },
  },
  {
    name: 'a US order update reaches mirrorOrderUpdate',
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    detail: { orderRef: 'US-4410', status: 'cancelled' },
    region: 'us-east-1',
    expected: { logIncludes: ['Order update mirrored from a US region', '"region":"us-east-1"'] },
  },
  {
    name: 'a Leeds shipment reaches routeToLeedsWarehouse',
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DISPATCHED,
    detail: { orderRef: 'AB-2042', carrier: 'Royal Mail', trackingRef: 'RM884120041GB' },
    resources: [LEEDS_WAREHOUSE_ARN],
    expected: { logIncludes: ['Shipment sent to the Leeds depot', 'warehouse/leeds-01'] },
  },
  {
    name: 'a Bristol shipment reaches dispatchShipment',
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DISPATCHED,
    detail: { orderRef: 'AB-2039', carrier: 'DPD', trackingRef: 'DPD5510092284' },
    resources: [BRISTOL_WAREHOUSE_ARN],
    expected: { logIncludes: ['Shipment sent to the carrier feed', '"carrier":"DPD"'] },
  },
  {
    name: 'a delayed shipment reaches dispatchShipment on its second detail type',
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DELAYED,
    detail: { orderRef: 'AB-2040', carrier: 'DPD', trackingRef: 'DPD5510092118' },
    expected: { logIncludes: ['Shipment sent to the carrier feed', `"detailType":"${SHIPMENT_DELAYED}"`] },
  },
  {
    name: 'a captured payment reaches settlePaymentLedger, which throws',
    source: PAYMENTS_SOURCE,
    detailType: PAYMENT_CAPTURED,
    detail: { orderRef: 'AB-2042', paymentRef: 'PAY-77120', amount: 4250 },
    expected: { errorIncludes: 'Ledger service unavailable for payment PAY-77120' },
  },
  {
    name: 'a legacy batch matches no route',
    source: LEGACY_SOURCE,
    detailType: BATCH_COMPLETED,
    detail: { batchId: 'NIGHTLY-2291', rows: 18_422 },
    expected: { errorIncludes: `No route matched for EventBridge event: ${LEGACY_SOURCE} / ${BATCH_COMPLETED}` },
  },
];

// Handlers report by logging, so the log is the only place a route match shows up.
async function runCapturingLogs(event: EventBridgeEventEnvelope): Promise<{ logged: string; error?: unknown }> {
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, debug, warn, error } = console;
  Object.assign(console, { log: collect, debug: collect, warn: collect, error: collect });

  try {
    await eventBridgeRouter.handleEvent(event, context);
    return { logged: lines.join('\n') };
  } catch (thrown) {
    return { logged: lines.join('\n'), error: thrown };
  } finally {
    Object.assign(console, { log, debug, warn, error });
  }
}

function problemsWith(logged: string, error: unknown, expected: Check['expected']): string[] {
  if (expected.errorIncludes) {
    if (error === undefined) return [`did not throw, logged ${logged.slice(0, 200)}`];
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(expected.errorIncludes) ? [] : [`threw ${message}`];
  }

  if (error !== undefined) return [`threw ${error instanceof Error ? error.message : String(error)}`];

  return (expected.logIncludes ?? [])
    .filter((fragment) => !logged.includes(fragment))
    .map((fragment) => `logged nothing containing ${fragment}`);
}

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const [index, check] of checks.entries()) {
  const { logged, error } = await runCapturingLogs(buildEvent(check, index));
  report(check.name, problemsWith(logged, error, check.expected));
}

const sampleEvent = buildEvent(checks[0] as Check, 0);

const claims: [string, boolean][] = [
  ['the router takes an EventBridge envelope', eventBridgeRouter.canHandleEvent(sampleEvent)],
  ['the router turns an SQS event away', !eventBridgeRouter.canHandleEvent({ Records: [] })],
  [
    'the router turns an envelope with no detail type away',
    !eventBridgeRouter.canHandleEvent({ source: 'ler.orders' }),
  ],
  [
    'the router turns an envelope whose detail is not an object away',
    !eventBridgeRouter.canHandleEvent({ source: 'ler.orders', 'detail-type': ORDER_PLACED, detail: 'AB-2041' }),
  ],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery event landed where it was meant to.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
