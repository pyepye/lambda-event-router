export type { Schema } from '@lambda-event-router/base';
export { createDynamoDBStreamRouter, DynamoDBStreamRouter, defineRoute } from './DynamoDBStreamRouter.js';
export type {
  DynamoDBStreamEventName,
  DynamoDBStreamFilterInput,
  DynamoDBStreamInsertRequest,
  DynamoDBStreamInsertRouteDefinition,
  DynamoDBStreamModifyRequest,
  DynamoDBStreamModifyRouteDefinition,
  DynamoDBStreamRemoveRequest,
  DynamoDBStreamRemoveRouteDefinition,
  DynamoDBStreamRequest,
  DynamoDBStreamResponse,
  DynamoDBStreamRouteDefinition,
  DynamoDBStreamRouterOptions,
  DynamoDBStreamViewType,
} from './types.js';
