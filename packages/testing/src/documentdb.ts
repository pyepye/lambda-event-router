import type { Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// Local DocumentDB types — aws-lambda has no DocumentDB types, and importing from
// @lambda-event-router/documentdb would create a circular dependency
type DocumentDBOperationType = 'insert' | 'update' | 'replace' | 'delete';

interface DocumentDBUpdateDescription {
  updatedFields?: Record<string, unknown>;
  removedFields?: string[];
}

interface DocumentDBChangeEvent {
  _id: unknown;
  clusterTime: unknown;
  operationType: DocumentDBOperationType;
  ns: { db: string; coll: string };
  documentKey: unknown;
  fullDocument?: unknown;
  updateDescription?: DocumentDBUpdateDescription;
  fullDocumentBeforeChange?: unknown;
}

interface DocumentDBEventEntry {
  event: DocumentDBChangeEvent;
}

interface DocumentDBEvent {
  eventSourceArn: string;
  eventSource: 'aws:docdb';
  events: DocumentDBEventEntry[];
}

export type DocumentDBChangeEventOverrides = Partial<Omit<DocumentDBChangeEvent, 'ns' | 'updateDescription'>> & {
  ns?: Partial<DocumentDBChangeEvent['ns']>;
  updateDescription?: Partial<DocumentDBUpdateDescription>;
};

export interface DocumentDBHandlerEvent {
  event: DocumentDBEvent;
  context: Context;
}

export interface CreateDocumentDBHandlerEventOptions {
  entries?: DocumentDBEventEntry[];
  eventSourceArn?: string;
  context?: Partial<Context>;
}

export function createDocumentDBChangeEvent(overrides: DocumentDBChangeEventOverrides = {}): DocumentDBChangeEvent {
  const { ns: nsOverrides, updateDescription: updateDescriptionOverrides, ...restOverrides } = overrides;

  return {
    _id: { _data: crypto.randomUUID() },
    clusterTime: { $timestamp: { t: 1704067200, i: 1 } },
    operationType: 'insert',
    ns: {
      db: 'test-db',
      coll: 'test-collection',
      ...nsOverrides,
    },
    documentKey: { _id: { $oid: crypto.randomUUID() } },
    fullDocument: { _id: { $oid: crypto.randomUUID() }, name: 'Test Document', status: 'active' },
    ...(updateDescriptionOverrides
      ? { updateDescription: { updatedFields: {}, removedFields: [], ...updateDescriptionOverrides } }
      : {}),
    ...restOverrides,
  };
}

export function createDocumentDBInsertEntry(overrides: DocumentDBChangeEventOverrides = {}): DocumentDBEventEntry {
  return {
    event: createDocumentDBChangeEvent({
      operationType: 'insert',
      fullDocument: { _id: { $oid: crypto.randomUUID() }, name: 'Inserted Document' },
      ...overrides,
    }),
  };
}

export function createDocumentDBUpdateEntry(overrides: DocumentDBChangeEventOverrides = {}): DocumentDBEventEntry {
  const { fullDocument, ...restOverrides } = overrides;
  return {
    event: createDocumentDBChangeEvent({
      operationType: 'update',
      ...(fullDocument !== undefined ? { fullDocument } : { fullDocument: undefined }),
      updateDescription: {
        updatedFields: { status: 'updated' },
        removedFields: [],
        ...overrides.updateDescription,
      },
      ...restOverrides,
    }),
  };
}

export function createDocumentDBReplaceEntry(overrides: DocumentDBChangeEventOverrides = {}): DocumentDBEventEntry {
  return {
    event: createDocumentDBChangeEvent({
      operationType: 'replace',
      fullDocument: { _id: { $oid: crypto.randomUUID() }, name: 'Replaced Document' },
      ...overrides,
    }),
  };
}

export function createDocumentDBDeleteEntry(overrides: DocumentDBChangeEventOverrides = {}): DocumentDBEventEntry {
  const { fullDocument: _fullDocument, updateDescription: _updateDescription, ...restOverrides } = overrides;
  return {
    event: createDocumentDBChangeEvent({
      operationType: 'delete',
      fullDocument: undefined,
      ...restOverrides,
    }),
  };
}

const defaultArn = 'arn:aws:rds:us-east-1:123456789012:cluster:my-docdb-cluster';

export function createDocumentDBEvent(
  entries: DocumentDBEventEntry[] = [createDocumentDBInsertEntry()],
): DocumentDBEvent {
  return {
    eventSourceArn: defaultArn,
    eventSource: 'aws:docdb',
    events: entries,
  };
}

export function createDocumentDBHandlerEvent(
  options: CreateDocumentDBHandlerEventOptions = {},
): DocumentDBHandlerEvent {
  const event = createDocumentDBEvent(options.entries);
  if (options.eventSourceArn) {
    event.eventSourceArn = options.eventSourceArn;
  }
  const context = createMockContext(options.context);
  return { event, context };
}

export interface DocumentDBFixtures {
  documentDBChangeEvent: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBChangeEvent>;
  documentDBInsertEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBInsertEntry>;
  documentDBUpdateEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBUpdateEntry>;
  documentDBReplaceEntry: (
    overrides?: DocumentDBChangeEventOverrides,
  ) => ReturnType<typeof createDocumentDBReplaceEntry>;
  documentDBDeleteEntry: (overrides?: DocumentDBChangeEventOverrides) => ReturnType<typeof createDocumentDBDeleteEntry>;
  documentDBEvent: (
    entries?: ReturnType<typeof createDocumentDBInsertEntry>[],
  ) => ReturnType<typeof createDocumentDBEvent>;
  documentDBHandlerEvent: (options?: CreateDocumentDBHandlerEventOptions) => DocumentDBHandlerEvent;
}

export const documentDBFixtures: FixtureMap<DocumentDBFixtures> = {
  documentDBChangeEvent: fixture(createDocumentDBChangeEvent),
  documentDBInsertEntry: fixture(createDocumentDBInsertEntry),
  documentDBUpdateEntry: fixture(createDocumentDBUpdateEntry),
  documentDBReplaceEntry: fixture(createDocumentDBReplaceEntry),
  documentDBDeleteEntry: fixture(createDocumentDBDeleteEntry),
  documentDBEvent: fixture(createDocumentDBEvent),
  documentDBHandlerEvent: fixture(createDocumentDBHandlerEvent),
};
