import type { Schema } from '@lambda-event-router/base';
import {
  createDocumentDBDeleteEntry,
  createDocumentDBEvent,
  createDocumentDBInsertEntry,
  createDocumentDBReplaceEntry,
  createDocumentDBUpdateEntry,
  test,
} from '@lambda-event-router/testing';
import { createDocumentDBRouter, DocumentDBRouter, defineRoute } from './DocumentDBRouter.js';
import type { DocumentDBFilterInput } from './types.js';

suite('DocumentDBRouter', () => {
  let router: DocumentDBRouter;

  beforeEach(() => {
    router = new DocumentDBRouter();
  });

  suite('createDocumentDBRouter', () => {
    test('creates a DocumentDBRouter instance', () => {
      const router = createDocumentDBRouter();
      expect(router).toBeInstanceOf(DocumentDBRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid DocumentDB event', () => {
      const event = createDocumentDBEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an array', () => {
      expect(router.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false when events is not an array', () => {
      expect(router.canHandleEvent({ events: 'not-an-array', eventSource: 'aws:docdb' })).toBe(false);
    });

    test('returns false when events is missing', () => {
      expect(router.canHandleEvent({ eventSource: 'aws:docdb' })).toBe(false);
    });

    test('returns false when eventSource is not aws:docdb', () => {
      expect(router.canHandleEvent({ events: [], eventSource: 'aws:dynamodb' })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArns: ['arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const documentKeySchema: Schema<{ _id: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { _id: string } }),
      };
      const fullDocumentSchema: Schema<{ name: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { name: string } }),
      };
      const fullDocumentBeforeChangeSchema: Schema<{ name: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { name: string } }),
      };
      const handler = vi.fn();
      const filters = {
        eventSourceArns: ['arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster'],
        databases: ['test-db'],
      };

      const definition = defineRoute({
        filters,
        documentKeySchema,
        fullDocumentSchema,
        fullDocumentBeforeChangeSchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        documentKeySchema,
        fullDocumentSchema,
        fullDocumentBeforeChangeSchema,
        handler,
      });
    });
  });

  test('route, insert, update, replace, and delete return the router instance for chaining', () => {
    const definition = defineRoute({
      filters: { eventSourceArns: ['arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster'] },
    }).handle(async () => {});
    const operationArgs = { filters: {}, handler: async () => {} };

    expect(router.route(definition)).toBe(router);
    expect(router.insert(operationArgs)).toBe(router);
    expect(router.update(operationArgs)).toBe(router);
    expect(router.replace(operationArgs)).toBe(router);
    expect(router.delete(operationArgs)).toBe(router);
  });

  test('insert only matches insert operations', () => {
    router.insert({ filters: {}, handler: async () => {} });

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = router.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeDefined();

    const updateEvent = createDocumentDBUpdateEntry().event;
    // @ts-expect-error - testing private method directly
    const updateResult = router.matchRoute(updateEvent, 'arn:test');
    expect(updateResult).toBeUndefined();
  });

  test('update only matches update operations', () => {
    router.update({ filters: {}, handler: async () => {} });

    const updateEvent = createDocumentDBUpdateEntry().event;
    // @ts-expect-error - testing private method directly
    const updateResult = router.matchRoute(updateEvent, 'arn:test');
    expect(updateResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = router.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  test('replace only matches replace operations', () => {
    router.replace({ filters: {}, handler: async () => {} });

    const replaceEvent = createDocumentDBReplaceEntry().event;
    // @ts-expect-error - testing private method directly
    const replaceResult = router.matchRoute(replaceEvent, 'arn:test');
    expect(replaceResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = router.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  test('delete only matches delete operations', () => {
    router.delete({ filters: {}, handler: async () => {} });

    const deleteEvent = createDocumentDBDeleteEntry().event;
    // @ts-expect-error - testing private method directly
    const deleteResult = router.matchRoute(deleteEvent, 'arn:test');
    expect(deleteResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = router.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  suite('matchRoute', () => {
    test('matches route by operationTypes', () => {
      router.route(
        defineRoute({
          filters: { operationTypes: ['insert'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when operationType does not match', () => {
      router.route(
        defineRoute({
          filters: { operationTypes: ['insert'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBDeleteEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by eventSourceArns', () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      router.route(
        defineRoute({
          filters: { eventSourceArns: [eventSourceArn] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArn does not match', () => {
      router.route(
        defineRoute({
          filters: { eventSourceArns: ['arn:aws:rds:us-east-1:123456789012:cluster:other-cluster'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster');

      expect(result).toBeUndefined();
    });

    test('matches route by databases', () => {
      router.route(
        defineRoute({
          filters: { databases: ['test-db'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when database does not match', () => {
      router.route(
        defineRoute({
          filters: { databases: ['other-db'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by collections', () => {
      router.route(
        defineRoute({
          filters: { collections: ['users'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when collection does not match', () => {
      router.route(
        defineRoute({
          filters: { collections: ['orders'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', () => {
      router.route(
        defineRoute({
          filters: {
            customFilter: ({ ns }: DocumentDBFilterInput): boolean => ns.db === 'special-db',
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'special-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', () => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('customFilter receives correct FilterInput', () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'my-db', coll: 'my-coll' } }).event;
      // @ts-expect-error - testing private method directly
      router.matchRoute(changeEvent, 'arn:test');

      expect(customFilter).toHaveBeenCalledWith({
        operationType: 'insert',
        ns: { db: 'my-db', coll: 'my-coll' },
        event: changeEvent,
      });
    });

    test('customFilter is not called when a prior filter rejects', () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { databases: ['other-db'], customFilter },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      router.matchRoute(changeEvent, 'arn:test');

      expect(customFilter).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', () => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(firstHandler));
      router.route(defineRoute({ filters: {} }).handle(secondHandler));

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });

    test('matches when all combined filters match', () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      router.route(
        defineRoute({
          filters: {
            operationTypes: ['insert'],
            eventSourceArns: [eventSourceArn],
            databases: ['test-db'],
            collections: ['users'],
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db', coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeDefined();
    });

    test('does not match when one of the combined filters does not match', () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      router.route(
        defineRoute({
          filters: {
            operationTypes: ['insert'],
            eventSourceArns: [eventSourceArn],
            databases: ['test-db'],
            collections: ['orders'],
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db', coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls handler with correct request fields', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBInsertEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: entry.event.operationType,
          documentKey: entry.event.documentKey,
          fullDocument: entry.event.fullDocument,
          updateDescription: entry.event.updateDescription,
          fullDocumentBeforeChange: entry.event.fullDocumentBeforeChange,
          changeEvent: entry.event,
          context,
        }),
      );
    });

    test('throws when no route matches', async ({ documentDBHandlerEvent }) => {
      const entry = createDocumentDBInsertEntry();
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      const { event, context } = documentDBHandlerEvent({ entries: [entry], eventSourceArn });
      const expectedMessage = `No route matched for record ${JSON.stringify(entry.event.documentKey)} from ${eventSourceArn}`;
      await expect(router.handleEvent(event, context)).rejects.toThrow(expectedMessage);
    });

    test('propagates handler errors', async ({ documentDBHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = documentDBHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined', async ({ documentDBHandlerEvent }) => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes entries sequentially', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      router.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          const opType = request.operationType;
          callOrder.push(`start-${opType}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${opType}`);
        }),
      );

      const entries = [createDocumentDBInsertEntry(), createDocumentDBUpdateEntry()];
      const { event, context } = documentDBHandlerEvent({ entries });
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['start-insert', 'end-insert', 'start-update', 'end-update']);
    });

    test('fullDocument is undefined on delete', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBDeleteEntry()] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: undefined }));
    });

    test('updateDescription is present on update', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBUpdateEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          updateDescription: entry.event.updateDescription,
        }),
      );
    });

    test('fullDocument is present on update when using updateLookup', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBUpdateEntry({ fullDocument: { _id: { $oid: '123' }, name: 'Updated Document' } });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          fullDocument: { _id: { $oid: '123' }, name: 'Updated Document' },
        }),
      );
    });
  });

  suite('handleEvent - schema validation', () => {
    test('handler receives validated documentKey from documentKeySchema', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      const validatedKey = { _id: 'validated-key' };
      const documentKeySchema: Schema<typeof validatedKey> = {
        safeParse: () => ({ success: true, data: validatedKey }),
      };
      router.route(defineRoute({ filters: {}, documentKeySchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ documentKey: validatedKey }));
    });

    test('throws when documentKeySchema validation fails', async ({ documentDBHandlerEvent }) => {
      const documentKeySchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(defineRoute({ filters: {}, documentKeySchema }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('Schema validation failed on documentKey');
    });

    test('handler receives validated fullDocument from fullDocumentSchema', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      const validatedDoc = { name: 'Validated', extra: true };
      const fullDocumentSchema: Schema<typeof validatedDoc> = {
        safeParse: () => ({ success: true, data: validatedDoc }),
      };
      router.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBInsertEntry()] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: validatedDoc }));
    });

    test('throws when fullDocumentSchema validation fails', async ({ documentDBHandlerEvent }) => {
      const fullDocumentSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBInsertEntry()] });
      await expect(router.handleEvent(event, context)).rejects.toThrow('Schema validation failed on fullDocument');
    });

    test('handler receives validated fullDocumentBeforeChange from fullDocumentBeforeChangeSchema', async ({
      documentDBHandlerEvent,
    }) => {
      const handler = vi.fn();
      const validatedBeforeDoc = { name: 'Before Change', validated: true };
      const fullDocumentBeforeChangeSchema: Schema<typeof validatedBeforeDoc> = {
        safeParse: () => ({ success: true, data: validatedBeforeDoc }),
      };
      router.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(handler));

      const entry = createDocumentDBUpdateEntry({
        fullDocumentBeforeChange: { name: 'Before Change' },
      });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocumentBeforeChange: validatedBeforeDoc }));
    });

    test('throws when fullDocumentBeforeChangeSchema validation fails', async ({ documentDBHandlerEvent }) => {
      const fullDocumentBeforeChangeSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(async () => {}));

      const entry = createDocumentDBUpdateEntry({
        fullDocumentBeforeChange: { name: 'Before Change' },
      });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await expect(router.handleEvent(event, context)).rejects.toThrow(
        'Schema validation failed on fullDocumentBeforeChange',
      );
    });

    test('skips fullDocument validation when fullDocument is undefined (delete)', async ({
      documentDBHandlerEvent,
    }) => {
      const handler = vi.fn();
      const fullDocumentSchema: Schema<unknown> = {
        safeParse: vi.fn(() => ({ success: true as const, data: {} })),
      };
      router.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBDeleteEntry()] });
      await router.handleEvent(event, context);

      expect(fullDocumentSchema.safeParse).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: undefined }));
    });

    test('skips fullDocumentBeforeChange validation when fullDocumentBeforeChange is undefined (insert)', async ({
      documentDBHandlerEvent,
    }) => {
      const handler = vi.fn();
      const fullDocumentBeforeChangeSchema: Schema<unknown> = {
        safeParse: vi.fn(() => ({ success: true as const, data: {} })),
      };
      router.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBInsertEntry()] });
      await router.handleEvent(event, context);

      expect(fullDocumentBeforeChangeSchema.safeParse).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocumentBeforeChange: undefined }));
    });
  });

  suite('validateSchema', () => {
    test('returns validated data on success', () => {
      const validatedData = { _id: 'validated' };
      const schema: Schema<typeof validatedData> = {
        safeParse: () => ({ success: true, data: validatedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema({ _id: 'raw' }, schema, 'documentKey', { _id: 'event-id' });

      expect(result).toEqual(validatedData);
    });

    test('throws with fieldName and eventId on failure', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      const eventId = { _id: 'event-123' };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateSchema({ _id: 'raw' }, schema, 'fullDocument', eventId)).toThrow(
        `Schema validation failed on fullDocument for record ${JSON.stringify(eventId)}`,
      );
    });

    test('returns data unchanged when no schema is provided', () => {
      const data = { _id: 'raw' };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, undefined, 'documentKey', { _id: 'event-id' });

      expect(result).toBe(data);
    });

    test('returns undefined when data is undefined', () => {
      const schema: Schema<unknown> = {
        safeParse: vi.fn(() => ({ success: true as const, data: {} })),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(undefined, schema, 'fullDocument', { _id: 'event-id' });

      expect(result).toBeUndefined();
      expect(schema.safeParse).not.toHaveBeenCalled();
    });
  });

  suite('full event processing', () => {
    test('routes 4 operation types to respective handlers', async ({ documentDBHandlerEvent }) => {
      const insertHandler = vi.fn();
      const updateHandler = vi.fn();
      const replaceHandler = vi.fn();
      const deleteHandler = vi.fn();
      router
        .insert({ filters: {}, handler: insertHandler })
        .update({ filters: {}, handler: updateHandler })
        .replace({ filters: {}, handler: replaceHandler })
        .delete({ filters: {}, handler: deleteHandler });

      const entries = [
        createDocumentDBInsertEntry(),
        createDocumentDBUpdateEntry(),
        createDocumentDBReplaceEntry(),
        createDocumentDBDeleteEntry(),
      ];
      const { event, context } = documentDBHandlerEvent({ entries });
      await router.handleEvent(event, context);

      expect(insertHandler).toHaveBeenCalledTimes(1);
      expect(updateHandler).toHaveBeenCalledTimes(1);
      expect(replaceHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    test('routes by collection filter', async ({ documentDBHandlerEvent }) => {
      const usersHandler = vi.fn();
      const ordersHandler = vi.fn();
      router
        .route(defineRoute({ filters: { collections: ['users'] } }).handle(usersHandler))
        .route(defineRoute({ filters: { collections: ['orders'] } }).handle(ordersHandler));

      const entries = [
        createDocumentDBInsertEntry({ ns: { coll: 'users' } }),
        createDocumentDBInsertEntry({ ns: { coll: 'users' } }),
        createDocumentDBInsertEntry({ ns: { coll: 'orders' } }),
      ];
      const { event, context } = documentDBHandlerEvent({ entries });
      await router.handleEvent(event, context);

      expect(usersHandler).toHaveBeenCalledTimes(2);
      expect(ordersHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all operation types', async ({ documentDBHandlerEvent }) => {
      const catchAllHandler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const entries = [
        createDocumentDBInsertEntry(),
        createDocumentDBUpdateEntry(),
        createDocumentDBReplaceEntry(),
        createDocumentDBDeleteEntry(),
      ];
      const { event, context } = documentDBHandlerEvent({ entries });
      await router.handleEvent(event, context);

      expect(catchAllHandler).toHaveBeenCalledTimes(4);
    });

    test('error in one entry prevents subsequent entries from being processed', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn().mockImplementation(async (request) => {
        if (request.operationType === 'update') {
          throw new Error('update failed');
        }
      });
      router.route(defineRoute({ filters: {} }).handle(handler));

      const entries = [createDocumentDBInsertEntry(), createDocumentDBUpdateEntry(), createDocumentDBReplaceEntry()];
      const { event, context } = documentDBHandlerEvent({ entries });
      await expect(router.handleEvent(event, context)).rejects.toThrow('update failed');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
