import {
  type MessageAttributeValue,
  PublishBatchCommand,
  type PublishBatchRequestEntry,
  SNSClient,
} from '@aws-sdk/client-sns';

// Topic ARNs come from the CDK outputs. Pass them as args or set the env vars.
const ordersTopicArn = process.argv[2] ?? process.env.ORDERS_TOPIC_ARN;
const inventoryTopicArn = process.argv[3] ?? process.env.INVENTORY_TOPIC_ARN;

if (!(ordersTopicArn && inventoryTopicArn)) {
  throw new Error('Usage: pnpm run publish:messages <ordersTopicArn> <inventoryTopicArn>');
}

// An SNS client with no region fails at the point of use, so take the region from the ARN rather than
// hoping the shell has one set.
function regionFromTopicArn(arn: string): string {
  const region = arn.split(':')[3];
  if (!region) {
    throw new Error(`Cannot read a region from "${arn}". Expected arn:aws:sns:<region>:<account>:<topic>.`);
  }
  return region;
}

const snsClient = new SNSClient({ region: regionFromTopicArn(ordersTopicArn) });

function stringAttribute(value: string): MessageAttributeValue {
  return { DataType: 'String', StringValue: value };
}

function numberAttribute(value: number): MessageAttributeValue {
  return { DataType: 'Number', StringValue: String(value) };
}

function stringArrayAttribute(values: string[]): MessageAttributeValue {
  return { DataType: 'String.Array', StringValue: JSON.stringify(values) };
}

// Hex in, hex out. The handler logs the Buffer back as hex, so the published value is readable in the
// log rather than needing decoding.
function binaryAttribute(hex: string): MessageAttributeValue {
  return { DataType: 'Binary', BinaryValue: Buffer.from(hex, 'hex') };
}

function order(orderId: string, total: number, shippingSpeed: 'standard' | 'express'): string {
  return JSON.stringify({ orderId, customer: 'ada@example.com', total, shippingSpeed });
}

const orderEntries: PublishBatchRequestEntry[] = [
  {
    // processOrder. Carries one attribute of each SNS type, so the handler can log what the router
    // decoded them to.
    Id: 'order-placed',
    Subject: 'Order placed',
    MessageAttributes: {
      eventType: stringAttribute('OrderPlaced'),
      priority: numberAttribute(2),
      warehouses: stringArrayAttribute(['london', 'manchester']),
      checksum: binaryAttribute('7f3a'),
    },
    Message: order('ord-1001', 42.5, 'standard'),
  },
  {
    // expediteOrder. Matches processOrder's eventType filter too, but the custom body filter is
    // registered first and wins.
    Id: 'order-express',
    Subject: 'Order placed',
    MessageAttributes: { eventType: stringAttribute('OrderPlaced'), priority: numberAttribute(1) },
    Message: order('ord-1002', 99, 'express'),
  },
  {
    // cancelOrder. No message attributes at all, so the subject is the only thing that can match it.
    Id: 'order-cancelled',
    Subject: 'Order cancelled',
    Message: JSON.stringify({ orderId: 'ord-1001', reason: 'Customer changed their mind' }),
  },
  {
    // chargeCard throws, so this failure comes from the handler rather than from a schema.
    Id: 'payment-requested',
    Subject: 'Payment requested',
    MessageAttributes: { eventType: stringAttribute('PaymentRequested') },
    Message: JSON.stringify({ orderId: 'ord-1002', amount: 99, cardLast4: '4242' }),
  },
  {
    // Reaches processOrder, then fails OrderSchema because total is missing.
    Id: 'order-missing-total',
    Subject: 'Order placed',
    MessageAttributes: { eventType: stringAttribute('OrderPlaced'), priority: numberAttribute(3) },
    Message: JSON.stringify({ orderId: 'ord-1003', customer: 'ada@example.com' }),
  },
  {
    // Reaches processOrder, then fails OrderAttributesSchema because priority will not coerce.
    Id: 'order-bad-priority',
    Subject: 'Order placed',
    MessageAttributes: { eventType: stringAttribute('OrderPlaced'), priority: stringAttribute('soon') },
    Message: order('ord-1004', 12, 'standard'),
  },
  {
    // Not JSON, so the body reaches OrderSchema as a raw string and fails.
    Id: 'order-not-json',
    Subject: 'Order placed',
    MessageAttributes: { eventType: stringAttribute('OrderPlaced'), priority: numberAttribute(4) },
    Message: 'this is not json',
  },
  {
    // No subject, no attributes and not express, so no route matches at all.
    Id: 'order-unroutable',
    Message: order('ord-1005', 7.25, 'standard'),
  },
];

const inventoryEntries: PublishBatchRequestEntry[] = [
  {
    // reserveStock. schemaVersion matches the number 2, and warehouses matches on its second member.
    Id: 'stock-reserved',
    MessageAttributes: {
      schemaVersion: numberAttribute(2),
      warehouses: stringArrayAttribute(['london', 'manchester']),
    },
    Message: JSON.stringify({ sku: 'SKU-77', orderId: 'ord-1001', quantity: 3 }),
  },
  {
    // Same shape on version 1, so the numeric filter rejects it and no route matches.
    Id: 'stock-legacy',
    MessageAttributes: {
      schemaVersion: numberAttribute(1),
      warehouses: stringArrayAttribute(['london', 'manchester']),
    },
    Message: JSON.stringify({ sku: 'SKU-77', orderId: 'ord-1005', quantity: 1 }),
  },
];

await snsClient.send(new PublishBatchCommand({ TopicArn: ordersTopicArn, PublishBatchRequestEntries: orderEntries }));
await snsClient.send(
  new PublishBatchCommand({ TopicArn: inventoryTopicArn, PublishBatchRequestEntries: inventoryEntries }),
);

console.log(`Published ${orderEntries.length} order messages and ${inventoryEntries.length} inventory messages.`);
