export type { Schema } from '@lambda-event-router/base';
export { createDocumentDBRouter, DocumentDBRouter, defineRoute } from './DocumentDBRouter.js';
export type {
  DocumentDBChangeEvent,
  DocumentDBDeleteRequest,
  DocumentDBDeleteRouteDefinition,
  DocumentDBEvent,
  DocumentDBEventEntry,
  DocumentDBFilterInput,
  DocumentDBFullDocumentBeforeChangeOption,
  DocumentDBFullDocumentOption,
  DocumentDBInsertRequest,
  DocumentDBInsertRouteDefinition,
  DocumentDBOperationType,
  DocumentDBReplaceRequest,
  DocumentDBReplaceRouteDefinition,
  DocumentDBRequest,
  DocumentDBResponse,
  DocumentDBRouteDefinition,
  DocumentDBRouterOptions,
  DocumentDBUpdateDescription,
  DocumentDBUpdateRequest,
  DocumentDBUpdateRouteDefinition,
} from './types.js';
