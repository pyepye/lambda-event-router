export type { Schema } from '@lambda-event-router/base';
export { createSNSRouter, defineRoute, SNSRouter } from './SNSRouter.js';
export type {
  SNSFilterInput,
  SNSFilters,
  SNSMessageAttributes,
  SNSRawMessageAttributes,
  SNSRequest as SNSRecord,
  SNSResponse,
  SNSRouteDefinition,
  SNSRouterOptions,
} from './types.js';
