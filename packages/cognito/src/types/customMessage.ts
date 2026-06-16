import type { Context, CustomMessageTriggerEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// CustomMessage trigger sources - derived from aws-lambda
export type CustomMessageTriggerSource = CustomMessageTriggerEvent['triggerSource'];

// CustomMessage response - derived from aws-lambda
export type CustomMessageResponse = CustomMessageTriggerEvent['response'];

// CustomMessage request - simplified to just essential fields
export interface CustomMessageRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: CustomMessageTriggerSource;
  userAttributes: TUserAttributes;
  event: CustomMessageTriggerEvent;
  context: Context;
}

// CustomMessage handler type
// Handlers modify the cloned event and return it
export type CustomMessageHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: CustomMessageRequest<TUserAttributes>,
) => Promise<CustomMessageTriggerEvent>;

// CustomMessage route definition
export interface CustomMessageRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<CustomMessageTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: CustomMessageHandler<TUserAttributes>;
}
