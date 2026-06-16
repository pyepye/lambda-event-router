import { setTimeout as sleep } from 'node:timers/promises';

import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

import { DECLINED_CARD_TOKEN } from '../src/config.js';

// Table ARNs come from the CDK outputs. Pass them as args or set the env vars.
const ordersTableArn = process.argv[2] ?? process.env.ORDERS_TABLE_ARN;
const searchIndexTableArn = process.argv[3] ?? process.env.SEARCH_INDEX_TABLE_ARN;

if (!(ordersTableArn && searchIndexTableArn)) {
  throw new Error('Usage: pnpm run write:items <ordersTableArn> <searchIndexTableArn>');
}

// A DynamoDB client with no region fails at the point of use, so take the region from the ARN rather
// than hoping the shell has one set. The ARN carries the table name as well.
function parseTableArn(arn: string): { region: string; tableName: string } {
  const parts = arn.split(':');
  const region = parts[3];
  const resource = parts[5];
  const tableName = resource?.startsWith('table/') ? resource.slice('table/'.length) : undefined;

  if (parts[2] !== 'dynamodb' || !region || !tableName) {
    throw new Error(
      `Cannot read a region and table name from "${arn}". Expected arn:aws:dynamodb:<region>:<account>:table/<name>.`,
    );
  }

  return { region, tableName };
}

const orders = parseTableArn(ordersTableArn);
const searchIndex = parseTableArn(searchIndexTableArn);

const client = new DynamoDBClient({ region: orders.region });

// A failing batch holds its shard until Lambda has retried it and given up. Each later group waits that
// out, so every failure lands in a batch of its own and gets an error line of its own.
const SHARD_CLEAR_MS = 20_000;

// Fresh keys per run, so every write below is an INSERT however many times the script runs.
const runId = Date.now().toString(36);
const orderPk = `ORDER#${runId}-1`;
const strandedOrderPk = `ORDER#${runId}-2`;
const invalidOrderPk = `ORDER#${runId}-3`;
const customerPk = `CUSTOMER#${runId}`;
const supplierPk = `SUPPLIER#${runId}`;

function put(tableName: string, item: Record<string, unknown>): Promise<unknown> {
  return client.send(new PutItemCommand({ TableName: tableName, Item: marshall(item) }));
}

function remove(tableName: string, pk: string, sk: string): Promise<unknown> {
  return client.send(new DeleteItemCommand({ TableName: tableName, Key: marshall({ pk, sk }) }));
}

// `tags` is a Set and `total` is a number, so the stream record carries an SS and an N. Both survive
// unmarshalling as themselves, which is what OrderSchema checks.
function order(pk: string, status: 'placed' | 'packed' | 'shipped', note?: string): Record<string, unknown> {
  return {
    pk,
    sk: 'SUMMARY',
    customer: 'ada@example.com',
    total: 42.5,
    status,
    tags: new Set(['gift', 'fragile']),
    ...(note === undefined ? {} : { note }),
  };
}

function payment(pk: string, paymentRef: string, cardToken: string): Record<string, unknown> {
  return { pk, sk: `PAYMENT#${paymentRef}`, amount: 42.5, cardToken };
}

function customer(email: string, marketingOptIn: boolean): Record<string, unknown> {
  return { pk: customerPk, sk: 'PROFILE', email, marketingOptIn };
}

// Eight writes in a row. A stream shard covers one set of partition keys, so these spread over a few
// invocations rather than one. Seven are handled and the eighth matches no route. It goes last, because
// a failure discards every record behind it on its own shard.
console.log(`Run ${runId}: writing the orders group`);
await put(orders.tableName, order(orderPk, 'placed'));
await put(orders.tableName, payment(orderPk, 'ch_9f21', 'tok_visa'));
await put(orders.tableName, customer('ada@example.com', true));
await put(orders.tableName, order(orderPk, 'shipped'));
await put(orders.tableName, order(orderPk, 'shipped', 'Leave with the neighbour'));
await put(orders.tableName, customer('ada@example.net', false));
await remove(orders.tableName, orderPk, 'SUMMARY');
await put(orders.tableName, { pk: supplierPk, sk: 'PROFILE', name: 'Sheffield Steel' });

// The search index is a second table, so it has its own shard and its own invocation. Nothing here
// fails, and the three writes leave the table empty again.
console.log('Writing the search index group');
await put(searchIndex.tableName, { pk: 'PRODUCT#SKU-77', sk: 'LISTING', title: 'Cast iron pan' });
await put(searchIndex.tableName, { pk: 'PRODUCT#SKU-77', sk: 'LISTING', title: 'Cast iron pan, 24cm' });
await remove(searchIndex.tableName, 'PRODUCT#SKU-77', 'LISTING');

await sleep(SHARD_CLEAR_MS);

// A payment whose sort key carries no reference. It still matches chargeCard's `PAYMENT#*` filter, and
// fails PaymentKeysSchema.
console.log('Writing the payment with a malformed key');
await put(orders.tableName, payment(orderPk, '', 'tok_visa'));

await sleep(SHARD_CLEAR_MS);

// A declined card, then a valid order behind it. Both carry the same partition key, so they share a
// shard and reach one invocation in that order. The handler throws on the first, so the second is
// discarded with it and never reaches processOrder.
console.log('Writing the declined payment and the order behind it');
await put(orders.tableName, payment(strandedOrderPk, 'ch_declined', DECLINED_CARD_TOKEN));
await put(orders.tableName, order(strandedOrderPk, 'placed'));

await sleep(SHARD_CLEAR_MS);

// An order with no total. It reaches processOrder and fails OrderSchema on the new image.
console.log('Writing the order with no total');
await put(orders.tableName, {
  pk: invalidOrderPk,
  sk: 'SUMMARY',
  customer: 'ada@example.com',
  status: 'placed',
  tags: new Set(['gift']),
});

await sleep(SHARD_CLEAR_MS);

// Deleting that same order sends the invalid image to archiveOrder as an old image instead.
console.log('Deleting the order with no total');
await remove(orders.tableName, invalidOrderPk, 'SUMMARY');

console.log(`Run ${runId} done. 13 writes on the orders table and 3 on the search index.`);
