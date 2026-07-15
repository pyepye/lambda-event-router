import { createDynamoDBRouter } from './DynamoDBRouter.js';
import type { DynamoDBInsertRequest, DynamoDBRequest, DynamoDBRouteDefinition } from './types.js';

suite('route()', () => {
  test('narrows an inline handler from the eventName filter', () => {
    createDynamoDBRouter().route({
      filters: { eventName: 'INSERT' },
      handler: async ({ newImage }: DynamoDBInsertRequest): Promise<void> => {
        await Promise.resolve(newImage);
      },
    });
  });

  test('rejects an inline handler the eventName filter does not deliver', () => {
    createDynamoDBRouter().route({
      filters: { eventName: 'REMOVE' },
      // @ts-expect-error - a REMOVE record reaches this handler, and it cannot read one
      handler: async ({ newImage }: DynamoDBInsertRequest): Promise<void> => {
        await Promise.resolve(newImage);
      },
    });
  });

  test('hands an unfiltered inline handler every event', () => {
    createDynamoDBRouter().route({
      filters: {},
      handler: async (request: DynamoDBRequest): Promise<void> => {
        await Promise.resolve(request.eventName);
      },
    });
  });
});

suite('DynamoDBRouteDefinition handler', () => {
  test('takes every event the route can match', () => {
    type Request = Parameters<DynamoDBRouteDefinition['handler']>[0];

    expectTypeOf<Request>().toEqualTypeOf<DynamoDBRequest>();
  });

  test('rejects a handler typed to one event, which the filters need not deliver', () => {
    const onInsert = async ({ newImage }: DynamoDBInsertRequest): Promise<void> => {
      await Promise.resolve(newImage);
    };

    const definition: DynamoDBRouteDefinition = {
      filters: { eventName: 'REMOVE' },
      // @ts-expect-error - a REMOVE record reaches this handler, and it cannot read one
      handler: onInsert,
    };

    expect(definition.handler).toBeTypeOf('function');
  });
});
