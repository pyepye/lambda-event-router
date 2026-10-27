import type { MockInstance } from 'vitest';

import * as base from '@latcher/base';
import {
  allEventBuilders,
  createDocumentDBDeleteEntry,
  createDocumentDBEvent,
  createDocumentDBInsertEntry,
  createDocumentDBReplaceEntry,
  createDocumentDBUpdateEntry,
  createMockSchema,
  test,
} from '@latcher/testing';

import { createDocumentDBMatcher, defineRoute, DocumentDBMatcher } from './DocumentDBMatcher.js';
import type { DocumentDBFilterInput, DocumentDBMiddleware, DocumentDBRequest } from './types.js';

type DocumentDBNext = (request: DocumentDBRequest) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('DocumentDBMatcher', () => {
  let matcher: DocumentDBMatcher;

  beforeEach(() => {
    matcher = new DocumentDBMatcher();
  });

  suite('createDocumentDBMatcher', () => {
    test('creates a DocumentDBMatcher instance', () => {
      const matcher = createDocumentDBMatcher();
      expect(matcher).toBeInstanceOf(DocumentDBMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid DocumentDB event', () => {
      const event = createDocumentDBEvent();
      expect(matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for an array', () => {
      expect(matcher.canHandleEvent([1, 2, 3])).toBe(false);
    });

    test('returns false when events is not an array', () => {
      expect(matcher.canHandleEvent({ events: 'not-an-array', eventSource: 'aws:docdb' })).toBe(false);
    });

    test('returns false when events is missing', () => {
      expect(matcher.canHandleEvent({ eventSource: 'aws:docdb' })).toBe(false);
    });

    test('returns false when eventSource is not aws:docdb', () => {
      expect(matcher.canHandleEvent({ events: [], eventSource: 'aws:dynamodb' })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { eventSourceArn: 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const documentKeySchema = createMockSchema();
      const fullDocumentSchema = createMockSchema();
      const fullDocumentBeforeChangeSchema = createMockSchema();
      const handler = vi.fn();
      const filters = {
        eventSourceArn: 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster',
        database: 'test-db',
      };

      const definition = defineRoute({
        filters,
        documentKeySchema,
        fullDocumentSchema,
        fullDocumentBeforeChangeSchema,
      }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.documentKeySchema).toBe(documentKeySchema);
      expect(definition.fullDocumentSchema).toBe(fullDocumentSchema);
      expect(definition.fullDocumentBeforeChangeSchema).toBe(fullDocumentBeforeChangeSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  test('route, insert, update, replace, and delete return the matcher instance for chaining', () => {
    const definition = defineRoute({
      filters: { eventSourceArn: 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster' },
    }).handle(async () => {});
    const operationArgs = { filters: {}, handler: async () => {} };

    expect(matcher.route(definition)).toBe(matcher);
    expect(matcher.insert(operationArgs)).toBe(matcher);
    expect(matcher.update(operationArgs)).toBe(matcher);
    expect(matcher.replace(operationArgs)).toBe(matcher);
    expect(matcher.delete(operationArgs)).toBe(matcher);
  });

  test('insert only matches insert operations', async () => {
    matcher.insert({ filters: {}, handler: async () => {} });

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = await matcher.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeDefined();

    const updateEvent = createDocumentDBUpdateEntry().event;
    // @ts-expect-error - testing private method directly
    const updateResult = await matcher.matchRoute(updateEvent, 'arn:test');
    expect(updateResult).toBeUndefined();
  });

  test('update only matches update operations', async () => {
    matcher.update({ filters: {}, handler: async () => {} });

    const updateEvent = createDocumentDBUpdateEntry().event;
    // @ts-expect-error - testing private method directly
    const updateResult = await matcher.matchRoute(updateEvent, 'arn:test');
    expect(updateResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = await matcher.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  test('replace only matches replace operations', async () => {
    matcher.replace({ filters: {}, handler: async () => {} });

    const replaceEvent = createDocumentDBReplaceEntry().event;
    // @ts-expect-error - testing private method directly
    const replaceResult = await matcher.matchRoute(replaceEvent, 'arn:test');
    expect(replaceResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = await matcher.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  test('delete only matches delete operations', async () => {
    matcher.delete({ filters: {}, handler: async () => {} });

    const deleteEvent = createDocumentDBDeleteEntry().event;
    // @ts-expect-error - testing private method directly
    const deleteResult = await matcher.matchRoute(deleteEvent, 'arn:test');
    expect(deleteResult).toBeDefined();

    const insertEvent = createDocumentDBInsertEntry().event;
    // @ts-expect-error - testing private method directly
    const insertResult = await matcher.matchRoute(insertEvent, 'arn:test');
    expect(insertResult).toBeUndefined();
  });

  suite('matchRoute', () => {
    test('matches route by operationType', async () => {
      matcher.route(
        defineRoute({
          filters: { operationType: 'insert' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('matches route by operationType array', async () => {
      matcher.route(
        defineRoute({
          filters: { operationType: ['insert', 'update'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBUpdateEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when operationType does not match', async () => {
      matcher.route(
        defineRoute({
          filters: { operationType: 'insert' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBDeleteEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by eventSourceArn', async () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      matcher.route(
        defineRoute({
          filters: { eventSourceArn },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeDefined();
    });

    test('matches route by eventSourceArn array', async () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: [eventSourceArn, 'arn:aws:rds:us-east-1:123456789012:cluster:other-cluster'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeDefined();
    });

    test('does not match route when eventSourceArn does not match', async () => {
      matcher.route(
        defineRoute({
          filters: { eventSourceArn: 'arn:aws:rds:us-east-1:123456789012:cluster:other-cluster' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(
        changeEvent,
        'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster',
      );

      expect(result).toBeUndefined();
    });

    test('matches route by database', async () => {
      matcher.route(
        defineRoute({
          filters: { database: 'test-db' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match when database is an empty string', async () => {
      matcher.route(
        defineRoute({
          filters: { database: '' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by database array', async () => {
      matcher.route(
        defineRoute({
          filters: { database: ['test-db', 'other-db'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'other-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when database does not match', async () => {
      matcher.route(
        defineRoute({
          filters: { database: 'other-db' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by collection', async () => {
      matcher.route(
        defineRoute({
          filters: { collection: 'users' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('matches route by collection array', async () => {
      matcher.route(
        defineRoute({
          filters: { collection: ['users', 'orders'] },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { coll: 'orders' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when collection does not match', async () => {
      matcher.route(
        defineRoute({
          filters: { collection: 'orders' },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('matches route by custom', async () => {
      matcher.route(
        defineRoute({
          filters: {
            custom: ({ ns }: DocumentDBFilterInput): boolean => ns.db === 'special-db',
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'special-db' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async () => {
      matcher.route(
        defineRoute({
          filters: { custom: (): boolean => false },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeUndefined();
    });

    test('custom receives correct FilterInput', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'my-db', coll: 'my-coll' } }).event;
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(changeEvent, 'arn:test');

      expect(custom).toHaveBeenCalledWith({
        operationType: 'insert',
        ns: { db: 'my-db', coll: 'my-coll' },
        event: changeEvent,
      });
    });

    test('custom is not called when a prior filter rejects', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineRoute({
          filters: { database: 'other-db', custom },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db' } }).event;
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(changeEvent, 'arn:test');

      expect(custom).not.toHaveBeenCalled();
    });

    test('matches route with empty filters as a catch-all', async () => {
      matcher.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
    });

    test('selects the first matching route when multiple routes match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(firstHandler));
      matcher.route(defineRoute({ filters: {} }).handle(secondHandler));

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async () => {
      const broad = vi.fn();
      const narrow = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(broad));
      matcher.route(defineRoute({ filters: { operationType: 'insert' } }).handle(narrow));

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      matcher.route(defineRoute({ filters: { operationType: 'insert' } }).handle(fallback));
      matcher.route(defineRoute({ filters: { operationType: 'insert', custom: () => true } }).handle(guarded));

      const changeEvent = createDocumentDBInsertEntry().event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, 'arn:test');

      expect(result?.handler).toBe(guarded);
    });

    test('matches when all combined filters match', async () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      matcher.route(
        defineRoute({
          filters: {
            operationType: 'insert',
            eventSourceArn: eventSourceArn,
            database: 'test-db',
            collection: 'users',
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db', coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeDefined();
    });

    test('does not match when one of the combined filters does not match', async () => {
      const eventSourceArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';
      matcher.route(
        defineRoute({
          filters: {
            operationType: 'insert',
            eventSourceArn: eventSourceArn,
            database: 'test-db',
            collection: 'orders',
          },
        }).handle(async () => {}),
      );

      const changeEvent = createDocumentDBInsertEntry({ ns: { db: 'test-db', coll: 'users' } }).event;
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(changeEvent, eventSourceArn);

      expect(result).toBeUndefined();
    });

    test('matches route by async custom', async () => {
      matcher.route(
        defineRoute({
          filters: {
            custom: async ({ ns }: DocumentDBFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return ns.db === 'async-db';
            },
          },
        }).handle(async () => {}),
      );

      const matchingEvent = createDocumentDBInsertEntry({ ns: { db: 'async-db' } }).event;
      // @ts-expect-error - testing private method directly
      const matchResult = await matcher.matchRoute(matchingEvent, 'arn:test');
      expect(matchResult).toBeDefined();

      const nonMatchingEvent = createDocumentDBInsertEntry({ ns: { db: 'other-db' } }).event;
      // @ts-expect-error - testing private method directly
      const noMatchResult = await matcher.matchRoute(nonMatchingEvent, 'arn:test');
      expect(noMatchResult).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls handler with correct request fields', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBInsertEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

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
      await expect(matcher.handleEvent(event, context)).rejects.toThrow(expectedMessage);
    });

    test('propagates handler errors', async ({ documentDBHandlerEvent }) => {
      matcher.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = documentDBHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('returns undefined', async ({ documentDBHandlerEvent }) => {
      matcher.route(defineRoute({ filters: {} }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent();
      const result = await matcher.handleEvent(event, context);

      expect(result).toBeUndefined();
    });

    test('processes entries sequentially', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      matcher.route(
        defineRoute({ filters: {} }).handle(async (request) => {
          const opType = request.operationType;
          callOrder.push(`start-${opType}`);
          await new Promise((resolve) => setTimeout(resolve, 1));
          callOrder.push(`end-${opType}`);
        }),
      );

      const entries = [createDocumentDBInsertEntry(), createDocumentDBUpdateEntry()];
      const { event, context } = documentDBHandlerEvent({ entries });
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['start-insert', 'end-insert', 'start-update', 'end-update']);
    });

    test('fullDocument is undefined on delete', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBDeleteEntry()] });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: undefined }));
    });

    test('updateDescription is present on update', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBUpdateEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          updateDescription: entry.event.updateDescription,
        }),
      );
    });

    test('fullDocument is present on update when using updateLookup', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const entry = createDocumentDBUpdateEntry({ fullDocument: { _id: { $oid: '123' }, name: 'Updated Document' } });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

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
      const documentKeySchema = createMockSchema();
      matcher.route(defineRoute({ filters: {}, documentKeySchema }).handle(handler));

      const entry = createDocumentDBInsertEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(entry.event.documentKey, documentKeySchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ documentKey: entry.event.documentKey }));
    });

    test('throws when documentKeySchema validation fails', async ({ documentDBHandlerEvent }) => {
      const documentKeySchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      matcher.route(defineRoute({ filters: {}, documentKeySchema }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Schema validation failed on documentKey');
    });

    test('handler receives validated fullDocument from fullDocumentSchema', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      const fullDocumentSchema = createMockSchema();
      matcher.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(handler));

      const entry = createDocumentDBInsertEntry();
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(entry.event.fullDocument, fullDocumentSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: entry.event.fullDocument }));
    });

    test('throws when fullDocumentSchema validation fails', async ({ documentDBHandlerEvent }) => {
      const fullDocumentSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      matcher.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(async () => {}));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBInsertEntry()] });
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Schema validation failed on fullDocument');
    });

    test('handler receives validated fullDocumentBeforeChange from fullDocumentBeforeChangeSchema', async ({
      documentDBHandlerEvent,
    }) => {
      const handler = vi.fn();
      const fullDocumentBeforeChangeSchema = createMockSchema();
      matcher.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(handler));

      const entry = createDocumentDBUpdateEntry({
        fullDocumentBeforeChange: { name: 'Before Change' },
      });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        { name: 'Before Change' },
        fullDocumentBeforeChangeSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ fullDocumentBeforeChange: { name: 'Before Change' } }),
      );
    });

    test('throws when fullDocumentBeforeChangeSchema validation fails', async ({ documentDBHandlerEvent }) => {
      const fullDocumentBeforeChangeSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      matcher.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(async () => {}));

      const entry = createDocumentDBUpdateEntry({
        fullDocumentBeforeChange: { name: 'Before Change' },
      });
      const { event, context } = documentDBHandlerEvent({ entries: [entry] });
      await expect(matcher.handleEvent(event, context)).rejects.toThrow(
        'Schema validation failed on fullDocumentBeforeChange',
      );
    });

    test('passes undefined fullDocument through validation on delete', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();
      const fullDocumentSchema = createMockSchema();
      matcher.route(defineRoute({ filters: {}, fullDocumentSchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBDeleteEntry()] });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(undefined, fullDocumentSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocument: undefined }));
    });

    test('passes undefined fullDocumentBeforeChange through validation on insert', async ({
      documentDBHandlerEvent,
    }) => {
      const handler = vi.fn();
      const fullDocumentBeforeChangeSchema = createMockSchema();
      matcher.route(defineRoute({ filters: {}, fullDocumentBeforeChangeSchema }).handle(handler));

      const { event, context } = documentDBHandlerEvent({ entries: [createDocumentDBInsertEntry()] });
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(undefined, fullDocumentBeforeChangeSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ fullDocumentBeforeChange: undefined }));
    });
  });

  suite('full event processing', () => {
    test('routes 4 operation types to respective handlers', async ({ documentDBHandlerEvent }) => {
      const insertHandler = vi.fn();
      const updateHandler = vi.fn();
      const replaceHandler = vi.fn();
      const deleteHandler = vi.fn();
      matcher
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
      await matcher.handleEvent(event, context);

      expect(insertHandler).toHaveBeenCalledTimes(1);
      expect(updateHandler).toHaveBeenCalledTimes(1);
      expect(replaceHandler).toHaveBeenCalledTimes(1);
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });

    test('routes by collection filter', async ({ documentDBHandlerEvent }) => {
      const usersHandler = vi.fn();
      const ordersHandler = vi.fn();
      matcher
        .route(defineRoute({ filters: { collection: 'users' } }).handle(usersHandler))
        .route(defineRoute({ filters: { collection: 'orders' } }).handle(ordersHandler));

      const entries = [
        createDocumentDBInsertEntry({ ns: { coll: 'users' } }),
        createDocumentDBInsertEntry({ ns: { coll: 'users' } }),
        createDocumentDBInsertEntry({ ns: { coll: 'orders' } }),
      ];
      const { event, context } = documentDBHandlerEvent({ entries });
      await matcher.handleEvent(event, context);

      expect(usersHandler).toHaveBeenCalledTimes(2);
      expect(ordersHandler).toHaveBeenCalledTimes(1);
    });

    test('catch-all route handles all operation types', async ({ documentDBHandlerEvent }) => {
      const catchAllHandler = vi.fn();
      matcher.route(defineRoute({ filters: {} }).handle(catchAllHandler));

      const entries = [
        createDocumentDBInsertEntry(),
        createDocumentDBUpdateEntry(),
        createDocumentDBReplaceEntry(),
        createDocumentDBDeleteEntry(),
      ];
      const { event, context } = documentDBHandlerEvent({ entries });
      await matcher.handleEvent(event, context);

      expect(catchAllHandler).toHaveBeenCalledTimes(4);
    });

    test('error in one entry prevents subsequent entries from being processed', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn().mockImplementation(async (request) => {
        if (request.operationType === 'update') {
          throw new Error('update failed');
        }
      });
      matcher.route(defineRoute({ filters: {} }).handle(handler));

      const entries = [createDocumentDBInsertEntry(), createDocumentDBUpdateEntry(), createDocumentDBReplaceEntry()];
      const { event, context } = documentDBHandlerEvent({ entries });
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('update failed');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const matcher = createDocumentDBMatcher({ middleware: [middleware] });
      matcher.insert({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('executes middleware per-entry for multi-entry events', async ({ context }) => {
      const entryCount: number[] = [];
      let callCount = 0;

      async function middleware(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callCount++;
        entryCount.push(callCount);
        await next(request);
      }

      const matcher = createDocumentDBMatcher({ middleware: [middleware] });
      matcher.insert({ filters: {}, handler: async () => {} });

      const entries = [createDocumentDBInsertEntry(), createDocumentDBInsertEntry()];
      const event = createDocumentDBEvent(entries);
      await matcher.handleEvent(event, context());

      expect(entryCount).toEqual([1, 2]);
    });

    test('allows middleware to skip an entry by not calling next', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: DocumentDBRequest, _next: DocumentDBNext): Promise<void> {
        return;
      }

      const matcher = createDocumentDBMatcher({ middleware: [skipMiddleware] });
      matcher.insert({ filters: {}, handler });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const matcher = createDocumentDBMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.insert({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }
      matcher.insert({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ documentDBHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: DocumentDBRequest, _next: DocumentDBNext): Promise<void> {
        return;
      }
      matcher.insert({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }
      matcher.insert({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      const routeMiddleware: DocumentDBMiddleware = async (request: DocumentDBRequest, next: DocumentDBNext) => {
        callOrder.push('route-mw');
        await next(request);
      };

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });
      matcher.route(route);

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async ({ documentDBHandlerEvent }) => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('matcher-mw');
        await next(request);
      }

      async function routeMiddleware(request: DocumentDBRequest, next: DocumentDBNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const matcher = createDocumentDBMatcher({ middleware: [matcherMiddleware] });
      matcher.insert({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async ({
      documentDBHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: DocumentDBRequest, _next: DocumentDBNext): Promise<void> {
        return;
      }

      const matcher = createDocumentDBMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.insert({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = documentDBHandlerEvent();
      await matcher.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ documentDBHandlerEvent }) => {
      const middleware = vi.fn();
      const documentKeySchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const matcher = createDocumentDBMatcher({ middleware: [middleware] });
      matcher.insert({ filters: {}, documentKeySchema, handler: vi.fn() });

      const { event, context } = documentDBHandlerEvent();
      await expect(matcher.handleEvent(event, context)).rejects.toThrow('Schema validation failed');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});

suite('DocumentDBMatcher.canHandleEvent', () => {
  const ownEvents = ['createDocumentDBEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createDocumentDBMatcher().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});
