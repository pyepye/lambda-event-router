import type { Schema } from '@lambda-event-router/base';
import { test } from '@lambda-event-router/testing';
import { createKafkaRouter, defineRoute, KafkaRouter } from './KafkaRouter.js';
import type { KafkaFilterInput, KafkaRequest } from './types.js';

describe('createKafkaRouter', () => {
  it('creates a KafkaRouter instance', () => {
    const router = createKafkaRouter();
    expect(router).toBeInstanceOf(KafkaRouter);
  });
});

describe('defineRoute', () => {
  it('returns a route builder with handle method', () => {
    const builder = defineRoute({ filters: {} });
    expect(builder.handle).toBeTypeOf('function');
  });

  it('preserves filters, valueSchema, and handler in the definition', () => {
    const filters = { topics: ['orders'] };
    const valueSchema: Schema<string> = {
      safeParse: (data: string) => ({ success: true, data: data }),
    };
    const handler = async (): Promise<void> => {};

    const definition = defineRoute({ filters, valueSchema }).handle(handler);

    expect(definition.filters).toBe(filters);
    expect(definition.valueSchema).toBe(valueSchema);
    expect(definition.handler).toBe(handler);
  });
});

describe('canHandleEvent', () => {
  const router = createKafkaRouter();

  test('returns true for valid MSK event', ({ kafkaMSKEvent }) => {
    const event = kafkaMSKEvent();
    expect(router.canHandleEvent(event)).toBe(true);
  });

  test('returns true for valid SelfManagedKafka event', ({ kafkaSelfManagedEvent }) => {
    const event = kafkaSelfManagedEvent();
    expect(router.canHandleEvent(event)).toBe(true);
  });

  it('returns false for wrong eventSource', () => {
    const event = { eventSource: 'aws:sqs', records: {} };
    expect(router.canHandleEvent(event)).toBe(false);
  });

  it('returns false for null', () => {
    expect(router.canHandleEvent(null)).toBe(false);
  });

  it('returns false when records is not an object', () => {
    const event = { eventSource: 'aws:kafka', records: 'not-an-object' };
    expect(router.canHandleEvent(event)).toBe(false);
  });

  it('returns false for non-object input', () => {
    expect(router.canHandleEvent('string')).toBe(false);
  });
});

describe('route', () => {
  it('returns router instance for chaining', () => {
    const router = createKafkaRouter();
    const result = router.route(defineRoute({ filters: {} }).handle(async () => {}));
    expect(result).toBe(router);
  });
});

describe('matchRoute', () => {
  test('matches by topics filter', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: { topics: ['orders'] } }).handle(async () => {}));

    const record = kafkaRecord({ topic: 'orders' });
    const event = kafkaMSKEvent({ orders: [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeDefined();
  });

  test('does not match when topics do not match', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: { topics: ['orders'] } }).handle(async () => {}));

    const record = kafkaRecord({ topic: 'users' });
    const event = kafkaMSKEvent({ users: [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeUndefined();
  });

  test('matches by eventSourceArns', ({ kafkaRecord, kafkaMSKEvent }) => {
    const arn = 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123';
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: { eventSourceArns: [arn] } }).handle(async () => {}));

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeDefined();
  });

  test('does not match when eventSourceArns do not match', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({ filters: { eventSourceArns: ['arn:aws:kafka:us-east-1:000000000000:cluster/Other/xyz'] } }).handle(
        async () => {},
      ),
    );

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeUndefined();
  });

  test('does not match eventSourceArns filter for SelfManagedKafka event', ({ kafkaRecord, kafkaSelfManagedEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({
        filters: { eventSourceArns: ['arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123'] },
      }).handle(async () => {}),
    );

    const record = kafkaRecord();
    const event = kafkaSelfManagedEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeUndefined();
  });

  test('matches by bootstrapServers', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: { bootstrapServers: ['broker1.example.com:9092'] } }).handle(async () => {}));

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeDefined();
  });

  test('does not match when bootstrapServers do not match', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({ filters: { bootstrapServers: ['other-broker.example.com:9092'] } }).handle(async () => {}),
    );

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeUndefined();
  });

  test('matches by customFilter', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({
        filters: { customFilter: ({ topic }: KafkaFilterInput): boolean => topic === 'test-topic' },
      }).handle(async () => {}),
    );

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeDefined();
  });

  test('does not match when customFilter returns false', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({
        filters: { customFilter: (): boolean => false },
      }).handle(async () => {}),
    );

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeUndefined();
  });

  test('customFilter receives correct KafkaFilterInput', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
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
    router.matchRoute(record, event, decodedHeaders);

    expect(receivedInput).toBeDefined();
    expect(receivedInput?.topic).toBe('my-topic');
    expect(receivedInput?.headers).toEqual([{ 'x-custom': 'value' }]);
    expect(receivedInput?.record).toBe(record);
  });

  test('customFilter is not called when preceding filter rejects', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    const customFilter = vi.fn(() => true);

    router.route(
      defineRoute({
        filters: { topics: ['orders'], customFilter },
      }).handle(async () => {}),
    );

    const record = kafkaRecord({ topic: 'users' });
    const event = kafkaMSKEvent({ users: [record] });

    // @ts-expect-error testing private method
    router.matchRoute(record, event, []);

    expect(customFilter).not.toHaveBeenCalled();
  });

  test('empty filters as catch-all', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: {} }).handle(async () => {}));

    const record = kafkaRecord({ topic: 'anything' });
    const event = kafkaMSKEvent({ anything: [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result).toBeDefined();
  });

  test('first matching route wins when multiple match', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    router.route(defineRoute({ filters: {} }).handle(firstHandler));
    router.route(defineRoute({ filters: {} }).handle(secondHandler));

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.matchRoute(record, event, []);
    expect(result?.handler).toBe(firstHandler);
  });
});

describe('flattenRecords', () => {
  test('flattens records from multiple topics into single array', ({ kafkaRecord, kafkaMSKEvent }) => {
    const router = createKafkaRouter();
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
    const router = createKafkaRouter();
    const record = kafkaRecord();

    const event = kafkaMSKEvent({ 'test-topic': [record] });

    // @ts-expect-error testing private method
    const result = router.flattenRecords(event);
    expect(result).toEqual([record]);
  });

  test('returns empty array for empty records', ({ kafkaMSKEvent }) => {
    const router = createKafkaRouter();

    const event = kafkaMSKEvent({});

    // @ts-expect-error testing private method
    const result = router.flattenRecords(event);
    expect(result).toEqual([]);
  });
});

describe('decodeHeaders', () => {
  it('decodes header byte arrays to UTF-8 strings', () => {
    const router = createKafkaRouter();
    // "application/json" as byte array
    const contentTypeBytes = Array.from(Buffer.from('application/json', 'utf-8'));
    const headers = [{ 'content-type': contentTypeBytes }];

    // @ts-expect-error testing private method
    const result = router.decodeHeaders(headers);
    expect(result).toEqual([{ 'content-type': 'application/json' }]);
  });

  it('handles multiple headers', () => {
    const router = createKafkaRouter();
    const headers = [
      { 'content-type': Array.from(Buffer.from('application/json', 'utf-8')) },
      { 'x-correlation-id': Array.from(Buffer.from('abc-123', 'utf-8')) },
    ];

    // @ts-expect-error testing private method
    const result = router.decodeHeaders(headers);
    expect(result).toEqual([{ 'content-type': 'application/json' }, { 'x-correlation-id': 'abc-123' }]);
  });

  it('handles empty headers array', () => {
    const router = createKafkaRouter();

    // @ts-expect-error testing private method
    const result = router.decodeHeaders([]);
    expect(result).toEqual([]);
  });
});

describe('parseValue', () => {
  it('parses valid JSON string', () => {
    const router = createKafkaRouter();
    // @ts-expect-error testing private method
    const result = router.parseValue('{"name":"test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('returns raw string for non-JSON value', () => {
    const router = createKafkaRouter();
    // @ts-expect-error testing private method
    const result = router.parseValue('plain text');
    expect(result).toBe('plain text');
  });
});

describe('validateValue', () => {
  test('returns data when no schema', ({ kafkaRecord }) => {
    const router = createKafkaRouter();
    const data = { name: 'test' };
    const record = kafkaRecord({ topic: 'test', partition: 0 });

    // @ts-expect-error testing private method
    const result = router.validateValue(data, undefined, record);
    expect(result).toBe(data);
  });

  test('returns validated data on schema success', ({ kafkaRecord }) => {
    const router = createKafkaRouter();
    const data = { name: 'test' };
    const schema: Schema<{ name: string }> = {
      safeParse: (input: { name: string }) => ({ success: true, data: input }),
    };
    const record = kafkaRecord({ topic: 'test', partition: 0 });

    // @ts-expect-error testing private method
    const result = router.validateValue(data, schema, record);
    expect(result).toBe(data);
  });

  test('throws on schema validation failure', ({ kafkaRecord }) => {
    const router = createKafkaRouter();
    const schema: Schema<unknown> = {
      safeParse: () => ({ success: false, error: new Error('invalid') }),
    };
    const record = kafkaRecord({ topic: 'orders', partition: 1 });

    // @ts-expect-error testing private method
    expect(() => router.validateValue({}, schema, record)).toThrow(
      'Value validation failed for record on topic orders partition 1',
    );
  });
});

describe('handleEvent', () => {
  test('calls handler with correct KafkaRequest shape', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
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
    const router = createKafkaRouter();
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
    const router = createKafkaRouter();
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
    const router = createKafkaRouter();
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
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: { topics: ['orders'] } }).handle(async () => {}));

    const record = kafkaRecord({ topic: 'users', partition: 0, offset: 0 });
    const event = kafkaMSKEvent({ users: [record] });

    await expect(router.handleEvent(event, context())).rejects.toThrow(
      'No route matched for record on topic users partition 0',
    );
  });

  test('propagates handler errors', async ({ kafkaHandlerEvent }) => {
    const router = createKafkaRouter();
    router.route(
      defineRoute({ filters: {} }).handle(async () => {
        throw new Error('handler exploded');
      }),
    );

    const { event, context } = kafkaHandlerEvent();
    await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
  });

  test('returns undefined on success', async ({ kafkaHandlerEvent }) => {
    const router = createKafkaRouter();
    router.route(defineRoute({ filters: {} }).handle(async () => {}));

    const { event, context } = kafkaHandlerEvent();
    const result = await router.handleEvent(event, context);

    expect(result).toBeUndefined();
  });

  test('processes records sequentially', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
    const callOrder: string[] = [];

    router.route(
      defineRoute({ filters: {} }).handle(async (request) => {
        const id = `${request.topic}-${request.offset}`;
        callOrder.push(`start-${id}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
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

describe('handleEvent with batchItemFailures', () => {
  test('returns batchItemFailures with itemIdentifier format topic-partition-offset', async ({
    kafkaRecord,
    kafkaMSKEvent,
    context,
  }) => {
    const router = createKafkaRouter({ batchItemFailures: true });
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
      batchItemFailures: [{ itemIdentifier: 'orders-2-5' }],
    });
  });

  test('returns undefined when all records succeed', async ({ kafkaHandlerEvent }) => {
    const router = createKafkaRouter({ batchItemFailures: true });
    router.route(defineRoute({ filters: {} }).handle(async () => {}));

    const { event, context } = kafkaHandlerEvent();
    const result = await router.handleEvent(event, context);

    expect(result).toBeUndefined();
  });

  test('marks failed record and all remaining records as failures', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter({ batchItemFailures: true });

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
        { itemIdentifier: 'orders-0-1' },
        { itemIdentifier: 'orders-0-2' },
        { itemIdentifier: 'orders-0-3' },
      ],
    });
  });

  test('stops processing after first failure', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter({ batchItemFailures: true });
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

describe('handleEvent with schema validation', () => {
  test('validates value against schema and passes validated data to handler', async ({
    kafkaRecord,
    kafkaMSKEvent,
    context,
  }) => {
    const router = createKafkaRouter();
    const transformedData = { name: 'validated' };
    const schema: Schema<{ name: string }> = {
      safeParse: () => ({ success: true, data: transformedData }),
    };

    let receivedValue: unknown;
    router.route(
      defineRoute({ filters: {}, valueSchema: schema }).handle(async (request) => {
        receivedValue = request.value;
      }),
    );

    const record = kafkaRecord({ value: { name: 'raw' } });
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    await router.handleEvent(event, context());

    expect(receivedValue).toBe(transformedData);
  });

  test('throws when value fails schema validation', async ({ kafkaHandlerEvent }) => {
    const router = createKafkaRouter();
    const schema: Schema<unknown> = {
      safeParse: () => ({ success: false, error: new Error('invalid') }),
    };

    router.route(defineRoute({ filters: {}, valueSchema: schema }).handle(async () => {}));

    const { event, context } = kafkaHandlerEvent();
    await expect(router.handleEvent(event, context)).rejects.toThrow('Value validation failed');
  });
});

describe('full event processing', () => {
  test('routes records to different handlers by topic', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
    const orderHandler = vi.fn();
    const userHandler = vi.fn();

    router.route(defineRoute({ filters: { topics: ['orders'] } }).handle(orderHandler));
    router.route(defineRoute({ filters: { topics: ['users'] } }).handle(userHandler));

    const orderRecord = kafkaRecord({ topic: 'orders' });
    const userRecord = kafkaRecord({ topic: 'users' });
    const event = kafkaMSKEvent({ orders: [orderRecord], users: [userRecord] });

    await router.handleEvent(event, context());

    expect(orderHandler).toHaveBeenCalledTimes(1);
    expect(userHandler).toHaveBeenCalledTimes(1);
  });

  test('routes MSK event by eventSourceArn', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
    const handler = vi.fn();
    const arn = 'arn:aws:kafka:us-east-1:123456789012:cluster/TestCluster/abc-123';

    router.route(defineRoute({ filters: { eventSourceArns: [arn] } }).handle(handler));

    const record = kafkaRecord();
    const event = kafkaMSKEvent({ 'test-topic': [record] });

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('routes SelfManagedKafka event by bootstrapServers', async ({ kafkaRecord, kafkaSelfManagedEvent, context }) => {
    const router = createKafkaRouter();
    const handler = vi.fn();

    router.route(defineRoute({ filters: { bootstrapServers: ['broker1.example.com:9092'] } }).handle(handler));

    const record = kafkaRecord();
    const event = kafkaSelfManagedEvent({ 'test-topic': [record] });

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('catch-all route handles all records', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
    const handler = vi.fn();

    router.route(defineRoute({ filters: {} }).handle(handler));

    const recordA = kafkaRecord({ topic: 'orders' });
    const recordB = kafkaRecord({ topic: 'users' });
    const recordC = kafkaRecord({ topic: 'events' });
    const event = kafkaMSKEvent({ orders: [recordA], users: [recordB], events: [recordC] });

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledTimes(3);
  });

  test('multiple topics in single event routed correctly', async ({ kafkaRecord, kafkaMSKEvent, context }) => {
    const router = createKafkaRouter();
    const orderHandler = vi.fn();
    const catchAllHandler = vi.fn();

    router.route(defineRoute({ filters: { topics: ['orders'] } }).handle(orderHandler));
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
