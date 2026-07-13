import type { KafkaMSKEvent, KafkaRecord, KafkaRecordHeader } from '@lambda-event-router/kafka';
import type { Context } from 'aws-lambda';

import {
  CAPTURE_KIND,
  EVENT_TYPE_HEADER,
  FAILED_RECORDS_TOPIC,
  ORDER_CANCELLED,
  ORDER_CREATED,
  ORDERS_TOPIC,
  PAYMENT_KIND_HEADER,
  PAYMENTS_TOPIC,
  PRIORITY_HEADER,
  REFUND_KIND,
  URGENT_PRIORITY,
  WORKER_FUNCTION_NAME,
} from '../src/config.js';

const REGION = 'eu-west-2';
const ACCOUNT = '123456789012';
const CLUSTER_ARN = `arn:aws:kafka:${REGION}:${ACCOUNT}:cluster/ler-example-kafka-cluster/11112222-3333-4444-5555-666677778888-1`;
const BROKER_ONE = `b-1.lerexamplekafka.a1b2c3.c2.kafka.${REGION}.amazonaws.com:9092`;
const BROKER_TWO = `b-2.lerexamplekafka.a1b2c3.c2.kafka.${REGION}.amazonaws.com:9092`;
const BOOTSTRAP_SERVERS = `${BROKER_ONE},${BROKER_TWO}`;

// environment.ts reads the cluster ARN and the broker list once, at import, and throws when either is
// missing. The logger builds itself on the first call. Both have to be settled before the router loads.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
process.env.CLUSTER_ARN = CLUSTER_ARN;
process.env.BOOTSTRAP_SERVERS = BOOTSTRAP_SERVERS;

const { kafkaRouter } = await import('../src/kafka.js');

const context = {
  functionName: WORKER_FUNCTION_NAME,
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:${WORKER_FUNCTION_NAME}`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

// Kafka carries bytes. Lambda base64 encodes the key and the value, and sends each header as its own
// object of raw bytes.
function encodeHeaders(headers: Record<string, string>): KafkaRecordHeader[] {
  return Object.entries(headers).map(([key, value]) => ({ [key]: Array.from(Buffer.from(value, 'utf-8')) }));
}

function encode(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

interface RecordOptions {
  topic: string;
  partition: number;
  offset: number;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

function record(options: RecordOptions): KafkaRecord {
  return {
    topic: options.topic,
    partition: options.partition,
    offset: options.offset,
    timestamp: 1_745_000_000_000,
    timestampType: 'CREATE_TIME',
    key: options.key === undefined ? null : encode(options.key),
    value: encode(options.value),
    headers: encodeHeaders(options.headers ?? {}),
  };
}

interface EventOptions {
  topic: string;
  partition: number;
  records: KafkaRecord[];
  eventSourceArn?: string;
  bootstrapServers?: string;
}

function event(options: EventOptions): KafkaMSKEvent {
  return {
    eventSource: 'aws:kafka',
    eventSourceArn: options.eventSourceArn ?? CLUSTER_ARN,
    bootstrapServers: options.bootstrapServers ?? BOOTSTRAP_SERVERS,
    records: { [`${options.topic}-${options.partition}`]: options.records },
  };
}

function order(orderId: string, total: number | undefined): string {
  return JSON.stringify({ orderId, customerId: 'cust-77', total, currency: 'GBP' });
}

function payment(paymentId: string): string {
  return JSON.stringify({ paymentId, orderId: 'order-1001', amount: 42.5, method: 'card' });
}

const failureEnvelope = JSON.stringify({
  requestContext: { condition: 'RetriesExhausted', approximateInvokeCount: 3 },
  KafkaBatchInfo: { eventSourceArn: CLUSTER_ARN, batchSize: 1 },
  payload: { records: {} },
});

interface Expectation {
  logIncludes?: string[];
  logExcludes?: string[];
  failures?: Array<{ partition: string; offset: number }>;
}

interface Check {
  name: string;
  event: KafkaMSKEvent;
  expected: Expectation;
}

const checks: Check[] = [
  {
    name: 'a created order reaches processOrder through its route middleware',
    event: event({
      topic: ORDERS_TOPIC,
      partition: 0,
      records: [
        record({
          topic: ORDERS_TOPIC,
          partition: 0,
          offset: 0,
          key: 'order-1001',
          value: order('order-1001', 42.5),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        }),
      ],
    }),
    expected: {
      logIncludes: ['Handling Kafka record', 'Order context resolved', 'Order processed', 'order-1001'],
      failures: [],
    },
  },
  {
    name: 'an urgent order reaches escalateUrgentOrder rather than processOrder',
    event: event({
      topic: ORDERS_TOPIC,
      partition: 0,
      records: [
        record({
          topic: ORDERS_TOPIC,
          partition: 0,
          offset: 1,
          key: 'order-1002',
          value: order('order-1002', 980),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED, [PRIORITY_HEADER]: URGENT_PRIORITY },
        }),
      ],
    }),
    expected: {
      logIncludes: ['Urgent order escalated', 'order-1002'],
      logExcludes: ['Order processed'],
      failures: [],
    },
  },
  {
    name: 'two good records on one partition report no failures',
    event: event({
      topic: PAYMENTS_TOPIC,
      partition: 0,
      records: [
        record({
          topic: PAYMENTS_TOPIC,
          partition: 0,
          offset: 0,
          key: 'pay-5001',
          value: payment('pay-5001'),
          headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        }),
        record({
          topic: PAYMENTS_TOPIC,
          partition: 0,
          offset: 1,
          key: 'pay-5002',
          value: payment('pay-5002'),
          headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        }),
      ],
    }),
    expected: { logIncludes: ['Payment captured', 'pay-5001', 'pay-5002'], failures: [] },
  },
  {
    name: 'a payment with no key and no headers reaches capturePayment',
    event: event({
      topic: PAYMENTS_TOPIC,
      partition: 0,
      records: [record({ topic: PAYMENTS_TOPIC, partition: 0, offset: 2, value: payment('pay-5005') })],
    }),
    expected: { logIncludes: ['Payment captured', 'pay-5005'], logExcludes: ['"key"'], failures: [] },
  },
  {
    name: 'an order with no total fails its schema and takes the record behind it',
    event: event({
      topic: ORDERS_TOPIC,
      partition: 1,
      records: [
        record({
          topic: ORDERS_TOPIC,
          partition: 1,
          offset: 0,
          key: 'order-1003',
          value: order('order-1003', undefined),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        }),
        record({
          topic: ORDERS_TOPIC,
          partition: 1,
          offset: 1,
          key: 'order-1004',
          value: order('order-1004', 15),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        }),
      ],
    }),
    expected: {
      logIncludes: ['Value validation failed'],
      logExcludes: ['order-1004'],
      failures: [
        { partition: `${ORDERS_TOPIC}-1`, offset: 0 },
        { partition: `${ORDERS_TOPIC}-1`, offset: 1 },
      ],
    },
  },
  {
    name: 'a cancelled order matches no route',
    event: event({
      topic: ORDERS_TOPIC,
      partition: 2,
      records: [
        record({
          topic: ORDERS_TOPIC,
          partition: 2,
          offset: 0,
          key: 'order-1005',
          value: order('order-1005', 60),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CANCELLED },
        }),
      ],
    }),
    expected: {
      logIncludes: ['No route matched'],
      logExcludes: ['Handling Kafka record'],
      failures: [{ partition: `${ORDERS_TOPIC}-2`, offset: 0 }],
    },
  },
  {
    name: 'a refund throws inside refundPayment after its middleware has run',
    event: event({
      topic: PAYMENTS_TOPIC,
      partition: 1,
      records: [
        record({
          topic: PAYMENTS_TOPIC,
          partition: 1,
          offset: 0,
          key: 'pay-5003',
          value: payment('pay-5003'),
          headers: { [PAYMENT_KIND_HEADER]: REFUND_KIND },
        }),
      ],
    }),
    expected: {
      logIncludes: ['Handling Kafka record', 'Refund gateway unavailable for payment pay-5003'],
      failures: [{ partition: `${PAYMENTS_TOPIC}-1`, offset: 0 }],
    },
  },
  {
    name: 'a payment that is not JSON fails PaymentSchema',
    event: event({
      topic: PAYMENTS_TOPIC,
      partition: 2,
      records: [
        record({
          topic: PAYMENTS_TOPIC,
          partition: 2,
          offset: 0,
          key: 'pay-5004',
          value: 'this is not json',
          headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        }),
      ],
    }),
    expected: {
      logIncludes: ['Value validation failed'],
      failures: [{ partition: `${PAYMENTS_TOPIC}-2`, offset: 0 }],
    },
  },
  {
    name: "Lambda's failure envelope reaches quarantineFailedRecord",
    event: event({
      topic: FAILED_RECORDS_TOPIC,
      partition: 0,
      records: [
        record({
          topic: FAILED_RECORDS_TOPIC,
          partition: 0,
          offset: 0,
          key: 'order-1003',
          value: failureEnvelope,
        }),
      ],
    }),
    expected: { logIncludes: ['Failed record quarantined', 'RetriesExhausted'], failures: [] },
  },
  {
    name: 'a created order from another cluster matches no route',
    event: event({
      topic: ORDERS_TOPIC,
      partition: 0,
      eventSourceArn: `arn:aws:kafka:${REGION}:${ACCOUNT}:cluster/somebody-else/99998888-7777-6666-5555-444433332222-1`,
      records: [
        record({
          topic: ORDERS_TOPIC,
          partition: 0,
          offset: 9,
          key: 'order-1006',
          value: order('order-1006', 30),
          headers: { [EVENT_TYPE_HEADER]: ORDER_CREATED },
        }),
      ],
    }),
    expected: {
      logIncludes: ['No route matched'],
      failures: [{ partition: `${ORDERS_TOPIC}-0`, offset: 9 }],
    },
  },
  {
    name: 'a capture from another broker matches no route',
    event: event({
      topic: PAYMENTS_TOPIC,
      partition: 0,
      bootstrapServers: 'b-1.somebody-else.a1b2c3.c2.kafka.eu-west-2.amazonaws.com:9092',
      records: [
        record({
          topic: PAYMENTS_TOPIC,
          partition: 0,
          offset: 9,
          key: 'pay-5005',
          value: payment('pay-5005'),
          headers: { [PAYMENT_KIND_HEADER]: CAPTURE_KIND },
        }),
      ],
    }),
    expected: {
      logIncludes: ['No route matched'],
      failures: [{ partition: `${PAYMENTS_TOPIC}-0`, offset: 9 }],
    },
  },
];

async function runCapturingLogs(kafkaEvent: KafkaMSKEvent): Promise<{ logged: string; failures: string }> {
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, debug, warn, error } = console;
  Object.assign(console, { log: collect, debug: collect, warn: collect, error: collect });

  try {
    const result = await kafkaRouter.handleEvent(kafkaEvent, context);
    const reported = (result?.batchItemFailures ?? []).map((failure) => failure.itemIdentifier);
    return { logged: lines.join('\n'), failures: JSON.stringify(reported) };
  } finally {
    Object.assign(console, { log, debug, warn, error });
  }
}

function problemsWith(logged: string, failures: string, expected: Expectation): string[] {
  const problems: string[] = [];

  problems.push(
    ...(expected.logIncludes ?? [])
      .filter((fragment) => !logged.includes(fragment))
      .map((fragment) => `logged nothing containing ${fragment}`),
  );

  problems.push(
    ...(expected.logExcludes ?? [])
      .filter((fragment) => logged.includes(fragment))
      .map((fragment) => `logged ${fragment}, which it should not have`),
  );

  if (expected.failures) {
    const wanted = JSON.stringify(expected.failures);
    if (failures !== wanted) {
      problems.push(`reported ${failures} rather than ${wanted}`);
    }
  }

  return problems;
}

const failed: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failed.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const check of checks) {
  const { logged, failures } = await runCapturingLogs(check.event);
  report(check.name, problemsWith(logged, failures, check.expected));
}

const anyOrder = checks[0]?.event as KafkaMSKEvent;

const claims: [string, boolean][] = [
  ['the router takes an MSK event', kafkaRouter.canHandleEvent(anyOrder)],
  [
    'the router takes a self-managed Kafka event',
    kafkaRouter.canHandleEvent({ ...anyOrder, eventSource: 'SelfManagedKafka' }),
  ],
  ['the router turns an SQS event away', !kafkaRouter.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })],
  ['the router turns a bare string away', !kafkaRouter.canHandleEvent('aws:kafka')],
  ['the router turns an event with no records away', !kafkaRouter.canHandleEvent({ eventSource: 'aws:kafka' })],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failed.length === 0 ? '\nEvery record landed where it was meant to.' : `\n${failed.length} check(s) failed.`,
);

if (failed.length > 0) process.exitCode = 1;
