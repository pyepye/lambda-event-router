import type { Options } from 'amqplib';

import { readBrokerCredentials } from '../src/broker/credentials.js';
import { withRabbitMqChannel } from '../src/broker/rabbitMqClient.js';
import { publishToActiveMq, type StompMessage } from '../src/broker/stompClient.js';
import { ORDER_QUEUES, PAYMENT_QUEUES, SECRET_NAMES } from '../src/utils/brokers.js';

// Endpoints come from the CDK outputs. Pass them as args or set the env vars.
const stompEndpoint = process.argv[2] ?? process.env.ORDER_BROKER_STOMP_ENDPOINT;
const amqpEndpoint = process.argv[3] ?? process.env.PAYMENT_BROKER_AMQP_ENDPOINT;

if (!(stompEndpoint && amqpEndpoint)) {
  throw new Error('Usage: pnpm run publish <OrderBrokerStompEndpoint> <PaymentBrokerAmqpEndpoint>');
}

const JSON_CONTENT_TYPE = 'application/json';

// RabbitMQ has no redelivery limit, so Lambda retries a failing message until it expires. A minute is
// long enough to watch the retries and short enough that the next run starts on an empty queue.
const FAILURE_EXPIRY_MS = '60000';

// A shipping label is binary, so its first bytes are a PDF header rather than JSON.
const SHIPPING_LABEL = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])]);

interface AmqpMessage {
  queue: string;
  body: Buffer;
  options: Options.Publish;
}

function order(orderId: string, customer: string, total: string, currency = 'GBP'): Buffer {
  return Buffer.from(JSON.stringify({ orderId, customer, total, currency }));
}

function payment(paymentId: string, orderId: string, amount: string, method = 'card'): Buffer {
  return Buffer.from(JSON.stringify({ paymentId, orderId, amount, method }));
}

// One batch per queue. Several messages in a single invocation is the only way to see ordering and
// the way one failure takes the rest of its batch with it.
const activeMqMessages: StompMessage[] = [
  {
    // processOrder. total is published as a string, so the schema is what makes it a number.
    destination: ORDER_QUEUES.events,
    headers: { orderPriority: 'standard' },
    body: order('O-1001', 'Ada Lovelace', '129.50'),
  },
  {
    // escalateUrgentOrder. A STOMP header arrives as a JMS property, which is what the custom filter
    // reads. It matches the text route too, but the escalation route is registered first.
    destination: ORDER_QUEUES.events,
    headers: { orderPriority: 'urgent' },
    body: order('O-1002', 'Grace Hopper', '4800.00'),
  },
  {
    // archiveOrderLabel. content-length is what makes this a bytes message.
    destination: ORDER_QUEUES.events,
    headers: { labelFor: 'O-1001' },
    body: SHIPPING_LABEL,
    binary: true,
  },
  {
    // processOrder again, so one batch holds two messages for the same route.
    destination: ORDER_QUEUES.events,
    headers: { orderPriority: 'standard' },
    body: order('O-1003', 'Alan Turing', '62.00'),
  },
  {
    // Reaches quarantineOrder, then fails OrderSchema because currency is missing.
    destination: ORDER_QUEUES.invalid,
    body: Buffer.from(JSON.stringify({ orderId: 'O-9001', customer: 'Ada Lovelace', total: '15.00' })),
  },
  {
    // Reaches quarantineOrder and the handler throws.
    destination: ORDER_QUEUES.invalid,
    body: order('O-9002', 'Grace Hopper', '15.00'),
  },
  {
    // A bytes message on a queue whose only route is pinned to text, so no route matches.
    destination: ORDER_QUEUES.invalid,
    body: SHIPPING_LABEL,
    binary: true,
  },
];

const paymentMessages: AmqpMessage[] = [
  {
    // capturePayment.
    queue: PAYMENT_QUEUES.events,
    body: payment('P-2001', 'O-1001', '129.50'),
    options: { contentType: JSON_CONTENT_TYPE },
  },
  {
    // settleHighValuePayment. Priority 7 clears the custom filter's threshold of 5, and the route is
    // registered ahead of capturePayment so it wins on the same queue.
    queue: PAYMENT_QUEUES.events,
    body: payment('P-2002', 'O-1002', '4800.00', 'bank-transfer'),
    options: { contentType: JSON_CONTENT_TYPE, priority: 7 },
  },
  {
    // recordPaymentNote. text/plain misses the JSON route, and the body is not JSON, so the handler
    // receives the raw string.
    queue: PAYMENT_QUEUES.events,
    body: Buffer.from('Chargeback window closes on 2026-10-01'),
    options: { contentType: 'text/plain' },
  },
  {
    // capturePayment again, so one batch holds two messages for the same route.
    queue: PAYMENT_QUEUES.events,
    body: payment('P-2003', 'O-1003', '62.00'),
    options: { contentType: JSON_CONTENT_TYPE },
  },
  {
    // recordPaymentReceipt.
    queue: PAYMENT_QUEUES.receipts,
    body: payment('R-3001', 'O-1001', '129.50'),
    options: { contentType: JSON_CONTENT_TYPE },
  },
  {
    // Reaches holdPaymentForReview, then fails PaymentSchema because method is missing.
    queue: PAYMENT_QUEUES.invalid,
    body: Buffer.from(JSON.stringify({ paymentId: 'P-9001', orderId: 'O-9001', amount: '15.00' })),
    options: { contentType: JSON_CONTENT_TYPE, expiration: FAILURE_EXPIRY_MS },
  },
  {
    // Reaches holdPaymentForReview and the handler throws.
    queue: PAYMENT_QUEUES.reviews,
    body: payment('P-9002', 'O-9002', '15.00'),
    options: { contentType: JSON_CONTENT_TYPE, expiration: FAILURE_EXPIRY_MS },
  },
  {
    // No content type, so recordPaymentReceipt cannot match and no route does.
    queue: PAYMENT_QUEUES.receipts,
    body: payment('R-9003', 'O-9003', '15.00'),
    options: { expiration: FAILURE_EXPIRY_MS },
  },
];

const orderCredentials = await readBrokerCredentials(SECRET_NAMES.orderBroker);
await publishToActiveMq(stompEndpoint, orderCredentials.username, orderCredentials.password, activeMqMessages);

const paymentCredentials = await readBrokerCredentials(SECRET_NAMES.paymentBroker);

await withRabbitMqChannel(amqpEndpoint, paymentCredentials.username, paymentCredentials.password, async (channel) => {
  for (const queue of Object.values(PAYMENT_QUEUES)) {
    await channel.assertQueue(queue, { durable: true });
  }

  for (const message of paymentMessages) {
    channel.sendToQueue(message.queue, message.body, message.options);
  }
});

console.log(`Published ${activeMqMessages.length} orders and ${paymentMessages.length} payments.`);
