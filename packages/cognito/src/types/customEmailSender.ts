import type { Context, CustomEmailSenderTriggerEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// CustomEmailSender trigger sources - derived from aws-lambda
export type CustomEmailSenderTriggerSource = CustomEmailSenderTriggerEvent['triggerSource'];

// CustomEmailSender response - no response for this trigger
export type CustomEmailSenderResponse = undefined;

// CustomEmailSender request - simplified to just essential fields
export interface CustomEmailSenderRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: CustomEmailSenderTriggerSource;
  userAttributes: TUserAttributes;
  event: CustomEmailSenderTriggerEvent;
  context: Context;
}

// CustomEmailSender handler type
// Handlers modify the cloned event and return it
export type CustomEmailSenderHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: CustomEmailSenderRequest<TUserAttributes>,
) => Promise<CustomEmailSenderTriggerEvent>;

// CustomEmailSender route definition
export interface CustomEmailSenderRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<CustomEmailSenderTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: CustomEmailSenderHandler<TUserAttributes>;
}
