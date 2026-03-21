import type { EventTypeRouter, InferSchema, Schema } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { Context } from 'aws-lambda';
import type {
  DocumentDBFilters,
  FiltersToRequest,
  InternalRequest,
  InternalRoute,
  RouteBuilder,
  RouteInput,
  RouteInputFilters,
} from './routeTypes.js';
import type {
  DocumentDBChangeEvent,
  DocumentDBDeleteRouteDefinition,
  DocumentDBEvent,
  DocumentDBEventEntry,
  DocumentDBInsertRouteDefinition,
  DocumentDBReplaceRouteDefinition,
  DocumentDBRequest,
  DocumentDBRouteDefinition,
  DocumentDBRouterOptions,
  DocumentDBUpdateRouteDefinition,
} from './types.js';

export function defineRoute<
  TDocumentKeySchema extends Schema<unknown> | undefined = undefined,
  TFullDocumentSchema extends Schema<unknown> | undefined = undefined,
  TFullDocumentBeforeChangeSchema extends Schema<unknown> | undefined = undefined,
  const TFilters extends RouteInputFilters = RouteInputFilters,
  TDocumentKey = TDocumentKeySchema extends Schema<unknown> ? InferSchema<TDocumentKeySchema> : Record<string, unknown>,
  TFullDocument = TFullDocumentSchema extends Schema<unknown>
    ? InferSchema<TFullDocumentSchema>
    : Record<string, unknown>,
  TFullDocumentBeforeChange = TFullDocumentBeforeChangeSchema extends Schema<unknown>
    ? InferSchema<TFullDocumentBeforeChangeSchema>
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
      return {
        filters: config.filters as DocumentDBFilters,
        documentKeySchema: config.documentKeySchema as Schema<TDocumentKey> | undefined,
        fullDocumentSchema: config.fullDocumentSchema as Schema<TFullDocument> | undefined,
        fullDocumentBeforeChangeSchema: config.fullDocumentBeforeChangeSchema as
          | Schema<TFullDocumentBeforeChange>
          | undefined,
        handler: handler as (
          request: DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
        ) => Promise<void>,
      };
    },
  };
}

export class DocumentDBRouter implements EventTypeRouter<DocumentDBEvent, undefined> {
  private routes: InternalRoute[] = [];

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
      filters: { ...definition.filters, operationTypes: ['insert'] },
    } as InternalRoute);
  }

  update<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>(
    definition: DocumentDBUpdateRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationTypes: ['update'] },
    } as InternalRoute);
  }

  replace<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>(
    definition: DocumentDBReplaceRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationTypes: ['replace'] },
    } as InternalRoute);
  }

  delete<TDocumentKey, TFullDocumentBeforeChange>(
    definition: DocumentDBDeleteRouteDefinition<TDocumentKey, TFullDocumentBeforeChange>,
  ): this {
    return this.addRoute({
      ...definition,
      filters: { ...definition.filters, operationTypes: ['delete'] },
    } as InternalRoute);
  }

  private addRoute(definition: InternalRoute): this {
    this.routes.push(definition);
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
    const route = this.matchRoute(changeEvent, eventSourceArn);

    if (!route) {
      throw new Error(`No route matched for record ${JSON.stringify(changeEvent.documentKey)} from ${eventSourceArn}`);
    }

    /* v8 ignore next -- @preserve - Guard is for TS. DocumentDB always provides documentKey as an object */
    if (!isObject(changeEvent.documentKey)) {
      throw new Error(`documentKey is not an object for record from ${eventSourceArn}`);
    }

    const documentKey = this.validateSchema(
      changeEvent.documentKey,
      route.documentKeySchema,
      'documentKey',
      changeEvent.documentKey,
    );

    const fullDocumentObject = isObject(changeEvent.fullDocument) ? changeEvent.fullDocument : undefined;
    const fullDocument = this.validateSchema(
      fullDocumentObject,
      route.fullDocumentSchema,
      'fullDocument',
      changeEvent.documentKey,
    );

    const fullDocumentBeforeChangeObject = isObject(changeEvent.fullDocumentBeforeChange)
      ? changeEvent.fullDocumentBeforeChange
      : undefined;
    const fullDocumentBeforeChange = this.validateSchema(
      fullDocumentBeforeChangeObject,
      route.fullDocumentBeforeChangeSchema,
      'fullDocumentBeforeChange',
      changeEvent.documentKey,
    );

    const request: InternalRequest = {
      operationType: changeEvent.operationType,
      documentKey,
      fullDocument,
      updateDescription: changeEvent.updateDescription,
      fullDocumentBeforeChange,
      changeEvent,
      entry,
      context,
    };

    await route.handler(request);
  }

  private matchRoute(changeEvent: DocumentDBChangeEvent, eventSourceArn: string): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.operationTypes && !filters.operationTypes.includes(changeEvent.operationType)) {
        return false;
      }

      if (filters.eventSourceArns && !filters.eventSourceArns.includes(eventSourceArn)) {
        return false;
      }

      if (filters.databases && !filters.databases.includes(changeEvent.ns.db)) {
        return false;
      }

      if (filters.collections && !filters.collections.includes(changeEvent.ns.coll)) {
        return false;
      }

      if (filters.customFilter) {
        return filters.customFilter({
          operationType: changeEvent.operationType,
          ns: changeEvent.ns,
          event: changeEvent,
        });
      }

      return true;
    });
  }

  private validateSchema<T extends Record<string, unknown> | undefined>(
    data: T,
    schema: Schema<unknown> | undefined,
    fieldName: string,
    eventId: Record<string, unknown>,
  ): T {
    if (!schema || data === undefined) {
      return data;
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Schema validation failed on ${fieldName} for record ${JSON.stringify(eventId)}`, {
        cause: result.error,
      });
    }
    return result.data as T;
  }
}

export function createDocumentDBRouter(_options?: DocumentDBRouterOptions): DocumentDBRouter {
  return new DocumentDBRouter();
}
