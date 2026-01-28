export type { Schema } from '@lambda-event-router/base';
export { createEventBridgeRouter, defineRoute, EventBridgeRouter } from './EventBridgeRouter.js';
export type {
  EC2StateChangeDetail,
  EventBridgeDetailTypeMap,
  EventBridgeEventEnvelope,
  EventBridgeFilterInput,
  EventBridgeFilters,
  EventBridgeHandler,
  EventBridgeRequest,
  EventBridgeRouteDefinition,
  ScheduledEventDetail,
  SchedulerHandler,
  SchedulerRouteDefinition,
} from './types.js';
