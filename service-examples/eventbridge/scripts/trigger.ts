import { EventBridgeClient, PutEventsCommand, type PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';

import {
  BATCH_COMPLETED,
  BRISTOL_WAREHOUSE_ARN,
  EVENT_BUS_NAME,
  LEEDS_WAREHOUSE_ARN,
  LEGACY_SOURCE,
  ORDER_PLACED,
  ORDER_UPDATED,
  ORDERS_SOURCE,
  PAYMENT_CAPTURED,
  PAYMENTS_SOURCE,
  SHIPMENT_DELAYED,
  SHIPMENT_DISPATCHED,
  SHIPPING_SOURCE,
} from '../src/config.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in.');
}

const eventBridgeClient = new EventBridgeClient({ region });

interface Publication {
  source: string;
  detailType: string;
  detail: unknown;
  resources?: string[];
}

function entry({ source, detailType, detail, resources }: Publication): PutEventsRequestEntry {
  return {
    EventBusName: EVENT_BUS_NAME,
    Source: source,
    DetailType: detailType,
    Detail: JSON.stringify(detail),
    ...(resources && { Resources: resources }),
  };
}

// One PutEvents call carrying every path. EventBridge splits the entries into one invocation each,
// so the batch is a convenience rather than something the worker ever sees.
const publications: Publication[] = [
  {
    // flagHighValueOrder. 249900 pence clears the review threshold, so the custom filter takes this
    // before processOrder gets a look.
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2041', customerId: 'CU-882', amount: 249_900, currency: 'GBP' },
  },
  {
    // processOrder. Below the threshold, so the custom filter turns it down and the next route takes it.
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2042', customerId: 'CU-114', amount: 4250, currency: 'GBP' },
  },
  {
    // Reaches processOrder, then fails OrderPlacedSchema because amount is missing.
    source: ORDERS_SOURCE,
    detailType: ORDER_PLACED,
    detail: { orderRef: 'AB-2043', customerId: 'CU-117', currency: 'GBP' },
  },
  {
    // updateOrder. EventBridge stamps this account and region on the event, so the two narrower
    // routes ahead of it both turn it down.
    source: ORDERS_SOURCE,
    detailType: ORDER_UPDATED,
    detail: { orderRef: 'AB-2042', status: 'packed' },
  },
  {
    // routeToLeedsWarehouse, picked out by the warehouse ARN alone.
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DISPATCHED,
    detail: { orderRef: 'AB-2042', carrier: 'Royal Mail', trackingRef: 'RM884120041GB' },
    resources: [LEEDS_WAREHOUSE_ARN],
  },
  {
    // dispatchShipment. Same source and detail type, a warehouse the resource filter does not match.
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DISPATCHED,
    detail: { orderRef: 'AB-2039', carrier: 'DPD', trackingRef: 'DPD5510092284' },
    resources: [BRISTOL_WAREHOUSE_ARN],
  },
  {
    // dispatchShipment again, this time on the second detail type in its list.
    source: SHIPPING_SOURCE,
    detailType: SHIPMENT_DELAYED,
    detail: { orderRef: 'AB-2040', carrier: 'DPD', trackingRef: 'DPD5510092118' },
  },
  {
    // settlePaymentLedger throws, so this failure comes from the handler rather than from a schema.
    source: PAYMENTS_SOURCE,
    detailType: PAYMENT_CAPTURED,
    detail: { orderRef: 'AB-2042', paymentRef: 'PAY-77120', amount: 4250 },
  },
  {
    // On the rule's source list and claimed by no route at all.
    source: LEGACY_SOURCE,
    detailType: BATCH_COMPLETED,
    detail: { batchId: 'NIGHTLY-2291', rows: 18_422 },
  },
];

const result = await eventBridgeClient.send(new PutEventsCommand({ Entries: publications.map(entry) }));

const rejected = (result.Entries ?? []).filter((published) => published.ErrorCode);
for (const failure of rejected) {
  console.log(`Rejected: ${failure.ErrorCode} ${failure.ErrorMessage}`);
}

console.log(`Put ${publications.length} events on ${EVENT_BUS_NAME}, ${result.FailedEntryCount ?? 0} rejected.`);

if ((result.FailedEntryCount ?? 0) > 0) process.exitCode = 1;
