import { createS3Router, defineRoute } from './S3Router.js';
import type {
  S3BaseRequest,
  S3ObjectCreatedRequest,
  S3ObjectRestoreRequest,
  S3RouteDefinition,
} from './types/index.js';

type HandlerRequest<TBuilder extends { handle: (handler: never) => unknown }> = Parameters<
  Parameters<TBuilder['handle']>[0]
>[0];

suite('defineRoute', () => {
  test('types an ObjectCreated filter with objectSize and eTag', () => {
    const builder = defineRoute({ filters: { eventName: 'ObjectCreated:Put' } });

    expectTypeOf<HandlerRequest<typeof builder>>().toEqualTypeOf<S3ObjectCreatedRequest>();
  });

  test('types an ObjectCreated wildcard filter with objectSize and eTag', () => {
    const builder = defineRoute({ filters: { eventName: 'ObjectCreated:*' } });

    expectTypeOf<HandlerRequest<typeof builder>>().toEqualTypeOf<S3ObjectCreatedRequest>();
  });

  test('types an ObjectRestore filter with restoreEventData', () => {
    const builder = defineRoute({ filters: { eventName: 'ObjectRestore:Completed' } });

    expectTypeOf<HandlerRequest<typeof builder>>().toEqualTypeOf<S3ObjectRestoreRequest>();
  });

  test('types an ObjectRemoved filter as the base request', () => {
    const builder = defineRoute({ filters: { eventName: 'ObjectRemoved:Delete' } });

    expectTypeOf<HandlerRequest<typeof builder>>().toEqualTypeOf<S3BaseRequest>();
  });

  test('types a filter with no eventName as the base request', () => {
    const builder = defineRoute({ filters: { bucket: 'my-bucket' } });

    expectTypeOf<HandlerRequest<typeof builder>>().toEqualTypeOf<S3BaseRequest>();
  });

  test('rejects an ObjectCreated handler on an ObjectRemoved filter', () => {
    const definition = defineRoute({ filters: { eventName: 'ObjectRemoved:Delete' } }).handle(
      // @ts-expect-error - a removal reaches this handler, and it carries no objectSize
      async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    );

    expect(definition.handler).toBeTypeOf('function');
  });

  test('rejects an ObjectCreated handler on a filter spanning two event families', () => {
    const definition = defineRoute({
      filters: { eventName: ['ObjectCreated:Put', 'ObjectRemoved:Delete'] },
    }).handle(
      // @ts-expect-error - a removal reaches this handler, and it carries no objectSize
      async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    );

    expect(definition.handler).toBeTypeOf('function');
  });
});

suite('route', () => {
  test('narrows an inline handler from an ObjectCreated eventName filter', () => {
    const router = createS3Router().route({
      filters: { eventName: 'ObjectCreated:Put' },
      handler: async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    });

    expect(router).toBeDefined();
  });

  test('rejects an inline ObjectCreated handler on an ObjectRemoved filter', () => {
    const router = createS3Router().route({
      filters: { eventName: 'ObjectRemoved:Delete' },
      // @ts-expect-error - a removal reaches this handler, and it carries no objectSize
      handler: async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    });

    expect(router).toBeDefined();
  });

  test('rejects an inline ObjectCreated handler on a filter with no eventName', () => {
    const router = createS3Router().route({
      filters: { bucket: 'my-bucket' },
      // @ts-expect-error - any notification reaches this handler, and only some carry objectSize
      handler: async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    });

    expect(router).toBeDefined();
  });
});

suite('S3RouteDefinition', () => {
  test('takes every notification the route can match', () => {
    expectTypeOf<Parameters<S3RouteDefinition['handler']>[0]>().toEqualTypeOf<S3BaseRequest>();
  });

  test('rejects a handler typed to ObjectCreated, which the filters need not deliver', () => {
    const definition: S3RouteDefinition = {
      filters: { eventName: 'ObjectRemoved:Delete' },
      // @ts-expect-error - a removal reaches this handler, and it carries no objectSize
      handler: async ({ objectSize }: S3ObjectCreatedRequest): Promise<void> => {
        await Promise.resolve(objectSize);
      },
    };

    expect(definition.handler).toBeTypeOf('function');
  });
});
