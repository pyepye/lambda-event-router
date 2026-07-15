import { createDocumentDBRouter } from './DocumentDBRouter.js';
import type { DocumentDBInsertRequest, DocumentDBRequest, DocumentDBRouteDefinition } from './types.js';

suite('route()', () => {
  test('narrows an inline handler from the operationType filter', () => {
    createDocumentDBRouter().route({
      filters: { operationType: 'insert' },
      handler: async ({ fullDocument }: DocumentDBInsertRequest): Promise<void> => {
        await Promise.resolve(fullDocument);
      },
    });
  });

  test('rejects an inline handler the operationType filter does not deliver', () => {
    createDocumentDBRouter().route({
      filters: { operationType: 'delete' },
      // @ts-expect-error - a delete change reaches this handler, and it cannot read one
      handler: async ({ fullDocument }: DocumentDBInsertRequest): Promise<void> => {
        await Promise.resolve(fullDocument);
      },
    });
  });

  test('hands an unfiltered inline handler every operation', () => {
    createDocumentDBRouter().route({
      filters: {},
      handler: async (request: DocumentDBRequest): Promise<void> => {
        await Promise.resolve(request.operationType);
      },
    });
  });
});

suite('DocumentDBRouteDefinition handler', () => {
  test('takes every operation the route can match', () => {
    type Request = Parameters<DocumentDBRouteDefinition['handler']>[0];

    expectTypeOf<Request>().toEqualTypeOf<DocumentDBRequest>();
  });

  test('rejects a handler typed to one operation, which the filters need not deliver', () => {
    const onInsert = async ({ fullDocument }: DocumentDBInsertRequest): Promise<void> => {
      await Promise.resolve(fullDocument);
    };

    const definition: DocumentDBRouteDefinition = {
      filters: { operationType: 'delete' },
      // @ts-expect-error - a delete change reaches this handler, and it cannot read one
      handler: onInsert,
    };

    expect(definition.handler).toBeTypeOf('function');
  });
});
