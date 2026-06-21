import { randomUUID } from 'node:crypto';

import { logger } from '@lambda-event-router/base';
import { ObjectId } from 'mongodb';

import { COLLECTIONS, DATABASES } from '../utils/cluster.js';
import { connectToCluster } from './mongoClient.js';

interface SeedResult {
  runId: string;
}

// Writes every change the router has a route for, plus the five that are meant to fail. Each group
// goes in one run of writes so its event source mapping batches them into a single invocation, which
// is the only way ordering and a failure taking out the changes behind it are visible.
export async function handler(): Promise<SeedResult> {
  const client = await connectToCluster();
  const runId = randomUUID().slice(0, 8);

  const storefront = client.db(DATABASES.storefront);
  const catalogue = client.db(DATABASES.catalogue);
  const fulfilment = client.db(DATABASES.fulfilment);

  const orders = storefront.collection(COLLECTIONS.orders);
  const orderId = new ObjectId();

  await orders.insertOne({
    _id: orderId,
    reference: `ORD-${runId}-1`,
    customer: 'ada@example.com',
    total: '129.50',
    status: 'placed',
    itemCount: 3,
    placedAt: new Date(),
  });
  await orders.insertOne({
    _id: new ObjectId(),
    reference: `ORD-${runId}-2`,
    customer: 'grace@example.com',
    total: '742.00',
    status: 'placed',
    itemCount: 11,
    placedAt: new Date(),
  });
  await orders.updateOne(
    { _id: orderId },
    { $set: { status: 'discounted', total: '110.00' }, $unset: { itemCount: '' } },
  );
  await orders.replaceOne(
    { _id: orderId },
    { reference: `ORD-${runId}-1`, customer: 'ada@example.com', total: '110.00', status: 'confirmed' },
  );

  // UpdateLookup reads the document when the change is polled rather than when it changed, so an
  // order the run deletes has no document to look up and every update behind it fails validation.
  // The withdrawn order carries the delete instead.
  const withdrawnOrderId = new ObjectId();

  await orders.insertOne({
    _id: withdrawnOrderId,
    reference: `ORD-${runId}-3`,
    customer: 'alan@example.com',
    total: '18.00',
    status: 'placed',
    itemCount: 1,
    placedAt: new Date(),
  });
  await orders.deleteOne({ _id: withdrawnOrderId });

  const invoices = storefront.collection(COLLECTIONS.invoices);
  const invoiceId = new ObjectId();

  await invoices.insertOne({ _id: invoiceId, orderReference: `ORD-${runId}-2`, amount: '742.00' });
  await invoices.replaceOne({ _id: invoiceId }, { orderReference: `ORD-${runId}-2`, amount: '700.00' });

  const products = catalogue.collection(COLLECTIONS.products);
  const productId = new ObjectId();

  await products.insertOne({ _id: productId, sku: `WOOL-${runId}`, name: 'Wool scarf', price: '24.00' });
  await products.updateOne({ _id: productId }, { $set: { price: '19.00' } });

  // capturePayment throws on the first of these, so the two behind it never run.
  await fulfilment.collection(COLLECTIONS.payments).insertMany([
    { orderReference: `ORD-${runId}-1`, amount: '110.00' },
    { orderReference: `ORD-${runId}-2`, amount: '700.00' },
    { orderReference: `ORD-${runId}-3`, amount: '18.00' },
  ]);

  // No carrier, so ShipmentSchema rejects the document.
  await fulfilment
    .collection(COLLECTIONS.shipments)
    .insertOne({ orderReference: `ORD-${runId}-1`, service: 'next-day' });

  // A stock level is keyed on its SKU rather than an ObjectId, so documentKey arrives as a plain
  // string and DocumentKeySchema rejects it. The run id keeps a repeat run from colliding on the key.
  await fulfilment
    .collection<{ _id: string; onHand: number }>(COLLECTIONS.stockLevels)
    .insertOne({ _id: `WOOL-${runId}`, onHand: 42 });

  const priceHistory = fulfilment.collection(COLLECTIONS.priceHistory);
  const priceId = new ObjectId();

  await priceHistory.insertOne({ _id: priceId, sku: `WOOL-${runId}`, price: '24.00' });
  await priceHistory.updateOne({ _id: priceId }, { $set: { price: '19.00' } });

  // Nothing routes a carrier webhook.
  await fulfilment.collection(COLLECTIONS.carrierWebhooks).insertOne({ carrier: 'royal-mail', status: 'delivered' });

  logger.info({ message: 'Seed run written', runId });

  return { runId };
}
