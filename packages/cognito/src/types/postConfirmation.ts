import type { Schema } from '@lambda-event-router/base';
import type { Context, PostConfirmationTriggerEvent } from 'aws-lambda';
import type { CognitoFilters, UserAttributes } from './common.js';

// PostConfirmation trigger sources - derived from aws-lambda
export type PostConfirmationTriggerSource = PostConfirmationTriggerEvent['triggerSource'];

// PostConfirmation request - simplified to just essential fields
export interface PostConfirmationRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: PostConfirmationTriggerSource;
  userAttributes: TUserAttributes;
  event: PostConfirmationTriggerEvent;
  context: Context;
}

// PostConfirmation response (no response fields)
export type PostConfirmationResponse = undefined;

// PostConfirmation handler type
// Handlers modify the cloned event and return it
export type PostConfirmationHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: PostConfirmationRequest<TUserAttributes>,
) => Promise<PostConfirmationTriggerEvent>;

// PostConfirmation route definition
export interface PostConfirmationRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<PostConfirmationTriggerSource>;
  userAttributesSchema?: Schema<TUserAttributes>;
  handler: PostConfirmationHandler<TUserAttributes>;
}
