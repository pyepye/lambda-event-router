export type { Schema } from '@lambda-event-router/base';
export { createDynamoDBRouter, DynamoDBRouter, defineRoute } from './DynamoDBRouter.js';
export type {
  DynamoDBEventName,
  DynamoDBFilterInput,
  DynamoDBInsertRequest,
  DynamoDBInsertRouteDefinition,
  DynamoDBModifyRequest,
  DynamoDBModifyRouteDefinition,
  DynamoDBRemoveRequest,
  DynamoDBRemoveRouteDefinition,
  DynamoDBRequest,
  DynamoDBResponse,
  DynamoDBRouteDefinition,
  DynamoDBRouterOptions,
  DynamoDBViewType,
} from './types.js';
