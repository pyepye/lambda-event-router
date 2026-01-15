export type { Schema } from '@lambda-event-router/base';
export { createDynamoDBStreamRouter, defineRoute, DynamoDBStreamRouter } from './DynamoDBStreamRouter.js';
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
