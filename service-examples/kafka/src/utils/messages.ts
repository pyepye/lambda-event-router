import type { Message } from 'kafkajs';

import {
  CAPTURE_KIND,
  EVENT_TYPE_HEADER,
  ORDER_CANCELLED,
  ORDER_CREATED,
  ORDERS_TOPIC,
  PAYMENT_KIND_HEADER,
  PAYMENTS_TOPIC,
  PRIORITY_HEADER,
  REFUND_KIND,
  URGENT_PRIORITY,
} from '../config.js';

export interface MessageGroup {
  topic: string;
  messages: Message[];
}

function order(orderId: string, customerId: string, total: number): string {
  return JSON.stringify({ orderId, customerId, total, currency: 'GBP' });
}

function payment(paymentId: string, orderId: string, amount: number): string {
  return JSON.stringify({ paymentId, orderId, amount, method: 'card' });
}

// One send per topic, with the partition set on every message. Ordering and partial batch failures
// only show up when several records from one partition reach a single invocation, and letting Kafka
// pick the partition by key hash does not reliably produce that.
export const messageGroups: MessageGroup[] = [
  {
    topic: ORDERS_TOPIC,
    messages: [
      {
        // processOrder. Partition 0 carries nothing that fails, so both records run to completion.
        partition: 0,
        key: 'order-1001',
        headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        value: order('order-1001', 'cust-77', 42.5),
      },
      {
        // escalateUrgentOrder. This one matches processOrder's filters too, but the urgent route is
        // registered first and wins.
        partition: 0,
        key: 'order-1002',
        headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED, [PRIORITY_HEADER]: URGENT_PRIORITY },
        value: order('order-1002', 'cust-77', 980),
      },
      {
        // Reaches processOrder, then fails OrderSchema because there is no total.
        partition: 1,
        key: 'order-1003',
        headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        value: JSON.stringify({ orderId: 'order-1003', customerId: 'cust-91', currency: 'GBP' }),
      },
      {
        // Valid, and behind the failure on the same partition, so it never runs.
        partition: 1,
        key: 'order-1004',
        headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        value: order('order-1004', 'cust-91', 15),
      },
      {
        // A cancellation is neither urgent nor created, so no route matches it.
        partition: 2,
        key: 'order-1005',
        headers: { [EVENT_TYPE_HEADER]: ORDER_CANCELLED },
        value: order('order-1005', 'cust-12', 60),
      },
    ],
  },
  {
    topic: PAYMENTS_TOPIC,
    messages: [
      {
        // capturePayment, matched on the broker address.
        partition: 0,
        key: 'pay-5001',
        headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        value: payment('pay-5001', 'order-1001', 42.5),
      },
      {
        partition: 0,
        key: 'pay-5002',
        headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        value: payment('pay-5002', 'order-1002', 980),
      },
      {
        // No key and no headers, so the handler sees an undefined key and an empty header list.
        partition: 0,
        value: payment('pay-5005', 'order-1005', 12),
      },
      {
        // refundPayment throws, so this failure comes from the handler rather than from a schema.
        partition: 1,
        key: 'pay-5003',
        headers: { [PAYMENT_KIND_HEADER]: REFUND_KIND },
        value: payment('pay-5003', 'order-1001', 42.5),
      },
      {
        // Not JSON, so the value reaches PaymentSchema as a raw string and fails.
        partition: 2,
        key: 'pay-5004',
        headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        value: 'this is not json',
      },
    ],
  },
];
