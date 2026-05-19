import type { Context } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { filterStringMatcher, handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';

import type { FiltersToRequest, InternalRoute, RouteBuilder, RouteInput } from './routeTypes.js';
import type {
  DocumentDBChangeEvent,
  DocumentDBDeleteRouteDefinition,
  DocumentDBEvent,
  DocumentDBEventEntry,
  DocumentDBFilters,
  DocumentDBInsertRouteDefinition,
  DocumentDBReplaceRouteDefinition,
  DocumentDBRequest,
  DocumentDBRouteDefinition,
  DocumentDBRouterOptions,
  DocumentDBUpdateRouteDefinition,
} from './types.js';

export function defineRoute<
  TDocumentKeySchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentSchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentBeforeChangeSchema extends StandardSchemaV1 | undefined = undefined,
  const TFilters extends DocumentDBFilters = DocumentDBFilters,
  TDocumentKey = TDocumentKeySchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TDocumentKeySchema>
    : Record<string, unknown>,
  TFullDocument = TFullDocumentSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TFullDocumentSchema>
    : Record<string, unknown>,
  TFullDocumentBeforeChange = TFullDocumentBeforeChangeSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TFullDocumentBeforeChangeSchema>
    : Record<string, unknown>,
>(
  config: RouteInput<TDocumentKeySchema, TFullDocumentSchema, TFullDocumentBeforeChangeSchema, TFilters>,
): RouteBuilder<TDocumentKey, TFullDocument, TFullDocumentBeforeChange, TFilters> {
  return {
    handle(
      handler: (
        request: FiltersToRequest<TFilters, TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
      ) => Promise<void>,
    ): DocumentDBRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange> {
      // Casts bridge the narrowed RouteInput shape back to the public route definition.
      // Handler is contravariant in the request union: FiltersToRequest narrows the request,
      // but DocumentDBRouteDefinition expects the full discriminated union.
      return {
        filters: config.filters,
        documentKeySchema: config.documentKeySchema as StandardSchemaV1<unknown, TDocumentKey> | undefined,
        fullDocumentSchema: config.fullDocumentSchema as StandardSchemaV1<unknown, TFullDocument> | undefined,
        fullDocumentBeforeChangeSchema: config.fullDocumentBeforeChangeSchema as
          | StandardSchemaV1<unknown, TFullDocumentBeforeChange>
          | undefined,
        middleware: config.middleware as DocumentDBRouteDefinition<
          TDocumentKey,
          TFullDocument,
          TFullDocumentBeforeChange
        >['middleware'],
        handler: handler as (
          request: DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
        ) => Promise<void>,
      };
    },
  };
}

export class DocumentDBRouter implements EventTypeRouter<DocumentDBEvent, undefined> {
  private routes: InternalRoute[] = [];
  private middleware: Middleware<DocumentDBRequest, void>[];

  constructor(options?: DocumentDBRouterOptions) {
    this.middleware = (options?.middleware ?? []) as Middleware<DocumentDBRequest, void>[];
  }

  canHandleEvent(event: unknown): event is DocumentDBEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.events)) return false;

    return event.eventSource === 'aws:docdb';
  }

  route<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>(
    definition: DocumentDBRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute(definition as InternalRoute);
  }

  insert<TDocumentKey, TFullDocument>(definition: DocumentDBInsertRouteDefinition<TDocumentKey, TFullDocument>): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationType: 'insert' },
    } as InternalRoute);
  }

  update<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>(
    definition: DocumentDBUpdateRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationType: 'update' },
    } as InternalRoute);
  }

  replace<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>(
    definition: DocumentDBReplaceRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationType: 'replace' },
    } as InternalRoute);
  }

  delete<TDocumentKey, TFullDocumentBeforeChange>(
    definition: DocumentDBDeleteRouteDefinition<TDocumentKey, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationType: 'delete' },
    } as InternalRoute);
  }

  private addRoute(definition: InternalRoute): this {
    this.routes.push({
      ...definition,
      middleware: definition.middleware ?? [],
    });
    return this;
  }

  async handleEvent(event: DocumentDBEvent, context: Context): Promise<undefined> {
    for (const entry of event.events) {
      await this.processEntry(entry, event.eventSourceArn, context);
    }
    return undefined;
  }

  private async processEntry(entry: DocumentDBEventEntry, eventSourceArn: string, context: Context): Promise<void> {
    const changeEvent = entry.event;
    const route = await this.matchRoute(changeEvent, eventSourceArn);

    if (!route) {
      throw new Error(`No route matched for record ${JSON.stringify(changeEvent.documentKey)} from ${eventSourceArn}`);
    }

    /* v8 ignore next -- @preserve - Guard is for TS. DocumentDB always provides documentKey as an object */
    if (!isObject(changeEvent.documentKey)) {
      throw new Error(`documentKey is not an object for record from ${eventSourceArn}`);
    }

    const documentKeyErrorMessage = `Schema validation failed on documentKey for record ${JSON.stringify(changeEvent.documentKey)}`;
    const documentKey = await validateSchema(changeEvent.documentKey, route.documentKeySchema, documentKeyErrorMessage);

    const fullDocumentObject = isObject(changeEvent.fullDocument) ? changeEvent.fullDocument : undefined;
    const fullDocumentErrorMessage = `Schema validation failed on fullDocument for record ${JSON.stringify(changeEvent.documentKey)}`;
    const fullDocument = await validateSchema(fullDocumentObject, route.fullDocumentSchema, fullDocumentErrorMessage);

    const fullDocumentBeforeChangeObject = isObject(changeEvent.fullDocumentBeforeChange)
      ? changeEvent.fullDocumentBeforeChange
      : undefined;
    const fullDocumentBeforeChangeErrorMessage = `Schema validation failed on fullDocumentBeforeChange for record ${JSON.stringify(changeEvent.documentKey)}`;
    const fullDocumentBeforeChange = await validateSchema(
      fullDocumentBeforeChangeObject,
      route.fullDocumentBeforeChangeSchema,
      fullDocumentBeforeChangeErrorMessage,
    );

    // The discriminated request union is built at runtime from the event's operationType -
    // TS can't narrow it from a dynamic discriminant, hence the cast
    const request = {
      operationType: changeEvent.operationType,
      documentKey,
      fullDocument,
      updateDescription: changeEvent.updateDescription,
      fullDocumentBeforeChange,
      changeEvent,
      entry,
      context,
    } as DocumentDBRequest;

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    changeEvent: DocumentDBChangeEvent,
    eventSourceArn: string,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;

      if (filters.operationType) {
        const operationTypes = Array.isArray(filters.operationType) ? filters.operationType : [filters.operationType];
        if (!operationTypes.includes(changeEvent.operationType)) {
          continue;
        }
      }

      if (filters.eventSourceArn) {
        const eventSourceArnMatch = filterStringMatcher(eventSourceArn, filters.eventSourceArn);
        if (!eventSourceArnMatch) continue;
      }

      if (filters.database) {
        const databaseMatch = filterStringMatcher(changeEvent.ns.db, filters.database);
        if (!databaseMatch) continue;
      }

      if (filters.collection) {
        const collectionMatch = filterStringMatcher(changeEvent.ns.coll, filters.collection);
        if (!collectionMatch) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({
          operationType: changeEvent.operationType,
          ns: changeEvent.ns,
          event: changeEvent,
        });
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }
}

export function createDocumentDBRouter(options?: DocumentDBRouterOptions): DocumentDBRouter {
  return new DocumentDBRouter(options);
}
