import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockSchema, test } from '@lambda-event-router/testing';

import { createKafkaRouter, defineRoute, KafkaRouter } from './KafkaRouter.js';
import type { KafkaFilterInput, KafkaRequest } from './types.js';

type KafkaNext = (request: KafkaRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');
const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');

let router: KafkaRouter;

beforeEach(() => {
  router = new KafkaRouter();
});

suite('KafkaRouter', () => {
  suite('createKafkaRouter', () => {
    test('creates a KafkaRouter instance', () => {
      const router = createKafkaRouter();
      expect(router).toBeInstanceOf(KafkaRouter);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with handle method', () => {
      const builder = defineRoute({ filters: {} });
      expect(builder.handle).toBeTypeOf('function');
    });

    test('preserves filters, valueSchema, and handler in the definition', () => {
      const filters = { topic: 'orders' };
      const valueSchema = createMockSchema();
      const handler = async (): Promise<void> => {};

      const definition = defineRoute({ filters, valueSchema }).handle(handler);

      expect(definition.filters).toBe(filters);
      expect(definition.valueSchema).toBe(valueSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for valid MSK event', ({ kafkaMSKEvent }) => {
      const event = kafkaMSKEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for valid SelfManagedKafka event', ({ kafkaSelfManagedEvent }) => {
      const event = kafkaSelfManagedEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for wrong eventSource', () => {
      const event = { eventSource: 'aws:sqs', records: {} };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false when records is not an object', () => {
      const event = { eventSource: 'aws:kafka', records: 'not-an-object' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for non-object input', () => {
      expect(router.canHandleEvent('string')).toBe(false);
    });
  });

  suite('route', () => {
    test('returns router instance for chaining', () => {
      const result = router.route(defineRoute({ filters: {} }).handle(async () => {}));
      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches by topic filter', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(defineRoute({ filters: { topic: 'orders' } }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'orders' });
      const event = kafkaMSKEvent({ orders: [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('matches by topic filter array', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(defineRoute({ filters: { topic: ['orders', 'refunds'] } }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'orders' });
      const event = kafkaMSKEvent({ orders: [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('does not match when topic do not match', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(defineRoute({ filters: { topic: 'orders' } }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'users' });
      const event = kafkaMSKEvent({ users: [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeUndefined();
    });

    test('matches by eventSourceArn', async ({ kafkaRecord, kafkaMSKEvent }) => {
      const arn = 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123';
      router.route(defineRoute({ filters: { eventSourceArn: arn } }).handle(async () => {}));

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('matches by eventSourceArn array', async ({ kafkaRecord, kafkaMSKEvent }) => {
      const arn = 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123';
      const arn2 = 'arn:aws:kafka:eu-west-2:987654321098:cluster/OtherCluster/zxy-987';
      router.route(defineRoute({ filters: { eventSourceArn: [arn, arn2] } }).handle(async () => {}));

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('does not match when eventSourceArn do not match', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:kafka:us-east-1:000000000000:cluster/Other/xyz' },
        }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeUndefined();
    });

    test('does not match eventSourceArn filter for SelfManagedKafka event', async ({
      kafkaRecord,
      kafkaSelfManagedEvent,
    }) => {
      router.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123' },
        }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaSelfManagedEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeUndefined();
    });

    test('matches by bootstrapServer', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(defineRoute({ filters: { bootstrapServer: 'broker1.example.com:9092' } }).handle(async () => {}));

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('matches by bootstrapServer array', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({ filters: { bootstrapServer: ['broker1.example.com:9092', 'other9.example.com:9092'] } }).handle(
          async () => {},
        ),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('does not match when bootstrapServer do not match', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({ filters: { bootstrapServer: 'other-broker.example.com:9092' } }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeUndefined();
    });

    test('matches by customFilter', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({
          filters: { customFilter: ({ topic }: KafkaFilterInput): boolean => topic === 'test-topic' },
        }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeUndefined();
    });

    test('customFilter receives correct KafkaFilterInput', async ({ kafkaRecord, kafkaMSKEvent }) => {
      let receivedInput: KafkaFilterInput | undefined;
      router.route(
        defineRoute({
          filters: {
            customFilter: (input: KafkaFilterInput): boolean => {
              receivedInput = input;
              return true;
            },
          },
        }).handle(async () => {}),
      );

      const record = kafkaRecord({ topic: 'my-topic', headers: [{ 'x-custom': 'value' }] });
      const event = kafkaMSKEvent({ 'my-topic': [record] });

      // @ts-expect-error testing private method
      const decodedHeaders = router.decodeHeaders(record.headers);
      // @ts-expect-error testing private method
      await router.matchRoute(record, event, decodedHeaders);

      expect(receivedInput).toBeDefined();
      expect(receivedInput?.topic).toBe('my-topic');
      expect(receivedInput?.headers).toEqual([{ 'x-custom': 'value' }]);
      expect(receivedInput?.record).toBe(record);
    });

    test('customFilter is not called when preceding filter rejects', async ({ kafkaRecord, kafkaMSKEvent }) => {
      const customFilter = vi.fn(() => true);
      router.route(
        defineRoute({
          filters: { topic: 'orders', customFilter },
        }).handle(async () => {}),
      );

      const record = kafkaRecord({ topic: 'users' });
      const event = kafkaMSKEvent({ users: [record] });

      // @ts-expect-error testing private method
      await router.matchRoute(record, event, []);

      expect(customFilter).not.toHaveBeenCalled();
    });

    test('empty filters as catch-all', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'anything' });
      const event = kafkaMSKEvent({ anything: [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });

    test('first matching route wins when multiple match', async ({ kafkaRecord, kafkaMSKEvent }) => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRoute({ filters: {} }).handle(secondHandler));

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches route by async customFilter', async ({ kafkaRecord, kafkaMSKEvent }) => {
      router.route(
        defineRoute({
          filters: {
            customFilter: async ({ topic }: KafkaFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return topic === 'test-topic';
            },
          },
        }).handle(async () => {}),
      );

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = await router.matchRoute(record, event, []);
      expect(result).toBeDefined();
    });
  });

  suite('flattenRecords', () => {
    test('flattens records from multiple topic into single array', ({ kafkaRecord, kafkaMSKEvent }) => {
      const recordA = kafkaRecord({ topic: 'topic-a' });
      const recordB = kafkaRecord({ topic: 'topic-b' });
      const recordC = kafkaRecord({ topic: 'topic-a' });

      const event = kafkaMSKEvent({ 'topic-a': [recordA, recordC], 'topic-b': [recordB] });

      // @ts-expect-error testing private method
      const result = router.flattenRecords(event);
      expect(result).toHaveLength(3);
      expect(result).toContain(recordA);
      expect(result).toContain(recordB);
      expect(result).toContain(recordC);
    });

    test('handles single topic', ({ kafkaRecord, kafkaMSKEvent }) => {
      const record = kafkaRecord();

      const event = kafkaMSKEvent({ 'test-topic': [record] });

      // @ts-expect-error testing private method
      const result = router.flattenRecords(event);
      expect(result).toEqual([record]);
    });

    test('returns empty array for empty records', ({ kafkaMSKEvent }) => {
      const event = kafkaMSKEvent({});

      // @ts-expect-error testing private method
      const result = router.flattenRecords(event);
      expect(result).toEqual([]);
    });
  });

  suite('decodeHeaders', () => {
    test('decodes header byte arrays to UTF-8 strings', () => {
      const contentTypeBytes = Array.from(Buffer.from('application/json', 'utf-8'));
      const headers = [{ 'content-type': contentTypeBytes }];

      // @ts-expect-error testing private method
      const result = router.decodeHeaders(headers);
      expect(result).toEqual([{ 'content-type': 'application/json' }]);
    });

    test('handles multiple headers', () => {
      const headers = [
        { 'content-type': Array.from(Buffer.from('application/json', 'utf-8')) },
        { 'x-correlation-id': Array.from(Buffer.from('abc-123', 'utf-8')) },
      ];

      // @ts-expect-error testing private method
      const result = router.decodeHeaders(headers);
      expect(result).toEqual([{ 'content-type': 'application/json' }, { 'x-correlation-id': 'abc-123' }]);
    });

    test('handles empty headers array', () => {
      // @ts-expect-error testing private method
      const result = router.decodeHeaders([]);
      expect(result).toEqual([]);
    });

    test('returns an empty array when the record carries no headers', () => {
      // @ts-expect-error testing private method
      expect(router.decodeHeaders(null)).toEqual([]);
      // @ts-expect-error testing private method
      expect(router.decodeHeaders(undefined)).toEqual([]);
    });
  });

  suite('records with absent fields', () => {
    test('gives the handler an undefined key when the record has no key', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ key: null, value: { action: 'test' } });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.key).toBeUndefined();
      expect(receivedRequest?.value).toEqual({ action: 'test' });
    });

    test('gives the handler an undefined value when the record has no value', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ key: 'my-key', value: null });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.key).toBe('my-key');
      expect(receivedRequest?.value).toBeUndefined();
    });

    test('gives the handler an empty headers array when the record has no headers', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ headers: null });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.headers).toEqual([]);
    });

    test('matches a customFilter on a record with no key, value or headers', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { customFilter: ({ headers }: KafkaFilterInput): boolean => headers.length === 0 },
        }).handle(handler),
      );

      const record = kafkaRecord({ key: null, value: null, headers: null });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('fails a record with no value against a valueSchema', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const valueSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(defineRoute({ filters: {}, valueSchema }).handle(async () => {}));

      const record = kafkaRecord({ value: null });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await expect(router.handleEvent(event, context())).rejects.toThrow('Value validation failed');
    });
  });

  suite('handleEvent', () => {
    test('calls handler with correct KafkaRequest shape', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      let receivedRequest: KafkaRequest | undefined;

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ key: 'my-key', value: { action: 'test' }, topic: 'orders' });
      const event = kafkaMSKEvent({ orders: [record] });
      const ctx = context();

      await router.handleEvent(event, ctx);

      expect(receivedRequest).toBeDefined();
      expect(receivedRequest?.key).toBe('my-key');
      expect(receivedRequest?.value).toEqual({ action: 'test' });
      expect(receivedRequest?.topic).toBe('orders');
      expect(receivedRequest?.partition).toBe(0);
      expect(receivedRequest?.offset).toBe(0);
      expect(receivedRequest?.timestamp).toBeTypeOf('number');
      expect(receivedRequest?.headers).toEqual([{ 'content-type': 'application/json' }]);
      expect(receivedRequest?.record).toBe(record);
      expect(receivedRequest?.context).toBe(ctx);
    });

    test('decodes base64 key and value', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ key: 'decoded-key', value: 'decoded-value' });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.key).toBe('decoded-key');
      expect(receivedRequest?.value).toBe('decoded-value');
    });

    test('parses JSON value', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ value: { name: 'test', count: 42 } });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.value).toEqual({ name: 'test', count: 42 });
    });

    test('handles non-JSON value', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      let receivedRequest: KafkaRequest | undefined;
      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          receivedRequest = request;
        }),
      );

      const record = kafkaRecord({ value: 'plain text message' });
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(receivedRequest?.value).toBe('plain text message');
    });

    test('throws when no route matches', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      router.route(defineRoute({ filters: { topic: 'orders' } }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'users', partition: 0, offset: 0 });
      const event = kafkaMSKEvent({ users: [record] });

      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for record on topic users partition 0',
      );
    });

    test('propagates handler errors', async ({ kafkaHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = kafkaHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined on success', async ({ kafkaHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = kafkaHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes records sequentially', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          const id = `${request.topic}-${request.offset}`;
          callOrder.push(`start-${id}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${id}`);
        }),
      );

      const recordA = kafkaRecord({ offset: 0 });
      const recordB = kafkaRecord({ offset: 1 });
      const event = kafkaMSKEvent({ 'test-topic': [recordA, recordB] });

      await router.handleEvent(event, context());

      expect(callOrder).toEqual(['start-test-topic-0', 'end-test-topic-0', 'start-test-topic-1', 'end-test-topic-1']);
    });
  });

  suite('handleEvent - batchItemFailures', () => {
    let router: KafkaRouter;

    beforeEach(() => {
      router = new KafkaRouter({ batchItemFailures: true });
    });

    test('returns batchItemFailures with itemIdentifier of topic-partition and offset', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const failingRecord = kafkaRecord({ topic: 'orders', partition: 2, offset: 5 });

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          if (request.offset === 5) {
            throw new Error('processing failed');
          }
        }),
      );

      const event = kafkaMSKEvent({ orders: [failingRecord] });

      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: { partition: 'orders-2', offset: 5 } }],
      });
    });

    test('returns undefined when all records succeed', async ({ kafkaHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = kafkaHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('marks failed record and all remaining records as failures', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const recordA = kafkaRecord({ topic: 'orders', partition: 0, offset: 0 });
      const failingRecord = kafkaRecord({ topic: 'orders', partition: 0, offset: 1 });
      const recordC = kafkaRecord({ topic: 'orders', partition: 0, offset: 2 });
      const recordD = kafkaRecord({ topic: 'orders', partition: 0, offset: 3 });

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          if (request.offset === 1) {
            throw new Error('processing failed');
          }
        }),
      );

      const event = kafkaMSKEvent({ orders: [recordA, failingRecord, recordC, recordD] });

      const result = await router.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: { partition: 'orders-0', offset: 1 } },
          { itemIdentifier: { partition: 'orders-0', offset: 2 } },
          { itemIdentifier: { partition: 'orders-0', offset: 3 } },
        ],
      });
    });

    test('scopes failures to the failing partition and still processes others', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const processedPartitions: number[] = [];
      const failingRecord = kafkaRecord({ topic: 'orders', partition: 0, offset: 0 });
      const otherPartitionRecord = kafkaRecord({ topic: 'orders', partition: 1, offset: 0 });

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          processedPartitions.push(request.partition);
          if (request.partition === 0) {
            throw new Error('processing failed');
          }
        }),
      );

      const event = kafkaMSKEvent({ 'orders-0': [failingRecord], 'orders-1': [otherPartitionRecord] });

      const result = await router.handleEvent(event, context());

      // Kafka checkpoints each partition independently, so a failure in partition 0
      // neither skips nor fails the record in partition 1.
      expect(processedPartitions).toContain(1);
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: { partition: 'orders-0', offset: 0 } }],
      });
    });

    test('stops processing after first failure', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const processedOffsets: number[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          processedOffsets.push(request.offset);
          if (request.offset === 1) {
            throw new Error('processing failed');
          }
        }),
      );

      const records = [kafkaRecord({ offset: 0 }), kafkaRecord({ offset: 1 }), kafkaRecord({ offset: 2 })];
      const event = kafkaMSKEvent({ 'test-topic': records });

      await router.handleEvent(event, context());

      expect(processedOffsets).toEqual([0, 1]);
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated value from valueSchema', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const handler = vi.fn();
      const valueSchema = createMockSchema();

      router.route(defineRoute({ filters: {}, valueSchema }).handle(handler));

      const value = { action: 'process', id: '123' };
      const record = kafkaRecord({ value });
      const event = kafkaMSKEvent({ 'test-topic': [record] });
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(value, valueSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value }));
    });

    test('throws when valueSchema validation fails', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const valueSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(defineRoute({ filters: {}, valueSchema }).handle(async () => {}));

      const record = kafkaRecord({ value: { bad: 'data' } });
      const event = kafkaMSKEvent({ 'test-topic': [record] });
      await expect(router.handleEvent(event, context())).rejects.toThrow('Value validation failed');
    });

    test('returns batchItemFailure when valueSchema validation fails', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const batchRouter = new KafkaRouter({ batchItemFailures: true });
      const valueSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      batchRouter.route(defineRoute({ filters: {}, valueSchema }).handle(async () => {}));

      const record = kafkaRecord({ topic: 'orders', partition: 0, offset: 5 });
      const event = kafkaMSKEvent({ orders: [record] });
      const result = await batchRouter.handleEvent(event, context());

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: { partition: 'orders-0', offset: 5 } }],
      });
    });
  });

  suite('handleEvent - jsonParse', () => {
    test('passes decoded value to safeJsonParse', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const rawValue = JSON.stringify({ action: 'test' });
      const record = kafkaRecord({ value: rawValue });
      const event = kafkaMSKEvent({ 'test-topic': [record] });
      await router.handleEvent(event, context());

      expect(safeJsonParseSpy).toHaveBeenCalledWith(rawValue);
    });

    test('handler receives parsed object when value is valid JSON', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const value = { action: 'process', id: '123' };
      const record = kafkaRecord({ value });
      const event = kafkaMSKEvent({ 'test-topic': [record] });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value }));
    });

    test('handler receives raw string when value is not valid JSON', async ({
      kafkaRecord,
      kafkaMSKEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const record = kafkaRecord({ value: 'plain text message' });
      const event = kafkaMSKEvent({ 'test-topic': [record] });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value: 'plain text message' }));
    });
  });

  suite('full event processing', () => {
    test('routes records to different handlers by topic', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const orderHandler = vi.fn();
      const userHandler = vi.fn();

      router.route(defineRoute({ filters: { topic: 'orders' } }).handle(orderHandler));
      router.route(defineRoute({ filters: { topic: 'users' } }).handle(userHandler));

      const orderRecord = kafkaRecord({ topic: 'orders' });
      const userRecord = kafkaRecord({ topic: 'users' });
      const event = kafkaMSKEvent({ orders: [orderRecord], users: [userRecord] });

      await router.handleEvent(event, context());

      expect(orderHandler).toHaveBeenCalledTimes(1);
      expect(userHandler).toHaveBeenCalledTimes(1);
    });

    test('routes MSK event by eventSourceArn', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const handler = vi.fn();
      const arn = 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123';

      router.route(defineRoute({ filters: { eventSourceArn: arn } }).handle(handler));

      const record = kafkaRecord();
      const event = kafkaMSKEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('routes SelfManagedKafka event by bootstrapServer', async ({
      kafkaRecord,
      kafkaSelfManagedEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: { bootstrapServer: 'broker1.example.com:9092' } }).handle(handler));

      const record = kafkaRecord();
      const event = kafkaSelfManagedEvent({ 'test-topic': [record] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all records', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const recordA = kafkaRecord({ topic: 'orders' });
      const recordB = kafkaRecord({ topic: 'users' });
      const recordC = kafkaRecord({ topic: 'events' });
      const event = kafkaMSKEvent({ orders: [recordA], users: [recordB], events: [recordC] });

      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledTimes(3);
    });

    test('multiple topic in single event routed correctly', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
      const orderHandler = vi.fn();
      const catchAllHandler = vi.fn();
      router.route(defineRoute({ filters: { topic: 'orders' } }).handle(orderHandler));
      router.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const orderA = kafkaRecord({ topic: 'orders' });
      const orderB = kafkaRecord({ topic: 'orders' });
      const userRecord = kafkaRecord({ topic: 'users' });
      const event = kafkaMSKEvent({ orders: [orderA, orderB], users: [userRecord] });

      await router.handleEvent(event, context());

      expect(orderHandler).toHaveBeenCalledTimes(2);
      expect(catchAllHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createKafkaRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ kafkaHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: KafkaRequest, _next: KafkaNext): Promise<void> {
        return;
      }

      const router = createKafkaRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createKafkaRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ kafkaHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: KafkaRequest, _next: KafkaNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ kafkaHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: KafkaRequest, next: KafkaNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createKafkaRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ kafkaHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: KafkaRequest, _next: KafkaNext): Promise<void> {
        return;
      }

      const router = createKafkaRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = kafkaHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ kafkaHandlerEvent }) => {
      const middleware = vi.fn();
      const valueSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createKafkaRouter({ middleware: [middleware] });
      router.route({ filters: {}, valueSchema, handler: vi.fn() });

      const { event, context } = kafkaHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});
