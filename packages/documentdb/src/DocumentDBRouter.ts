import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
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
  TDocumentKeySchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentSchema extends StandardSchemaV1 | undefined = undefined,
  TFullDocumentBeforeChangeSchema extends StandardSchemaV1 | undefined = undefined,
  const TFilters extends RouteInputFilters = RouteInputFilters,
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
      return {
        filters: config.filters as DocumentDBFilters,
        documentKeySchema: config.documentKeySchema as StandardSchemaV1<unknown, TDocumentKey> | undefined,
        fullDocumentSchema: config.fullDocumentSchema as StandardSchemaV1<unknown, TFullDocument> | undefined,
        fullDocumentBeforeChangeSchema: config.fullDocumentBeforeChangeSchema as
          | StandardSchemaV1<unknown, TFullDocumentBeforeChange>
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

    const documentKeyErrorMessage = `Schema validation failed on documentKey for record ${JSON.stringify(changeEvent.documentKey)}`;
    const documentKey = (await validateSchema(
      changeEvent.documentKey,
      route.documentKeySchema,
      documentKeyErrorMessage,
    )) as Record<string, string>; // TODO: Fix / improve typing so `as` isn't needed

    const fullDocumentObject = isObject(changeEvent.fullDocument) ? changeEvent.fullDocument : undefined;
    const fullDocumentErrorMessage = `Schema validation failed on fullDocument for record ${JSON.stringify(changeEvent.documentKey)}`;
    const fullDocument = (await validateSchema(
      fullDocumentObject,
      route.fullDocumentSchema,
      fullDocumentErrorMessage,
    )) as Record<string, string>; // TODO: Fix / improve typing so `as` isn't needed

    const fullDocumentBeforeChangeErrorMessage = `Schema validation failed on fullDocumentBeforeChange for record ${JSON.stringify(changeEvent.documentKey)}`;
    const fullDocumentBeforeChange = (await validateSchema(
      changeEvent.fullDocumentBeforeChange,
      route.fullDocumentBeforeChangeSchema,
      fullDocumentBeforeChangeErrorMessage,
    )) as Record<string, string>; // TODO: Fix / improve typing so `as` isn't needed;

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
}

export function createDocumentDBRouter(_options?: DocumentDBRouterOptions): DocumentDBRouter {
  return new DocumentDBRouter();
}
