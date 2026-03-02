export type { Schema } from '@lambda-event-router/base';
export { createKinesisRouter, defineRoute, KinesisRouter } from './KinesisRouter.js';
export type {
  KinesisFilterInput,
  KinesisRequest,
  KinesisResponse,
  KinesisRouteDefinition,
  KinesisRouterOptions,
} from './types.js';
